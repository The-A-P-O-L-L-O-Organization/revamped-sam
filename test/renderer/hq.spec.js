import { assert } from 'chai';

import SamJs from '../../src/index.ts';
import loadFixture from '../fixture-reader.js';

const fixture = loadFixture('renderer/fixtures/hq-golden.json');

const decode = (base64) => new Uint8Array(Buffer.from(base64, 'base64'));

describe('high-precision render path (hq)', () => {
  fixture.cases.forEach((value) => {
    describe(`input "${String(value.input).slice(0, 30)}" ${JSON.stringify(value.options)}`, () => {
      let classic, hq;

      before(() => {
        const options = Object.assign({}, value.options, { phonetic: true });
        classic = new SamJs({}).buf8(value.input, options);
        hq = new SamJs({}).buf8(value.input, Object.assign({}, options, { hq: true }));
      });

      it('should match the committed golden fixture', () => {
        assert.isFalse(hq === false, 'render failed');
        assert.deepEqual(
          Array.from(hq),
          Array.from(decode(value.hq)),
          'hq render does not match fixture - did the synthesis change?'
        );
      });

      it('the classic render should match the committed golden fixture', () => {
        assert.isFalse(classic === false, 'render failed');
        assert.deepEqual(
          Array.from(classic),
          Array.from(decode(value.classic)),
          'classic render does not match fixture - did the synthesis change?'
        );
      });

      it('should keep the render timing (same length)', () => {
        assert.strictEqual(hq.length, classic.length);
        assert.strictEqual(hq.length, decode(value.hq).length);
      });

      it('should actually differ from the classic render', () => {
        let differing = 0;
        for (let i = 0; i < hq.length; i++) {
          if (hq[i] !== classic[i]) differing++;
        }
        // The sine quantization alone touches the bulk of all voiced
        // samples, so a barely different output would mean hq did not
        // take effect (e.g. a dropped option).
        assert.isAbove(
          differing,
          hq.length * 0.1,
          'hq is suspiciously close to the classic render'
        );
      });
    });
  });
});
