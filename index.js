'use strict';
const readPkgUp = require('read-pkg-up');
const semver = require('semver');
const childProcess = require('child_process');

const STDOUT_BUFFER_SIZE = 2000 * 1024;
const POSSIBLE_TAGS = {
  snapshot: /^snapshot$/i,
  candidate: /^rc\d*$/i,
  milestone: /^m\d+$/i
};

const DEFAULT_OPTIONS = {
  redirectOutput: false,
  maxBufferSize: STDOUT_BUFFER_SIZE,
  cwd: '.'
};

function getDistTagForTag(tag) {
  for (const possibleTag in POSSIBLE_TAGS) {
    if (POSSIBLE_TAGS[possibleTag].test(tag)) {
      return possibleTag;
    }
  }

  return null;
}

function getMatchingDistTags(prereleaseTags) {
  return prereleaseTags.reduce(function (matchedTags, tag) {
    const distTag = getDistTagForTag(tag);

    if (distTag === null) {
      return matchedTags;
    }

    return matchedTags.concat(distTag);
  }, []);
}

function getDistTagForVersion(version) {
  const prereleaseTags = semver.prerelease(version);

  if (prereleaseTags === null) {
    return null;
  }

  const matchingDistTags = getMatchingDistTags(prereleaseTags);

  if (matchingDistTags.length > 1) {
    throw new Error('Multiple prerelease tags matching possible dist tags detected');
  }

  return matchingDistTags.length === 1 ? matchingDistTags[0] : null;
}

module.exports = function (opts) {
  // default opts is cwd, for backwards compatibility
  if (typeof opts === 'string') {
    opts = {cwd: opts};
  }

  opts = Object.assign({}, DEFAULT_OPTIONS, opts);

  function publish(distTag) {
    const publishCommand = 'npm publish' + (distTag ? ' --tag ' + distTag : '');
    return exec(publishCommand);
  }

  function publishPackage(packageObj) {
    const version = packageObj.pkg.version;
    const distTag = getDistTagForVersion(version);

    if (distTag === 'snapshot') {
      return exec('npm unpublish --force')
        .then(publish.bind(undefined, distTag));
    }

    return publish(distTag === null ? undefined : distTag);
  }

  function exec(cmd) {
    return new Promise(function (resolve, reject) {
      const exec = childProcess.exec(cmd, {cwd: opts.cwd, maxBuffer: opts.maxBufferSize}, function (error, stdout, stderr) {
        if (error) {
          reject(stderr);
        }
        resolve(stdout);
      });

      if (opts.redirectOutput) {
        exec.stdout.pipe(process.stdout);
        exec.stderr.pipe(process.stderr);
      }
    });
  }

  return readPkgUp({cwd: opts.cwd}).then(publishPackage);
};
