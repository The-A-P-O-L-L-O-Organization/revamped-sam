import { assert } from 'chai'

import Uint16 from '../../src/types/Uint16.es6';

describe('util.es6', () => {
  describe('Uint16', () => {
    describe('#get()', () => {
      it('should return constructor value', () => {
        const uint = new Uint16(5);
        assert.equal(5, uint.get());
      })
    });
    describe('#set()', () => {
      it('should override constructor value', () => {
        const uint = new Uint16(5);
        uint.set(6);
        assert.equal(6, uint.get());
      })
    });
    describe('#inc()', () => {
      it('should increment constructor value', () => {
        const uint = new Uint16(5);
        uint.inc();
        assert.equal(6, uint.get());
      })
    });
    describe('#inc(2)', () => {
      it('should increment constructor value', () => {
        const uint = new Uint16(5);
        uint.inc(2);
        assert.equal(7, uint.get());
      })
    });
    describe('#dec()', () => {
      it('should decrement constructor value', () => {
        const uint = new Uint16(5);
        uint.dec();
        assert.equal(4, uint.get());
      })
    });
    describe('#dec(2)', () => {
      it('should decrement constructor value', () => {
        const uint = new Uint16(5);
        uint.dec(2);
        assert.equal(3, uint.get());
      })
    });
    describe('#calc + 10', () => {
      it('can be calculated', () => {
        const uint = new Uint16(5);
        assert.equal(15, uint + 10);
      })
    });
    describe('#inc() overflow', () => {
      it('will overflow', () => {
        const uint = new Uint16(0xFFFF);
        uint.inc();
        assert.equal(0, uint);
      })
    });
    describe('#dec() underflow', () => {
      it('will underflow', () => {
        const uint = new Uint16(0);
        uint.dec();
        assert.equal(0xFFFF, uint);
      })
    });
  });
});
