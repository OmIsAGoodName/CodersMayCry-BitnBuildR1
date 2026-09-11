/**
 * Vendora Universal Lexicon
 * Multi-industry terminology, numbers, transliterations, measurements, and colloquial phrases.
 */

export const HINDI_DIGITS: Record<string, string> = {
  '०': '0',
  '१': '1',
  '२': '2',
  '३': '3',
  '४': '4',
  '५': '5',
  '६': '6',
  '७': '7',
  '८': '8',
  '९': '9',
};

export const NUMBER_WORDS: Record<string, number> = {
  // English words
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  hundred: 100,
  thousand: 1000,
  dozen: 12,
  couple: 2,
  pair: 2,

  // Hindi Devanagari
  एक: 1,
  दो: 2,
  तीन: 3,
  चार: 4,
  पांच: 5,
  पाँच: 5,
  छह: 6,
  छः: 6,
  सात: 7,
  आठ: 8,
  नौ: 9,
  दस: 10,
  ग्यारह: 11,
  बारह: 12,
  तेरह: 13,
  चौदह: 14,
  पंद्रह: 15,
  बीस: 20,
  तीस: 30,
  चालीस: 40,
  पचास: 50,
  सौ: 100,
  हजार: 1000,
  दर्जन: 12,
  जोड़ी: 2,

  // Hinglish Roman transliterations
  ek: 1,
  ik: 1,
  do: 2,
  doo: 2,
  teen: 3,
  tin: 3,
  chaar: 4,
  char: 4,
  paanch: 5,
  panch: 5,
  chhe: 6,
  chheh: 6,
  saat: 7,
  sat: 7,
  aath: 8,
  ath: 8,
  nau: 9,
  nav: 9,
  das: 10,
  gyarah: 11,
  barah: 12,
  terah: 13,
  chaudah: 14,
  pandrah: 15,
  bees: 20,
  tees: 30,
  chalis: 40,
  chalees: 40,
  pachas: 50,
  pachaas: 50,
  sau: 100,
  so: 100,
  hazaar: 1000,
  hazar: 1000,
  k: 1000,
};

export const FRACTIONS: Record<string, number> = {
  half: 0.5,
  adha: 0.5,
  aadha: 0.5,
  आधा: 0.5,
  quarter: 0.25,
  pauna: 0.75,
  पौना: 0.75,
  sawa: 1.25,
  सवा: 1.25,
  dedh: 1.5,
  dehd: 1.5,
  डेढ़: 1.5,
  dhai: 2.5,
  dhaye: 2.5,
  ढाई: 2.5,
};

// Domain Keywords for Classification & Extraction
export const DOMAIN_KEYWORDS = {
  tailoring: [
    'kurta', 'kurti', 'kameez', 'pyjama', 'pajama', 'salwar', 'blouse', 'saree', 'sari',
    'fall pico', 'fall-pico', 'pico', 'lehenga', 'choli', 'blazer', 'coat', 'pant', 'shirt',
    'suit', 'sherwani', 'dress', 'gown', 'fitting', 'alteration', 'stitching', 'zip',
    'button', 'collar', 'lining', 'astar', 'sleeve', 'chest', 'waist', 'length',
    'कुर्ता', 'कुर्ती', 'कमीज', 'पायजामा', 'सलवार', 'ब्लाउज', 'साड़ी', 'लहंगा', 'ब्लेज़र', 'सूट'
  ],
  bakery: [
    'cake', 'pastry', 'cupcake', 'brownie', 'cookies', 'biscuit', 'bread', 'pizza base',
    'chocolate', 'pineapple', 'vanilla', 'butterscotch', 'black forest', 'white forest',
    'red velvet', 'strawberry', 'mango', 'truffle', 'fondant', 'eggless', 'with egg',
    'kg', 'pound', 'half kg', 'photo cake', 'tier cake', 'bday', 'birthday', 'anniversary',
    'केक', 'पेस्ट्री', 'ब्राउनी', 'एगलेस', 'चॉकलेट', 'पाइनएप्पल'
  ],
  tiffin: [
    'tiffin', 'thali', 'dabba', 'meal', 'lunch', 'dinner', 'roti', 'chapati', 'sabji',
    'sabzi', 'dal', 'rice', 'chawal', 'paneer', 'paratha', 'curry', 'monthly', 'weekly',
    'veg', 'non-veg', 'jain', 'swaminarayan', 'breakfast', 'nashta',
    'टिफिन', 'थाली', 'डब्बा', 'रोटी', 'सब्जी', 'दाल', 'चावल', 'लंच', 'डिनर'
  ],
  electrical: [
    'wiring', 'fan', 'ceiling fan', 'geyser', 'switch', 'socket', 'mc switch', 'mcb',
    'inverter', 'motor', 'pump', 'fitting', 'repair', 'installation', 'light', 'bulb',
    'tube light', 'ac', 'cooler', 'short circuit', 'board', 'point',
    'वायरिंग', 'पंखा', 'गीजर', 'स्विच', 'सॉकेट', 'रिपेयर', 'फिटिंग'
  ]
};

