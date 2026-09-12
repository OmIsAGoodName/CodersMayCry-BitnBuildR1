/**
 * Vendora Universal Domain-Adaptive Rule-Based Engine
 * Runs 100% offline, 0 dependencies, < 2ms latency.
 */

import { resolveColloquialDate } from './dateResolver';
import { NUMBER_WORDS, COLOR_WORDS, FABRIC_WORDS, DOMAIN_KEYWORDS, PRIOR_ORDER_PATTERNS } from './lexicon';

export interface StandardParsedOrder {
  customer: string | null;
  items: Array<{
    description: string;
    quantity: number;
    attributes: Record<string, string>;
  }>;
  due_date: string | null;
  amount: number | null;
  references_prior_order: boolean;
  confidence: number;
  needs_clarification: boolean;
}

const HINDI_TO_ARABIC_DIGITS: Record<string, string> = {
  '०': '0', '१': '1', '२': '2', '३': '3', '४': '4',
  '५': '5', '६': '6', '७': '7', '८': '8', '९': '9',
};

export function normalizeHindiNumerals(text: string): string {
  let result = text;
  for (const [hindi, arabic] of Object.entries(HINDI_TO_ARABIC_DIGITS)) {
    result = result.split(hindi).join(arabic);
  }
  return result;
}

const NON_NAME_WORDS = new Set([
  'kurta', 'kameez', 'blouse', 'saree', 'blazer', 'suit', 'pant', 'shirt', 'lehenga',
  'cake', 'pastry', 'cupcake', 'thali', 'tiffin', 'lunch', 'dinner', 'nashta',
  'wiring', 'fan', 'geyser', 'switch', 'switchboard', 'mcb', 'light', 'hall', 'room', 'kitchen', 'bathroom',
  'urgent', 'please', 'plz', 'help', 'delivery', 'order', 'call', 'bhaiya', 'uncle', 'didi', 'sir', 'madam', 'ji'
]);

