import { PermanentDeliveryError } from '../types/notification-provider.types';

export function normalizePhoneNumber(
  phone: string,
  defaultCountryCode = '254',
) {
  let digits = phone.trim().replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('0'))
    digits = `${defaultCountryCode}${digits.slice(1)}`;
  if (!/^\d{8,15}$/.test(digits)) {
    throw new PermanentDeliveryError('Phone number is not valid E.164 format');
  }
  return digits;
}

export function maskPhoneNumber(phone: string) {
  const visible = phone.slice(-4);
  return `${'*'.repeat(Math.max(0, phone.length - 4))}${visible}`;
}
