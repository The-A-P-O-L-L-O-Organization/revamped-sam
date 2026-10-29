import { assert } from 'chai'

import Uint8 from '../../src/types/UInt8.es6';

describe('util.es6', () => {
  describe('Uint8', () => {
    describe('#get()', () => {
      it('should return constructor value', () => {
        const uint8 = new Uint8(5);
        assert.equal(5, uint8.get());
      })
    });
    describe('#set()', () => {
      it('should override constructor value', () => {
        const uint8 = new Uint8(5);
        uint8.set(6);
        assert.equal(6, uint8.get());
      })
    });
    describe('#inc()', () => {
      it('should increment constructor value', () => {
        const uint8 = new Uint8(5);
        uint8.inc();
        assert.equal(6, uint8.get());
      })
    });
    describe('#inc(2)', () => {
      it('should increment constructor value', () => {
        const uint8 = new Uint8(5);
        uint8.inc(2);
        assert.equal(7, uint8.get());
      })
    });
    describe('#dec()', () => {
      it('should decrement constructor value', () => {
        const uint8 = new Uint8(5);
        uint8.dec();
        assert.equal(4, uint8.get());
      })
    });
    describe('#dec(2)', () => {
      it('should decrement constructor value', () => {
        const uint8 = new Uint8(5);
        uint8.dec(2);
        assert.equal(3, uint8.get());
      })
    });
    describe('#calc + 10', () => {
      it('can be calculated', () => {
        const uint8 = new Uint8(5);
        assert.equal(15, uint8 + 10);
      })
    });
    describe('#inc() overflow', () => {
      it('will overflow', () => {
        const uint8 = new Uint8(255);
        uint8.inc();
        assert.equal(0, uint8);
      })
    });
    describe('#dec() overflow', () => {
      it('will overflow', () => {
        const uint8 = new Uint8(0);
        uint8.dec();
        assert.equal(255, uint8);
      })
    });
  });
});