function cleanCandidateName(raw: string): string {
  return raw
    .replace(/[.,:;!?\n\r"']/g, ' ')
    .replace(/\b(bhaiya|uncle|didi|sir|madam|ji|namaste|hello|hi|order|chahiye|bol|rahi|raha|hu|hai|kardo|karna|here|calling|baat|se)\b/gi, '')
    .trim();
}

function isValidCustomerName(name: string): boolean {
  if (!name || name.length < 2 || name.length > 35) return false;
  if (/^\d+$/.test(name)) return false;
  const firstWord = name.split(/\s+/)[0].toLowerCase();
  if (NON_NAME_WORDS.has(firstWord)) return false;
  return true;
}

export function extractCustomer(rawText: string): string | null {
  const text = rawText.trim();

  // Pattern 0: "bhaiya main [Name]" or "main [Name] bol raha/rahi hu"
  const mainMatch = text.match(/(?:^|[.!?\n\s])(?:main|mein|mera naam|i am|this is|my name is|मैं)\s+([A-Za-z\u0900-\u097F]+(?:\s+[A-Za-z\u0900-\u097F]+)?)/i);
  if (mainMatch) {
    const candidate = cleanCandidateName(mainMatch[1]);
    if (isValidCustomerName(candidate)) return candidate;
  }

  // Pattern 1: Sign-off at end of message (e.g. "- Vikram", "~ Asha", "Regards, Rohit", "Thanks, Priya")
  const signoffMatch = text.match(/(?:[-—–~]|regards,?|thanks,?|from:?)\s*([A-Za-z\u0900-\u097F]+(?:\s+[A-Za-z\u0900-\u097F]+)?)\s*$/i);
  if (signoffMatch) {
    const candidate = cleanCandidateName(signoffMatch[1]);
    if (isValidCustomerName(candidate)) return candidate;
  }

  // Pattern 2: Explicit label (e.g. "Name: Priya Verma", "Naam: Suresh")
  const nameLabelMatch = text.match(/\b(?:name|naam|customer|naam hai|नाम)\s*[:\-]?\s*([A-Za-z\u0900-\u097F]+(?:\s+[A-Za-z\u0900-\u097F]+)?)/i);
  if (nameLabelMatch) {
    const candidate = cleanCandidateName(nameLabelMatch[1]);
    if (isValidCustomerName(candidate)) return candidate;
  }

  // Pattern 3: Greeting prefix (e.g. "Dr. Alok here", "Ramesh here")
  const hereMatch = text.match(/(?:^|[.!?\n\s])([A-Za-z\u0900-\u097F]+(?:\s+[A-Za-z\u0900-\u097F]+)?)\s+(?:here|bol raha|bol rahi|speaking)\b/i);
  if (hereMatch) {
    const candidate = cleanCandidateName(hereMatch[1]);
    if (isValidCustomerName(candidate)) return candidate;
  }

  return null;
}

export function extractQuantity(text: string): number {
  const norm = normalizeHindiNumerals(text.toLowerCase());

  // 1. Explicit quantity keywords (e.g. "qty: 2", "2 pcs", "2 pieces", "2x")
  const explicitMatch = norm.match(/\b(?:qty|quantity|pcs|pieces?|x)\s*[:=\-]?\s*(\d+|[a-zA-Z\u0900-\u097F]+)\b/i);
  if (explicitMatch) {
    const val = explicitMatch[1];
    if (/^\d+$/.test(val)) return parseInt(val, 10);
    if (NUMBER_WORDS[val]) return NUMBER_WORDS[val];
  }

  // 2. Hindi word numerals before an item keyword
  const wordKeys = Object.keys(NUMBER_WORDS).join('|');
  const wordRegex = new RegExp(`\\b(${wordKeys})\\s+(?=[a-zA-Z\\u0900-\\u097F]+)`, 'i');
  const wordMatch = norm.match(wordRegex);
  if (wordMatch && NUMBER_WORDS[wordMatch[1].toLowerCase()]) {
    return NUMBER_WORDS[wordMatch[1].toLowerCase()];
  }

  // 3. Digits before item words (e.g. "2 kurta", "3 thali", "1 cake")
  const digitMatch = norm.match(/(?:^|[^\d])(\d{1,3})\s+(?=[a-zA-Z\u0900-\u097F]+)/i);
  if (digitMatch) {
    const num = parseInt(digitMatch[1], 10);
    if (num > 0 && num < 500) return num;
  }

  return 1;
}

export function extractAmount(text: string): number | null {
  const norm = normalizeHindiNumerals(text);

  // 1. Currency symbol prefix (₹ 1,850 or Rs. 1850)
  const symbolPrefix = norm.match(/(?:₹|rs\.?|inr|rupees?|rupaye|रुपये)\s*([\d,]+(?:\.\d+)?)/i);
  if (symbolPrefix) {
    const clean = symbolPrefix[1].replace(/,/g, '');
    const val = parseFloat(clean);
    if (!isNaN(val)) return val;
  }

  // 2. Currency symbol suffix (1850 ₹ or 1850 rs)
  const symbolSuffix = norm.match(/([\d,]+(?:\.\d+)?)\s*(?:₹|rs\.?|inr|rupees?|rupaye|रुपये)/i);
  if (symbolSuffix) {
    const clean = symbolSuffix[1].replace(/,/g, '');
    const val = parseFloat(clean);
    if (!isNaN(val)) return val;
  }

  // 3. Labeled totals (total: 1850, bill 2000)
  const totalMatch = norm.match(/\b(?:total|amount|bill|rate|bhav)\s*[:=\-]?\s*(?:₹|rs\.?)?\s*([\d,]+)/i);
  if (totalMatch) {
    const clean = totalMatch[1].replace(/,/g, '');
    const val = parseFloat(clean);
    if (!isNaN(val)) return val;
  }

  return null;
}

export function extractAttributes(text: string): Record<string, string> {
  const lower = normalizeHindiNumerals(text.toLowerCase());
  const attrs: Record<string, string> = {};

  // Colors
  for (const c of COLOR_WORDS) {
    if (new RegExp(`\\b${c}\\b`, 'i').test(lower)) {
      attrs.color = c;
      break;
    }
  }

  // Fabrics
  for (const f of FABRIC_WORDS) {
    if (new RegExp(`\\b${f}\\b`, 'i').test(lower)) {
      attrs.fabric = f;
      break;
    }
  }

  // Chest / Body Measurements
  const chestMatch = lower.match(/\b(?:chest|chhati)\s*[:=\-]?\s*(\d{2})\b/i)
    || lower.match(/(?:kurta|shirt|blazer|kameez|suit)[^,\n]*?,\s*(\d{2})\b/i);
  if (chestMatch) {
    attrs.chest = chestMatch[1];
  }

  // Waist / Length / Size
  const sizeMatch = lower.match(/\b(?:size|waist|kamar|length|lambaai)\s*[:=\-]?\s*(\d{1,3}|xl|xxl|l|m|s|xs)\b/i);
  if (sizeMatch) {
    attrs.size = sizeMatch[1];
  }

  // Cake weights & flavors
  const cakeWeightMatch = lower.match(/\b(\d+(?:\.\d+)?\s*(?:kg|kilo|pound|pounds)|half\s*kg|adha\s*kilo)\b/i);
  if (cakeWeightMatch) {
    attrs.weight = cakeWeightMatch[1];
  }
  const flavorMatch = lower.match(/\b(chocolate|black forest|butterscotch|pineapple|red velvet|vanilla|mango|strawberry|fruit cake)\b/i);
  if (flavorMatch) {
    attrs.flavor = flavorMatch[1];
  }

  // Diet preference
  if (/\b(eggless|bina ande|pure veg|veg)\b/i.test(lower)) {
    attrs.diet = 'eggless / veg';
  } else if (/\b(non-veg|non veg|chicken|mutton|egg)\b/i.test(lower)) {
    attrs.diet = 'non-veg';
  }

  return attrs;
}

export function extractDescription(text: string): string {
  const norm = normalizeHindiNumerals(text);

  // Match known trade items
  const itemKeywords = [
    'anarkali kurta', 'kurta pajama', 'kurta', 'kameez', 'salwar', 'blouse', 'saree',
    'blazer', 'pant', 'shirt', 'suit', 'lehenga', 'sherwani',
    'chocolate cake', 'birthday cake', 'cake', 'pastry', 'cupcakes',
    'veg thali', 'lunch thali', 'dinner thali', 'veg tiffin', 'non-veg tiffin', 'tiffin', 'thali',
    'switchboard', 'switch board', 'wiring', 'ceiling fan', 'fan', 'geyser', 'ac repair', 'light fitting', 'socket',
    'mangoes', 'mango', 'aam', 'apples', 'apple', 'bananas', 'banana', 'milk', 'doodh', 'dahi', 'paneer', 'bread', 'eggs', 'egg', 'atta', 'rice', 'dal', 'oil', 'sugar', 'biscuit', 'biscuits', 'fruits', 'sabzi'
  ];

  for (const item of itemKeywords) {
    if (new RegExp(`\\b${item}\\b`, 'i').test(norm)) {
      const regex = new RegExp(`(?:[a-zA-Z\\u0900-\\u097F\\s]{0,12}\\b${item}\\b[a-zA-Z\\u0900-\\u097F\\s]{0,20})`, 'i');
      const m = norm.match(regex);
      if (m) {
        return m[0]
          .replace(/\b(bhaiya|chahiye|bana do|karna hai|urgent|please|plz|parso|kal|aaj|total|rupaye|rs|₹)\b/gi, '')
          .replace(/[.,:;!?]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      }
      return item;
    }
  }

  const needMatch = norm.match(/\b(?:need|want|chahiye|order\s+for|collect|send|pack|give\s+me|bhejo|de\s+do)\s+(?:(\d+)\s+)?([a-zA-Z\u0900-\u097F\s]{2,20}?)(?=[,.]|\b(?:by|at|for|i\s+will|main|total|rs|advance|tomorrow|parso|kal|with)\b|$)/i);
  if (needMatch && needMatch[2]) {
    return needMatch[2].trim();
  }

  return 'Customer order';
}

export function detectPriorOrderReference(text: string): boolean {
  for (const pattern of PRIOR_ORDER_PATTERNS) {
    if (pattern.test(text)) return true;
  }
  return false;
}

export function parseUniversalMessage(rawMessage: string, referenceDate: Date = new Date()): StandardParsedOrder {
  const norm = normalizeHindiNumerals(rawMessage.trim());
  const lower = norm.toLowerCase();

  const customer = extractCustomer(norm);
  const quantity = extractQuantity(norm);
  const due_date = resolveColloquialDate(norm, referenceDate);
  const amount = extractAmount(norm);
  const references_prior_order = detectPriorOrderReference(norm);
  const attributes = extractAttributes(norm);
  const description = extractDescription(norm);

  // Ambiguity Detection
  const isVague =
    /^(hi|hello|namaste|bhaiya|uncle|call karo|rate batao|urgent)\s*[.!?]*$/i.test(lower) ||
    norm.length < 6;

  const hasZeroDetails = !customer && !due_date && !amount && description === 'Customer order';
  const needs_clarification = isVague || hasZeroDetails;

  // Confidence Calibration
  let confidence = 0.94;
  if (needs_clarification) confidence -= 0.50;
  if (!customer) confidence -= 0.08;
  if (!due_date) confidence -= 0.10;
  if (!amount) confidence -= 0.06;
  if (description === 'Customer order') confidence -= 0.15;
  if (Object.keys(attributes).length > 0) confidence += 0.05;
  confidence = Math.max(0.15, Math.min(0.99, Number(confidence.toFixed(2))));

  return {
    customer,
    items: [
      {
        description,
        quantity: Math.max(1, quantity),
        attributes,
      },
    ],
    due_date,
    amount,
    references_prior_order,
    confidence,
    needs_clarification,
  };
}
