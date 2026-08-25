import { randomInt } from 'node:crypto';

const INTERNAL_EAN_PREFIX = '20';

export function calculateEan13CheckDigit(firstTwelveDigits: string): string {
  if (!/^\d{12}$/.test(firstTwelveDigits)) {
    throw new Error('EAN-13 requires exactly 12 digits before the check digit');
  }

  const weightedSum = firstTwelveDigits
    .split('')
    .reduce(
      (sum, digit, index) => sum + Number(digit) * (index % 2 === 0 ? 1 : 3),
      0,
    );

  return String((10 - (weightedSum % 10)) % 10);
}

export function generateInternalEan13(): string {
  const randomPayload = Array.from({ length: 10 }, () => randomInt(0, 10)).join(
    '',
  );
  const firstTwelveDigits = `${INTERNAL_EAN_PREFIX}${randomPayload}`;
  return `${firstTwelveDigits}${calculateEan13CheckDigit(firstTwelveDigits)}`;
}
