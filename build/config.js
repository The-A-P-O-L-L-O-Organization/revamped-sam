const path = require('path');
const buble = require('@rollup/plugin-buble');
const replace = require('@rollup/plugin-replace');
const version = process.env.VERSION || require('../package.json').version;

const banner =
  '/**\n' +
  ' * This is SamJs.js v' + version + '\n' +
  ' *\n' +
  ' * A Javascript port of "SAM Software Automatic Mouth".\n' +
  ' *\n' +
  ' * Part of the revamped-sam fork:\n' +
  ' * https://github.com/The-A-P-O-L-L-O-Organization/revamped-sam\n' +
  ' *\n' +
  ' * Library port: (c) 2017-' + new Date().getFullYear() + ' Christian Schiffler\n' +
  ' * Original program: SAM Software Automatic Mouth\n' +
  ' * (c) 1982 Don\'t Ask Software (now SoftVoice, Inc.)\n' +
  ' *\n' +
  ' * @link(https://github.com/discordier/sam)\n' +
  ' *\n' +
  ' */';

const resolve = p => {
  return path.resolve(__dirname, '../', p)
};

const buildSrc = [
  {
    name: '',
    entry: 'src/index.es6',
    dest: 'samjs',
    moduleName: 'SamJs',
  },
  {
    name: 'guessnum-demo',
    entry: 'src/guessnum.es6',
    dest: 'guessnum',
    moduleName: 'GuessNum',
  },
]

const builds = {}

buildSrc.map((file) => {
  [
    // Browser build
    {
      name: '',
      suffix: '',
      format: 'umd',
    },
    // CommonJS. Used by bundlers e.g. Webpack & Browserify
    {
      name: 'cjs',
      suffix: '.common',
      format: 'cjs',
    },
    // ES Modules. Used by bundlers that support ES Modules, e.g. Rollup & Webpack 2
    {
      name: 'esm',
      suffix: '.esm',
      format: 'es',
    },
  ].map((build) => {
    const name = (build.name ? '-' + build.name : '') + (file.name ? '-' + file.name : '')
    builds['dev' + name] = {
      entry: resolve(file.entry),
      dest: resolve(`dist/${file.dest}${build.suffix}.js`),
      moduleName: file.moduleName,
      format: build.format,
      env: 'development',
      banner
    }
    builds['prod' + name] = {
      entry: resolve(file.entry),
      dest: resolve(`dist/${file.dest}${build.suffix}.min.js`),
      moduleName: file.moduleName,
      format: build.format,
      env: 'production',
      banner
    }
  })
})

function genConfig (opts) {
  let moduleName = opts.moduleName;
  const config = {
    input: opts.entry,
    output: {
      file: opts.dest,
      format: opts.format,
      name: moduleName,
      banner: opts.banner,
    },
    external: opts.external,
    plugins: [
      replace({
        preventAssignment: true,
        __VERSION__: version
      }),
      buble()
    ].concat(opts.plugins || [])
  };

  if (opts.env) {
    config.plugins.push(replace({
      preventAssignment: true,
      'process.env.NODE_ENV': JSON.stringify(opts.env),
      // Debug rule-tracing must never ship in the dist bundles: the demo page
      // loads a development-env build, so DEBUG_SAM has to be false here
      // regardless of the environment. (Enable tracing by manually replacing
      // this constant when debugging.)
      'process.env.DEBUG_SAM': JSON.stringify(false)
    }))
  }

  return config
}

if (process.env.TARGET) {
  module.exports = genConfig(builds[process.env.TARGET])
} else {
  exports.getBuild = name => genConfig(builds[name]);
  exports.getAllBuilds = () => Object.keys(builds).map(name => genConfig(builds[name]))
}
