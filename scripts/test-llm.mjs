const key = process.env.GEMINI_API_KEY || process.env.AI_API_KEY || '';

const messages = [
  'bhaiya main Ramesh. 2 kurta navy blue, chest 40, parso chahiye. total ₹1850, 500 advance diya pichli baar jaisa.',
  'main Priya bol rahi hu. Kal dopahar 1 baje 3 veg lunch thali chahiye. 720 rupaye bhej diye.',
  '1kg chocolate cake with eggless base, write Happy Birthday Aryan, 15th ko chahiye. 1200 rs',
  'uncle switchboard mein sparking ho rahi hai hall mein, kal subah aakar check kardo. - Vikram',
  'hi bhaiya please call back immediately'
];

async function run() {
  console.log('Testing Gemini 3.6 Flash with key:', key.slice(0, 10) + '...');
  for (const msg of messages) {
    console.log(`\nInput: "${msg}"`);
    const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `You are a precision order parsing engine for Indian small businesses. Reference date: 2026-08-29. Extract structured order JSON conforming strictly to schema.json:
{
  "customer": "string | null",
  "items": [{ "description": "string", "quantity": 1, "attributes": {} }],
  "due_date": "YYYY-MM-DD | null",
  "amount": number | null,
  "references_prior_order": boolean,
  "confidence": float between 0-1,
  "needs_clarification": boolean
}
Return ONLY valid JSON.

Message: ${msg}`
              }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1
        }
      })
    });

    const data = await resp.json();
    if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
      console.log(data.candidates[0].content.parts[0].text);
    } else {
      console.log('Error:', JSON.stringify(data, null, 2));
    }
  }
}

run();
