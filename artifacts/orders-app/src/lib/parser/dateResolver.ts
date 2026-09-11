/**
 * JanVyapar Indian Colloquial & Relative Date Resolver
 *
 * Accurately parses:
 * - Relative days: aaj, kal, parso, tarso, narso, day after tomorrow
 * - Weekdays: agle mangalwar, is somwar, this friday, coming sunday
 * - Weekend: is weekend, this weekend, aane wala weekend
 * - Calendar dates: 10 tarikh, 15th ko, 25 tareekh, 5th Oct, 12/09/2026
 * - Next week: agle hafte, next week
 *
 * Emits strictly ISO-8601 YYYY-MM-DD or null.
 */

function formatISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const WEEKDAY_MAP: Record<string, number> = {
  sunday: 0,
  sun: 0,
  ravivar: 0,
  itwar: 0,
  रविवार: 0,
  इतवार: 0,

  monday: 1,
  mon: 1,
  somwar: 1,
  somvaar: 1,
  सोमवार: 1,

  tuesday: 2,
  tue: 2,
  mangalwar: 2,
  mangalvaar: 2,
  mangal: 2,
  मंगलवार: 2,
  मंगल: 2,

  wednesday: 3,
  wed: 3,
  budhwar: 3,
  budhvaar: 3,
  budh: 3,
  बुधवार: 3,
  बुध: 3,

  thursday: 4,
  thu: 4,
  guruwar: 4,
  guruvaar: 4,
  veervar: 4,
  brihaspativar: 4,
  गुरुवार: 4,
  वीरवार: 4,

  friday: 5,
  fri: 5,
  shukrawar: 5,
  shukravaar: 5,
  shukra: 5,
  jumma: 5,
  शुक्रवार: 5,
  शुक्र: 5,

  saturday: 6,
  sat: 6,
  shanivar: 6,
  shanivaar: 6,
  shani: 6,
  शनिवार: 6,
  शनि: 6,
};

const MONTH_MAP: Record<string, number> = {
  jan: 0, january: 0, janwary: 0, जनवरी: 0,
  feb: 1, february: 1, febuary: 1, फरवरी: 1,
  mar: 2, march: 2, मार्च: 2,
  apr: 3, april: 3, अप्रैल: 3,
  may: 4, मई: 4,
  jun: 5, june: 5, जून: 5,
  jul: 6, july: 6, जुलाई: 6,
  aug: 7, august: 7, अगस्त: 7,
  sep: 8, sept: 8, september: 8, सितम्बर: 8, सितंबर: 8,
  oct: 9, october: 9, अक्टूबर: 9, अक्तूबर: 9,
  nov: 10, november: 10, नवम्बर: 10, नवंबर: 10,
  dec: 11, december: 11, दिसम्बर: 11, दिसंबर: 11,
};

