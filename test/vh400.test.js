const { describe, it } = require('node:test');
const assert = require('node:assert');
const { voltageToVWC } = require('../lib/vh400');

describe('voltageToVWC', () => {
  describe('boundary values', () => {
    it('returns 0 for 0V', () => {
      assert.strictEqual(voltageToVWC(0), 0);
    });

    it('returns ~10% at 1.1V boundary', () => {
      const vwc = voltageToVWC(1.1);
      assert.ok(vwc >= 9.9 && vwc <= 10.1, `Expected ~10%, got ${vwc}`);
    });

    it('returns ~15% at 1.3V boundary', () => {
      const vwc = voltageToVWC(1.3);
      assert.ok(vwc >= 14.9 && vwc <= 15.1, `Expected ~15%, got ${vwc}`);
    });

    it('returns ~40% at 1.82V boundary', () => {
      const vwc = voltageToVWC(1.82);
      assert.ok(vwc >= 39.5 && vwc <= 40.5, `Expected ~40%, got ${vwc}`);
    });

    it('returns ~50% at 2.2V boundary', () => {
      const vwc = voltageToVWC(2.2);
      assert.ok(vwc >= 49.5 && vwc <= 50.5, `Expected ~50%, got ${vwc}`);
    });

    it('returns 100% at 3.0V', () => {
      assert.strictEqual(voltageToVWC(3.0), 100);
    });
  });

  describe('mid-range values', () => {
    it('returns ~4% at 0.5V (first segment)', () => {
      const vwc = voltageToVWC(0.5);
      const expected = 10 * 0.5 - 1; // 4
      assert.strictEqual(vwc, expected);
    });

    it('returns ~12.5% at 1.2V (second segment)', () => {
      const vwc = voltageToVWC(1.2);
      const expected = 25 * 1.2 - 17.5; // 12.5
      assert.strictEqual(vwc, expected);
    });

    it('returns ~28% at 1.57V (third segment)', () => {
      const vwc = voltageToVWC(1.57);
      const expected = 48.08 * 1.57 - 47.5;
      assert.ok(Math.abs(vwc - expected) < 0.01, `Expected ${expected}, got ${vwc}`);
    });

    it('returns ~45% at 2.0V (fourth segment)', () => {
      const vwc = voltageToVWC(2.0);
      const expected = 26.32 * 2.0 - 7.89; // 44.75
      assert.ok(Math.abs(vwc - expected) < 0.01, `Expected ${expected}, got ${vwc}`);
    });

    it('returns ~75% at 2.6V (fifth segment)', () => {
      const vwc = voltageToVWC(2.6);
      const expected = 62.5 * 2.6 - 87.5; // 75
      assert.strictEqual(vwc, expected);
    });
  });

  describe('edge cases', () => {
    it('returns 0 for negative voltage', () => {
      assert.strictEqual(voltageToVWC(-1), 0);
      assert.strictEqual(voltageToVWC(-0.5), 0);
    });

    it('returns 100 for voltage above 3V', () => {
      assert.strictEqual(voltageToVWC(3.5), 100);
      assert.strictEqual(voltageToVWC(5), 100);
    });

    it('handles very small positive voltage', () => {
      const vwc = voltageToVWC(0.001);
      assert.ok(vwc >= 0, 'Should not be negative');
    });
  });
});