// Common Measurement & Attribute Names
export const ATTRIBUTE_SYNONYMS: Record<string, string> = {
  chest: 'chest',
  chhati: 'chest',
  bust: 'chest',
  waist: 'waist',
  kamar: 'waist',
  length: 'length',
  lambi: 'length',
  height: 'length',
  sleeves: 'sleeve',
  sleeve: 'sleeve',
  astin: 'sleeve',
  aasteen: 'sleeve',
  collar: 'collar',
  gala: 'collar',
  neck: 'collar',
  shoulder: 'shoulder',
  tera: 'shoulder',
  hip: 'hip',
  seet: 'hip',
  seat: 'hip',
  size: 'size',
  naap: 'size',
  measurement: 'size',
  color: 'color',
  colour: 'color',
  rang: 'color',
  fabric: 'fabric',
  kapda: 'fabric',
  weight: 'weight',
  vajan: 'weight',
  flavor: 'flavor',
  flavour: 'flavor',
  taste: 'flavor',
  room: 'room',
  kamra: 'room',
  type: 'type',
  diet: 'diet',
  days: 'days',
  text: 'text',
  message: 'text',
  name_on_cake: 'text',
};

// Colors (English, Hindi, Hinglish)
export const COLOR_WORDS = [
  'navy blue', 'royal blue', 'sky blue', 'light blue', 'dark blue', 'blue',
  'bottle green', 'pista green', 'mint green', 'dark green', 'light green', 'green',
  'maroon', 'wine', 'burgundy', 'red', 'crimson',
  'black', 'jet black', 'white', 'off white', 'cream', 'ivory',
  'yellow', 'mustard', 'lemon', 'haldi',
  'pink', 'baby pink', 'rani pink', 'hot pink', 'gulabi',
  'orange', 'kesari', 'bhagwa', 'saffron', 'peach',
  'purple', 'violet', 'lavender', 'magenta',
  'brown', 'grey', 'gray', 'silver', 'gold', 'golden', 'beige',
  'kala', 'kaala', 'safed', 'neela', 'nila', 'hara', 'laal', 'lal', 'peela', 'pila',
  'गुलाबी', 'काला', 'सफेद', 'नीला', 'हरा', 'लाल', 'पीला', 'जामुनी', 'भूरा'
];

// Fabrics
export const FABRIC_WORDS = [
  'cotton', 'pure cotton', 'linen', 'silk', 'raw silk', 'chiffon', 'georgette',
  'crepe', 'satin', 'velvet', 'denim', 'khadi', 'rayon', 'organza', 'net',
  'brocade', 'wool', 'woollen', 'polyester', 'chikankari', 'chanderi', 'banarasi',
  'सूती', 'कॉटन', 'सिल्क', 'रेशम', 'खादी', 'जॉर्जेट'
];

// Reference to Prior Order Phrases
export const PRIOR_ORDER_PATTERNS = [
  /last time jaisa/i,
  /last time wala/i,
  /last time ki tarah/i,
  /pichli baar jaisa/i,
  /pichli baar ki tarah/i,
  /pichle order jaisa/i,
  /same as last time/i,
  /same as before/i,
  /repeat order/i,
  /same size/i,
  /same naap/i,
  /same measurement/i,
  /same design/i,
  /waisa hi bana do/i,
  /aur ek waisa/i,
  /ek aur waisa hi/i,
  /wahi wala/i,
  /पिछली बार जैसा/i,
  /पिछली बार की तरह/i,
  /पहले जैसा/i,
  /वही वाला/i
];