export function resolveColloquialDate(rawText: string, baseDate = new Date()): string | null {
  const text = rawText.toLowerCase();

  // 1. Explicit Relative Day Markers
  // Aaj / Today / आज
  if (/\b(aaj|today|current day|this evening|आज)\b/i.test(text)) {
    return formatISO(baseDate);
  }

  // Kal / Tomorrow / कल
  if (/\b(kal|tomorrow|tmrw|kl|कल)\b/i.test(text) && !/\b(beeta|bita|yesterday)\b/i.test(text)) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + 1);
    return formatISO(d);
  }

  // Parso / Day after tomorrow / परसों
  if (/\b(parso|parson|day after tomorrow|परसों)\b/i.test(text)) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + 2);
    return formatISO(d);
  }

  // Tarso / Narso / 3 days later / तरसों
  if (/\b(tarso|tarson|narso|narson|तरसों|नरसों)\b/i.test(text)) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + 3);
    return formatISO(d);
  }

  // 2. Weekend Markers
  if (/\b(is weekend|this weekend|weekend|week end|सप्ताहांत|aane wale weekend)\b/i.test(text)) {
    const d = new Date(baseDate);
    const day = d.getDay();
    // Target Saturday (6) or Sunday (0)
    let daysUntilSaturday = (6 - day + 7) % 7;
    if (daysUntilSaturday === 0 && d.getHours() > 18) daysUntilSaturday = 7; // if it's late saturday, next saturday
    if (daysUntilSaturday === 0) daysUntilSaturday = 0; // today is saturday
    d.setDate(d.getDate() + daysUntilSaturday);
    return formatISO(d);
  }

  // 3. Next Week / Agle Hafte
  if (/\b(agle hafte|next week|agle week|अगले हफ्ते)\b/i.test(text)) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + 7);
    return formatISO(d);
  }

  // 4. Relative Weekdays (e.g. "agle mangalwar", "next tuesday", "is somwar", "this friday", "aane wale shanivar")
  for (const [dayName, targetDayNum] of Object.entries(WEEKDAY_MAP)) {
    const weekdayRegex = new RegExp(`(?:agle|next|this|is|aane wale|coming|अगले|इस|आने वाले)?\\s*\\b${dayName}\\b`, 'i');
    if (weekdayRegex.test(text)) {
      const isExplicitNext = /\b(agle|next|aane wale|अगले|आने वाले)\b/i.test(text);
      const currentDay = baseDate.getDay();
      let diff = targetDayNum - currentDay;

      if (diff <= 0) {
        // Target day is earlier in current week or today
        diff += 7;
      } else if (isExplicitNext && diff < 4) {
        // e.g. on Sunday, "next Tuesday" might mean next week's Tuesday
        diff += 7;
      }

      const d = new Date(baseDate);
      d.setDate(d.getDate() + diff);
      return formatISO(d);
    }
  }

  // 5. Explicit Day Numbers with "tarikh / tareekh / date / th" (e.g., "10 tarikh tak", "15th ko", "25 tareekh")
  const tarikhMatch = text.match(/\b(\d{1,2})\s*(?:st|nd|rd|th)?\s*(?:tarikh|tareekh|taareekh|tarik|tareek|तारीख|date)\b/i)
    || text.match(/\b(?:by|on|tak|ko|till)\s*(\d{1,2})(?:st|nd|rd|th)\b/i)
    || text.match(/\b(\d{1,2})(?:st|nd|rd|th)\s*(?:ko|tak|morning|evening|noon|delivery)\b/i);

  if (tarikhMatch) {
    const targetDay = parseInt(tarikhMatch[1], 10);
    if (targetDay >= 1 && targetDay <= 31) {
      const d = new Date(baseDate);
      if (targetDay < d.getDate()) {
        // Date has already passed this month, rollover to next month
        d.setMonth(d.getMonth() + 1);
      }
      d.setDate(targetDay);
      return formatISO(d);
    }
  }

  // 6. Explicit Day + Month (e.g. "5th Oct", "12 Nov", "15 October", "25 मार्च")
  for (const [mName, mIndex] of Object.entries(MONTH_MAP)) {
    const monthRegex1 = new RegExp(`\\b(\\d{1,2})\\s*(?:st|nd|rd|th)?\\s*(?:of)?\\s*${mName}\\b`, 'i');
    const monthRegex2 = new RegExp(`\\b${mName}\\s*(\\d{1,2})\\s*(?:st|nd|rd|th)?\\b`, 'i');

    const mMatch = text.match(monthRegex1) || text.match(monthRegex2);
    if (mMatch) {
      const dayNum = parseInt(mMatch[1], 10);
      if (dayNum >= 1 && dayNum <= 31) {
        const d = new Date(baseDate);
        let year = d.getFullYear();
        if (mIndex < d.getMonth() || (mIndex === d.getMonth() && dayNum < d.getDate())) {
          year += 1;
        }
        const targetDate = new Date(year, mIndex, dayNum, 12, 0, 0);
        return formatISO(targetDate);
      }
    }
  }

  // 7. Standard Numeric Formats (DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD)
  const isoMatch = text.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (isoMatch) {
    const target = new Date(parseInt(isoMatch[1], 10), parseInt(isoMatch[2], 10) - 1, parseInt(isoMatch[3], 10), 12, 0, 0);
    if (!isNaN(target.getTime())) return formatISO(target);
  }

  const ddmmyyyyMatch = text.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/);
  if (ddmmyyyyMatch) {
    let year = parseInt(ddmmyyyyMatch[3], 10);
    if (year < 100) year += 2000;
    const month = parseInt(ddmmyyyyMatch[2], 10) - 1;
    const day = parseInt(ddmmyyyyMatch[1], 10);
    const target = new Date(year, month, day, 12, 0, 0);
    if (!isNaN(target.getTime())) return formatISO(target);
  }

  return null;
}
