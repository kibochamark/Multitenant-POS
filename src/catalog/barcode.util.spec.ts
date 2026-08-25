import {
  calculateEan13CheckDigit,
  generateInternalEan13,
} from './barcode.util';

describe('barcode utilities', () => {
  it('calculates a valid EAN-13 check digit', () => {
    expect(calculateEan13CheckDigit('400638133393')).toBe('1');
  });

  it('generates a 13-digit internal barcode with a valid checksum', () => {
    const barcode = generateInternalEan13();
    expect(barcode).toMatch(/^20\d{11}$/);
    expect(barcode.charAt(12)).toBe(
      calculateEan13CheckDigit(barcode.slice(0, 12)),
    );
  });
});
