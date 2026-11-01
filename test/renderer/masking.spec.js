import { assert } from 'chai';

import SamJs from '../../src/index.ts';

// The glottal-pulse masking is the phase resync of the formant generators
// at every glottal pulse (the authentic 6502 behavior). A `masking: false`
// render must keep the exact timing (sample count / frame layout) while
// changing the samples: the phases run free instead of restarting.
const input = 'THE OWL SINGS IN THE MOONLIGHT.';

const eq = (a, b) => a.length === b.length && a.every((value, index) => value === b[index]);

describe('glottal pulse masking option', () => {
  let authentic, explicit, disabled;

  before(() => {
    authentic = new SamJs({}).buf8(input);
    explicit = new SamJs({}).buf8(input, { masking: true });
    disabled = new SamJs({}).buf8(input, { masking: false });
  });

  it('should not change the render timing', () => {
    assert.isFalse(authentic === false);
    assert.strictEqual(authentic.length, explicit.length);
    assert.strictEqual(authentic.length, disabled.length);
  });

  it('should be enabled by default (authentic render)', () => {
    assert.isTrue(eq(authentic, explicit));
  });

  it('should produce different samples when disabled', () => {
    assert.isFalse(eq(authentic, disabled));
    assert.isFalse(eq(explicit, disabled));
  });

  it('should reject typo-ed option spellings', () => {
    assert.throws(() => new SamJs({}).buf8(input, { Masking: false }), /Unknown option "Masking"/);
  });
});
