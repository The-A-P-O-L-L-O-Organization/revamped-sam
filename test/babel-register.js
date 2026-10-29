/**
 * Mocha bootstrap for the test suites.
 *
 * Registers @babel/register with the file extensions the sources use
 * (".es6" for the test-side C reference implementations, ".js" for the
 * library sources and ".ts" for the typed public surface). Cannot live in
 * .babelrc: "extensions" is a @babel/register option, not a Babel core one.
 *
 * Load with --require ./test/babel-register.js then point mocha at the
 * actual spec file(s), as done in the package.json test scripts.
 */

require('@babel/register')({
  extensions: ['.es6', '.js', '.jsx', '.ts', '.tsx'],
});
