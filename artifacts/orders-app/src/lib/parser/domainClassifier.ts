/**
 * Vendora Universal Domain Classifier
 * Automatically infers the business domain from raw message contents.
 */

import { DOMAIN_KEYWORDS } from './lexicon';

export type BusinessDomain = 'tailoring' | 'bakery' | 'tiffin' | 'electrical' | 'general';

export function classifyDomain(message: string): BusinessDomain {
  const text = message.toLowerCase();

  const scores: Record<BusinessDomain, number> = {
    tailoring: 0,
    bakery: 0,
    tiffin: 0,
    electrical: 0,
    general: 0,
  };

  // Tailoring cues
  for (const kw of DOMAIN_KEYWORDS.tailoring) {
    if (text.includes(kw.toLowerCase())) scores.tailoring += 2;
  }
  if (/\b(chest|waist|length|sleeve|collar|naap|alter|stich|stitch|inch)\b/i.test(text)) {
    scores.tailoring += 3;
  }

  // Bakery cues
  for (const kw of DOMAIN_KEYWORDS.bakery) {
    if (text.includes(kw.toLowerCase())) scores.bakery += 2;
  }
  if (/\b(eggless|1kg|2kg|half kg|pound|write|bday|birthday|anniversary)\b/i.test(text)) {
    scores.bakery += 3;
  }

  // Tiffin cues
  for (const kw of DOMAIN_KEYWORDS.tiffin) {
    if (text.includes(kw.toLowerCase())) scores.tiffin += 2;
  }
  if (/\b(lunch|dinner|roti|sabzi|dal|chawal|monthly|weekly dabba)\b/i.test(text)) {
    scores.tiffin += 3;
  }

  // Electrical cues
  for (const kw of DOMAIN_KEYWORDS.electrical) {
    if (text.includes(kw.toLowerCase())) scores.electrical += 2;
  }
  if (/\b(switch|socket|wiring|fitting|mcb|geyser|fan|board|point)\b/i.test(text)) {
    scores.electrical += 3;
  }

  // Find max scoring domain
  let bestDomain: BusinessDomain = 'general';
  let maxScore = 0;

  for (const [domain, score] of Object.entries(scores) as Array<[BusinessDomain, number]>) {
    if (score > maxScore) {
      maxScore = score;
      bestDomain = domain;
    }
  }

  return bestDomain;
}
