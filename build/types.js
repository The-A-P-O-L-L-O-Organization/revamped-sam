/**
 * Compiles the typed public surface (src/index.ts):
 * - build/.ts/    mirrored ES module graph used as the bundler input
 * - dist/samjs.d.ts  public type declarations for library consumers
 *
 * Invoked by build/build.js before bundling and by the dev/build watch
 * scripts, so that both bundle from the same compiled tree.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function buildTypes () {
  fs.rmSync('build/.ts', { recursive: true, force: true });
  fs.rmSync('build/.dts', { recursive: true, force: true });

  const tsc = require.resolve('typescript/lib/tsc.js');
  const result = spawnSync(
    process.execPath,
    [tsc, '--project', path.resolve('tsconfig.build.json')],
    { stdio: 'inherit' }
  );

  if (result.error || result.status !== 0) {
    throw new Error(`Failed to compile the typed public surface (tsc exit code ${result.status}).`)
  }

  fs.mkdirSync('dist', { recursive: true });
  fs.copyFileSync('build/.dts/index.d.ts', 'dist/samjs.d.ts');
  fs.rmSync('build/.dts', { recursive: true, force: true });

  console.log('dist/samjs.d.ts ' + (fs.statSync('dist/samjs.d.ts').size / 1024).toFixed(2) + 'kb');
}

module.exports = { buildTypes };

if (require.main === module) {
  buildTypes();
}
