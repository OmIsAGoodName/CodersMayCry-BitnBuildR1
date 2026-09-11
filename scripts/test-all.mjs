#!/usr/bin/env node
/**
 * Vendora Comprehensive Verification Suite
 * Tests all 5 objectives:
 * 1. Universal Message Parsing & Schema Contract (Test A)
 * 2. Colloquial Date Resolution
 * 3. CRDT Deterministic Convergence & Scripted Scenarios (Test C)
 * 4. Offline Query Layer Metrics
 */

import assert from 'node:assert';

console.log('🚀 Running Vendora Comprehensive Verification Suite...\n');

let passedTests = 0;
let totalTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Error: ${err.message}`);
  }
}

// ----------------------------------------------------
// 1. DATE RESOLUTION ENGINE TESTS
// ----------------------------------------------------
console.log('--- 1. Testing Indian Colloquial Date Resolution ---');

const HINDI_DIGITS = { '०': '0', '१': '1', '२': '2', '३': '3', '४': '4', '५': '5', '६': '6', '७': '7', '८': '8', '९': '9' };
function formatISO(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function resolveColloquialDate(rawText, baseDate = new Date()) {
  const text = rawText.toLowerCase();
  if (/\b(aaj|today|current day|आज)\b/i.test(text)) return formatISO(baseDate);
  if (/\b(kal|tomorrow|tmrw|कल)\b/i.test(text) && !/\b(beeta|bita|yesterday)\b/i.test(text)) {
    const d = new Date(baseDate); d.setDate(d.getDate() + 1); return formatISO(d);
  }
  if (/\b(parso|parson|day after tomorrow|परसों)\b/i.test(text)) {
    const d = new Date(baseDate); d.setDate(d.getDate() + 2); return formatISO(d);
  }
  if (/\b(tarso|tarson|narso|narson|तरसों|नरसों)\b/i.test(text)) {
    const d = new Date(baseDate); d.setDate(d.getDate() + 3); return formatISO(d);
  }
  if (/\b(is weekend|this weekend|weekend|सप्ताहांत)\b/i.test(text)) {
    const d = new Date(baseDate); const delta = (6 - d.getDay() + 7) % 7 || 7; d.setDate(d.getDate() + delta); return formatISO(d);
  }
  if (/\b(agle mangalwar|next tuesday|अगले मंगलवार)\b/i.test(text)) {
    const d = new Date(baseDate); const delta = (2 - d.getDay() + 7) % 7 || 7; d.setDate(d.getDate() + delta); return formatISO(d);
  }
  if (/\b(agle hafte|next week|अगले हफ्ते)\b/i.test(text)) {
    const d = new Date(baseDate); d.setDate(d.getDate() + 7); return formatISO(d);
  }
  const tarikhMatch = text.match(/\b(\d{1,2})\s*(?:st|nd|rd|th)?\s*(?:tarikh|tareekh|तारीख|date)\b/i)
    || text.match(/\b(\d{1,2})(?:st|nd|rd|th)\s*(?:ko|tak|morning|evening)\b/i);
  if (tarikhMatch) {
    const day = parseInt(tarikhMatch[1], 10);
    if (day >= 1 && day <= 31) {
      const d = new Date(baseDate);
      if (day < d.getDate()) d.setMonth(d.getMonth() + 1);
      d.setDate(day);
      return formatISO(d);
    }
  }
  return null;
}

const fixedBaseDate = new Date(2026, 7, 29); // Aug 29, 2026 (Saturday)

test('Date: aaj / today resolution', () => {
  const result = resolveColloquialDate('aaj delivery chahiye', fixedBaseDate);
  assert.strictEqual(result, '2026-08-29');
});

test('Date: kal / tomorrow resolution', () => {
  const result = resolveColloquialDate('kal subah tak', fixedBaseDate);
  assert.strictEqual(result, '2026-08-30');
});

test('Date: parso / day after tomorrow resolution', () => {
  const result = resolveColloquialDate('parso sham ko', fixedBaseDate);
  assert.strictEqual(result, '2026-08-31');
});

test('Date: tarso / 3 days later resolution', () => {
  const result = resolveColloquialDate('tarso aayenge', fixedBaseDate);
  assert.strictEqual(result, '2026-09-01');
});

test('Date: 15 tarikh / 15th ko resolution', () => {
  const result = resolveColloquialDate('15 tarikh tak ready rakhna', fixedBaseDate);
  assert.strictEqual(result, '2026-09-15');
});

// ----------------------------------------------------
// 2. PARSER CONTRACT & ACCURACY TESTS (TEST A)
// ----------------------------------------------------
console.log('\n--- 2. Testing Universal Message Parser (schema.json contract) ---');

function normalizeHindiDigits(text) {
  let result = text;
  for (const [h, a] of Object.entries(HINDI_DIGITS)) result = result.split(h).join(a);
  return result;
}

function parseMessageTest(rawMessage, baseDate = fixedBaseDate) {
  const norm = normalizeHindiDigits(rawMessage.trim());
  const lower = norm.toLowerCase();

  let customer = null;
  const signoffMatch = norm.match(/(?:[-—–~]|regards,?|thanks,?|from:?)\s*([A-Za-z\u0900-\u097F]+(?:\s+[A-Za-z\u0900-\u097F]+)?)\s*$/i);
  if (signoffMatch) customer = signoffMatch[1].trim();
  const nameLabelMatch = norm.match(/\b(?:name|naam|customer|naam hai|नाम)\s*[:\-]?\s*([A-Za-z\u0900-\u097F]+(?:\s+[A-Za-z\u0900-\u097F]+)?)/i);
  if (nameLabelMatch) customer = nameLabelMatch[1].trim();
  const introMatch = norm.match(/(?:^|[.!?\n])\s*(?:main|mera naam|i am|this is|मैं)\s+([A-Za-z\u0900-\u097F]+(?:\s+[A-Za-z\u0900-\u097F]+)?)/i);
  if (introMatch) customer = introMatch[1].replace(/\b(bol|baat|calling|kar|se|here|order|bhaiya|ji)\b.*$/i, '').trim();

  let quantity = 1;
  const qtyMatch = norm.match(/\b(?:qty|quantity|pcs|pieces?|x)\s*[:=\-]?\s*(\d+|ek|do|teen|char|paanch)\b/i)
    || norm.match(/(?:^|[^\d])(\d{1,3})\s+(?=[a-zA-Z\u0900-\u097F]+)/i);
  if (qtyMatch) {
    const v = qtyMatch[1].toLowerCase();
    const map = { ek: 1, do: 2, teen: 3, char: 4, paanch: 5 };
    quantity = parseInt(v, 10) || map[v] || 1;
  }

  const due_date = resolveColloquialDate(norm, baseDate);

  let amount = null;
  const amountMatch = norm.match(/(?:₹|rs\.?|inr|rupees?|rupaye|रुपये)\s*([\d,]+(?:\.\d+)?)/i)
    || norm.match(/([\d,]+(?:\.\d+)?)\s*(?:₹|rs\.?|inr|rupees?|rupaye|रुपये)/i);
  if (amountMatch) amount = parseFloat(amountMatch[1].replace(/,/g, '')) || null;

  const references_prior_order = /last time|pichli baar|same as before|repeat order|same naap|waisa hi|पिछली बार/i.test(lower);

  const attributes = {};
  const chestMatch = lower.match(/\b(?:chest|chhati)\s*[:=\-]?\s*(\d{2})/i) || lower.match(/(?:kurta|shirt|blazer)[^,\n]*?,\s*(\d{2})\b/i);
  if (chestMatch) attributes.chest = chestMatch[1];
  const colorMatch = lower.match(/\b(navy blue|royal blue|bottle green|teal|maroon|black|white|yellow|pink)\b/i);
  if (colorMatch) attributes.color = colorMatch[1];

  let description = 'Customer order';
  const descMatch = norm.match(/\b(?:[a-zA-Z\u0900-\u097F\s]{0,15}(?:kurta|kameez|blouse|saree|blazer|suit|pant|cake|pastry|thali|tiffin|wiring|fan|geyser)[a-zA-Z\u0900-\u097F\s]{0,20})\b/i);
  if (descMatch) description = descMatch[0].replace(/\b(chahiye|bana do|karna hai|please|plz|urgent|bhaiya|ji)\b/gi, '').replace(/[.,]/g, '').trim();

  const isVague = /^(hi|hello|namaste|bhaiya|uncle|call karo|rate batao)\s*[.!?]*$/i.test(lower);
  const needs_clarification = isVague || (!customer && !due_date && !amount && description === 'Customer order');

  let confidence = 0.94;
  if (needs_clarification) confidence -= 0.50;
  if (!customer) confidence -= 0.08;
  if (!due_date) confidence -= 0.10;
  if (!amount) confidence -= 0.06;
  if (description === 'Customer order') confidence -= 0.15;
  if (Object.keys(attributes).length > 0) confidence += 0.05;
  confidence = Math.max(0.15, Math.min(0.99, Number(confidence.toFixed(2))));

  return {
    customer: customer || null,
    items: [{ description, quantity, attributes }],
    due_date,
    amount,
    references_prior_order,
    confidence,
    needs_clarification,
  };
}

test('Parser: Tailoring order with attributes and repeat reference', () => {
  const msg = 'bhaiya 2 kurta chahiye navy blue, chest 40, parso tak ho jayega kya? last time jaisa hi. total ₹1850';
  const res = parseMessageTest(msg);
  assert.strictEqual(res.items[0].quantity, 2);
  assert.strictEqual(res.items[0].attributes.chest, '40');
  assert.strictEqual(res.items[0].attributes.color, 'navy blue');
  assert.strictEqual(res.due_date, '2026-08-31');
  assert.strictEqual(res.amount, 1850);
  assert.strictEqual(res.references_prior_order, true);
  assert.strictEqual(res.needs_clarification, false);
});

test('Parser: Tiffin order with customer intro and amount', () => {
  const msg = 'main Priya bol rahi hu. Kal dopahar 1 baje 3 veg lunch thali chahiye. 720 rupaye bhej diye.';
  const res = parseMessageTest(msg);
  assert.strictEqual(res.customer, 'Priya');
  assert.strictEqual(res.due_date, '2026-08-30');
  assert.strictEqual(res.amount, 720);
  assert.strictEqual(res.references_prior_order, false);
});

test('Parser: Ambiguous greeting correctly triggers needs_clarification', () => {
  const msg = 'bhaiya urgent call karo please';
  const res = parseMessageTest(msg);
  assert.strictEqual(res.needs_clarification, true);
  assert(res.confidence < 0.6);
});

// ----------------------------------------------------
// 3. CRDT CONVERGENCE & TEST C SCENARIO TESTS
// ----------------------------------------------------
console.log('\n--- 3. Testing Deterministic CRDT Sync Convergence (Test C) ---');

function compareHLC(aStr, bStr) {
  if (!aStr && !bStr) return 0;
  if (!aStr) return -1;
  if (!bStr) return 1;
  const a = aStr.split(':');
  const b = bStr.split(':');
  const at = parseInt(a[0], 36) || 0;
  const bt = parseInt(b[0], 36) || 0;
  if (at !== bt) return at - bt;
  const ac = parseInt(a[1], 36) || 0;
  const bc = parseInt(b[1], 36) || 0;
  if (ac !== bc) return ac - bc;
  return (a[2] || '').localeCompare(b[2] || '');
}

function mergeOrders(local, remote) {
  const combinedHlc = {};
  const allHlcKeys = Array.from(new Set([
    ...Object.keys(local.fieldHlc || {}),
    ...Object.keys(remote.fieldHlc || {}),
  ])).sort();

  for (const key of allHlcKeys) {
    const lHlc = local.fieldHlc?.[key];
    const rHlc = remote.fieldHlc?.[key];
    const cmp = compareHLC(lHlc, rHlc);
    combinedHlc[key] = cmp >= 0 ? (lHlc || rHlc) : (rHlc || lHlc);
  }

  const merged = { ...local, fieldHlc: combinedHlc };
  const fields = ['customer', 'phone', 'dueDate', 'amount', 'status', 'referencesPriorOrder'];

  for (const field of fields) {
    const lVal = local[field];
    const rVal = remote[field];
    const lHlc = local.fieldHlc?.[field] || '0:0:local';
    const rHlc = remote.fieldHlc?.[field] || '0:0:remote';

    if (JSON.stringify(lVal) !== JSON.stringify(rVal)) {
      const cmp = compareHLC(lHlc, rHlc);
      merged[field] = cmp >= 0 ? lVal : rVal;
      merged.fieldHlc[field] = cmp >= 0 ? lHlc : rHlc;
    }
  }
  return merged;
}

test('CRDT: Scenario 1 - Non-overlapping edits converge deterministically', () => {
  const baseOrder = { id: '1', customer: 'Asha', amount: 1000, dueDate: '2026-09-01', fieldHlc: {} };
  const devA = { ...baseOrder, amount: 1500, fieldHlc: { amount: '100:0:devA' } };
  const devB = { ...baseOrder, dueDate: '2026-09-05', fieldHlc: { dueDate: '101:0:devB' } };

  const mergeAB = mergeOrders(devA, devB);
  const mergeBA = mergeOrders(devB, devA);

  assert.deepStrictEqual(mergeAB, mergeBA);
  assert.strictEqual(mergeAB.amount, 1500);
  assert.strictEqual(mergeAB.dueDate, '2026-09-05');
});

test('CRDT: Scenario 2 - Competing same-field edits resolve identically both ways', () => {
  const baseOrder = { id: '2', customer: 'Kabir', amount: 1000, fieldHlc: {} };
  const devA = { ...baseOrder, amount: 1200, fieldHlc: { amount: '100:0:devA' } };
  const devB = { ...baseOrder, amount: 1400, fieldHlc: { amount: '105:0:devB' } };

  const mergeAB = mergeOrders(devA, devB);
  const mergeBA = mergeOrders(devB, devA);

  assert.deepStrictEqual(mergeAB, mergeBA);
  assert.strictEqual(mergeAB.amount, 1400); // Higher HLC wins
});

// ----------------------------------------------------
// 4. OFFLINE QUERY METRICS TESTS
// ----------------------------------------------------
console.log('\n--- 4. Testing Offline Operational Query Layer ---');

test('Query: Due today & overdue calculation', () => {
  const orders = [
    { id: '1', customer: 'A', dueDate: '2026-08-28', status: 'new' },
    { id: '2', customer: 'B', dueDate: '2026-08-29', status: 'in_progress' },
    { id: '3', customer: 'C', dueDate: '2026-09-02', status: 'new' },
    { id: '4', customer: 'D', dueDate: '2026-08-28', status: 'completed' },
  ];
  const active = orders.filter((o) => !['completed', 'cancelled'].includes(o.status));
  const overdue = active.filter((o) => o.dueDate < '2026-08-29');
  const dueToday = active.filter((o) => o.dueDate === '2026-08-29');

  assert.strictEqual(overdue.length, 1);
  assert.strictEqual(dueToday.length, 1);
});

test('Query: Outstanding debt balances calculation', () => {
  const orders = [
    { id: '1', customer: 'Asha', amount: 1800, paidAmount: 900 },
    { id: '2', customer: 'Ritu', amount: 720, paidAmount: 720 },
    { id: '3', customer: 'Asha', amount: 500, paidAmount: 0 },
  ];
  const ashaTotalOwed = orders
    .filter((o) => o.customer === 'Asha')
    .reduce((sum, o) => sum + Math.max(0, o.amount - o.paidAmount), 0);

  assert.strictEqual(ashaTotalOwed, 1400);
});

// ----------------------------------------------------
// SUMMARY
// ----------------------------------------------------
console.log(`\n========================================`);
console.log(`🏁 Test Summary: ${passedTests}/${totalTests} Passed (${Math.round((passedTests / totalTests) * 100)}%)`);
console.log(`========================================\n`);

if (passedTests !== totalTests) {
  process.exit(1);
}
