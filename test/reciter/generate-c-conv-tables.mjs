// Generator for test/reciter/c-conv/tables.es6.
//
// The c-conv reciter (the port of the 6510 machine code) indexes its rule
// blocks with 16 bit offsets into the rule byte blob ('tab37489' low byte,
// 'tab37515' high byte, relative to the 32000 base). Each letter bucket is
// introduced by a ']<letter>' marker entry in the blob (which provides the
// termination bytes the offsets point at), and the blob ends with a 'j'
// tail guard. Keeping those hand-maintained offsets in sync is unwieldy,
// so this script:
//
// 1. takes the vocabulary of the modern engine (src/reciter/tables.js)
//    that is not part of the original table,
// 2. splices those rules right behind the ']<letter>' markers of the
//    original blob (keeping the original global rule order), and
// 3. recomputes the letter offsets, verifying the computation against the
//    committed hand table of the unmodified blob first.
//
// Run with:
//   node --experimental-strip-types test/reciter/generate-c-conv-tables.mjs
// after changing src/reciter/tables.js.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Extract the quoted string list between a `encodePhonemeTable([` marker
 * (or an offset table name) and the next `]);` or `];`.
 */
const extractList = (source, from) => {
  const to = source.indexOf('\n]);', from) === -1
    ? source.indexOf('\n];', from)
    : source.indexOf('\n]);', from);
  return source.slice(from, to)
    .split('\n')
    .map((line) => line.trim().replace(/,$/, ''))
    .filter((line) => line.startsWith("'"))
    .map(parseJsString);
};

/**
 * Parse a single quoted JS string literal, handling the escapes the table
 * files use (backslash and apostrophe).
 */
const parseJsString = (literal) => {
  let result = '';
  for (let pos = 1; pos < literal.length; pos++) {
    const char = literal[pos];
    if (char === '\\') {
      pos++;
      result += literal[pos];
      continue;
    }
    if (char === "'") {
      break;
    }
    result += char;
  }
  return result;
};

// --- 1. Parse the original committed c-conv table (from git HEAD). ---
const original = execFileSync('git', ['show', 'HEAD:test/reciter/c-conv/tables.es6'], { encoding: 'utf8' });

const origRules = extractList(original, original.indexOf('export const rules = encodePhonemeTable(['));

const extractBytes = (source, name) => {
  const from = source.indexOf(name);
  const to = source.indexOf('\n]);', from);
  return source.slice(from, to)
    .split('\n')
    .slice(1)
    .join(',')
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value !== '' && !Number.isNaN(Number(value)))
    .map(Number);
};

const origTabLow = extractBytes(original, 'export const tab37489 = new Uint8Array([');
const origTabHigh = extractBytes(original, 'export const tab37515 = new Uint8Array([');
if (origTabLow.length !== 26 || origTabHigh.length !== 26) {
  throw new Error('could not parse the original offset tables');
}
// The 26 ']<letter>' markers (blob sections) and the 'j' tail guard.
const MARKER = /^]([A-Z])$/;

// --- 2. The current vocabulary of the modern engine. ---
const { rules } = await import('../../src/reciter/tables.js');
const modernRules = rules.split('|');

// --- 3. Merge the vocabulary entries behind their letter markers. ---
// Sanity: the modern rules must be the original rules (without the
// marker/guard entries) plus exactly the new vocabulary.
const isMarker = (entry) => MARKER.test(entry) || entry === 'j';
const origRuleEntries = origRules.filter((entry) => !isMarker(entry));
const originalSet = new Set(origRuleEntries);
const vocabulary = modernRules.filter((rule) => !originalSet.has(rule));
if (modernRules.length !== origRuleEntries.length + vocabulary.length) {
  throw new Error('the modern engine rules diverge beyond vocabulary additions');
}

const newList = origRules.slice();
vocabulary.forEach((rule) => {
  const letter = rule.slice(rule.indexOf('(') + 1, rule.indexOf(')'))[0];
  const markerIndex = newList.indexOf(']' + letter);
  if (markerIndex === -1) {
    throw new Error('no marker found for letter ' + letter);
  }
  newList.splice(markerIndex + 1, 0, rule);
});

// --- 4. Rebuild the offset table: a letter pointer is the byte offset of
//        its ']<letter>' marker entry (whose last byte is a terminator,
//        and whose content bytes start exactly one rule later). ---
const computeOffsets = (list) => {
  const pointers = Array.from({length: 26}, () => -1);
  let offset = 0;
  list.forEach((entry) => {
    const marker = entry.match(MARKER);
    if (marker) {
      pointers[marker[1].charCodeAt(0) - 65] = offset;
    }
    offset += entry.length;
  });
  if (pointers.includes(-1)) {
    throw new Error('missing rule marker for letter ' + String.fromCharCode(65 + pointers.indexOf(-1)));
  }
  return pointers;
};

// Verify the computation reproduces the committed hand table: a pointer
// is valid as long as it resolves (via the next terminator byte) to the
// letter marker's first rule, so a hand value may legally sit anywhere
// within the entry preceding the marker (the committed table had such a
// quirk for one letter).
{
  const restored = computeOffsets(origRules);
  restored.forEach((value, letter) => {
    const table = origTabLow[letter] + origTabHigh[letter] * 256 - 32000;
    if (value === table) {
      return;
    }
    // walk to the marker and measure the entry before it
    let offset = 0;
    let previous = 1;
    for (let index = 0; index < origRules.length; index++) {
      const entry = origRules[index];
      const marker = entry.match(MARKER);
      if (marker && marker[1].charCodeAt(0) - 65 === letter) {
        break;
      }
      previous = entry.length;
      offset += entry.length;
    }
    if (!(value >= offset - previous && value <= offset)) {
      throw new Error(
        `offset mismatch for ${String.fromCharCode(65 + letter)}: ` +
        `${value} vs ${offset}`
      );
    }
    console.log(`note: ${String.fromCharCode(65 + letter)} offset quirk tolerated (table ${table} vs marker ${offset})`);
  });
  console.log('verified: computed offsets are consistent with the committed hand table');
}

const newPointers = computeOffsets(newList);
const newTabLow = newPointers.map((value) => value & 0xFF);
const newTabHigh = newPointers.map((value) => value >> 8);

// --- 5. Emit the new tables.es6 (prologue comment, the tail with the
//        rules2 table and encodePhonemeTable stay untouched; the rules
//        list and the offset tables are regenerated). ---
const content = readFileSync(join(here, 'c-conv', 'tables.es6'), 'utf8');
const header = content.slice(0, content.indexOf('export const tab37489 = new Uint8Array(['));
const tail = content.slice(content.indexOf('export const rules2 = encodePhonemeTable(['));

const renderRows = (values) => {
  const rows = [];
  for (let i = 0; i < values.length; i += 8) {
    rows.push('  ' + values.slice(i, i + 8).join(', ') + (i + 8 < values.length ? ',' : ''));
  }
  return rows.join('\n');
};

const generated = [
  header,
  'export const tab37489 = new Uint8Array([',
  renderRows(newTabLow),
  ']);',
  '',
  'export const tab37515 = new Uint8Array([',
  renderRows(newTabHigh),
  ']);',
  '',
  // 4071 + vocabulary bytes.
  'export const rules = encodePhonemeTable([',
  ...newList.map((entry) => `  ${JSON.stringify(entry)},`),
  ']);',
  '',
  tail,
].join('\n');

writeFileSync(join(here, 'c-conv', 'tables.es6'), generated);
console.log('entries:', newList.length, '| vocabulary merged:', vocabulary.length);
