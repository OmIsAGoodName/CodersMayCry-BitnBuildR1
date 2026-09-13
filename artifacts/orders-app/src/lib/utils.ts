import { twMerge } from 'tailwind-merge';

import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format and detect clean mobile numbers from WhatsApp & customer messages.
 * Automatically resolves 10-digit Indian numbers, +91 prefixes, embedded numbers,
 * and cleanly handles Baileys WhatsApp LIDs.
 */
export function formatWhatsAppPhone(rawPhone?: string | null, rawMessage?: string | null): string {
  // 1. Check if rawMessage contains an explicit 10-digit phone number written by customer
  if (rawMessage) {
    const textMatch = rawMessage.match(/(?:(?:\\+?91[-\\s]?)?([6-9]\\d{9}))\\b/);
    if (textMatch && textMatch[1]) {
      const num = textMatch[1];
      return `+91 ${num.slice(0, 5)} ${num.slice(5)}`;
    }
  }

  if (!rawPhone || !rawPhone.trim()) {
    return '+91 (WhatsApp)';
  }

  const cleaned = rawPhone.trim();
  const digits = cleaned.replace(/\D/g, '');

  // 2. Standard Indian 10-digit mobile
  if (digits.length === 10 && /^[6-9]/.test(digits)) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }

  // 3. Standard Indian 12-digit mobile with country code 91
  if (digits.length === 12 && digits.startsWith('91') && /^[6-9]/.test(digits.slice(2))) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }

  // 4. 11-digit starting with 0
  if (digits.length === 11 && digits.startsWith('0') && /^[6-9]/.test(digits.slice(1))) {
    return `+91 ${digits.slice(1, 6)} ${digits.slice(6)}`;
  }

  // 5. WhatsApp LID (internal identifier, 13+ digits not starting with 91)
  if (digits.length > 12 && !digits.startsWith('91')) {
    return `+91 ${digits.slice(0, 4)}...${digits.slice(-4)}`;
  }

  // 6. Generic international with +
  if (digits.length >= 7 && digits.length <= 13) {
    return `+${digits}`;
  }

  return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
}
