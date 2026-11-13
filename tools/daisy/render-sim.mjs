// Byte-exact render timing simulator — now lives in the library:
//
//     src/renderer/simulate.js
//
// (moved there so the web app and any consumer can retune songs
// client-side; this shim keeps the daisy tooling imports stable).
export { simulate } from '../../src/renderer/simulate.js';
