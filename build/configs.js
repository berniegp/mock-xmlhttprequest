'use strict';

const path = require('path');
const replace = require('@rollup/plugin-replace');
const packageVersion = require('../package.json').version;

const version = process.env.VERSION || packageVersion;

// eslint-disable-next-line operator-linebreak
const banner =
`/**
 * mock-xmlhttprequest v${version}
 * (c) ${new Date().getFullYear()} Bertrand Guay-Paquet
 * @license ISC
 */`;

function resolve(_path) {
  return path.resolve(__dirname, '../', _path);
}

const configs = {
  commonjs: {
    file: resolve('dist/mock-xmlhttprequest.common.js'),
    format: 'cjs',
  },
  esm: {
    file: resolve('dist/mock-xmlhttprequest.esm.js'),
    format: 'es',
  },
};

function genConfig(opts) {
  const config = {
    input: {
      input: resolve('src/index.js'),
      plugins: [
        replace({
          __VERSION__: version,
        }),
      ],
    },
    output: {
      banner,
      file: opts.file,
      format: opts.format,
      name: 'MockXMLHttpRequest',
    },
  };

  if (opts.env) {
    config.input.plugins.unshift(replace({
      'process.env.NODE_ENV': JSON.stringify(opts.env),
    }));
  }

  return config;
}

function mapValues(obj, fn) {
  const res = {};
  Object.keys(obj).forEach((key) => {
    res[key] = fn(obj[key], key);
  });
  return res;
}

module.exports = mapValues(configs, genConfig);
