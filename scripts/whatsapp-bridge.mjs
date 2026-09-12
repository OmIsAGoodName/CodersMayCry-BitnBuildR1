import path from 'node:path';
import fs from 'node:fs';
import { EventEmitter } from 'node:events';
import QRCode from 'qrcode';
import qrcodeTerminal from 'qrcode-terminal';
import pino from 'pino';
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers,
} from '@whiskeysockets/baileys';

// --- Indian Colloquial & Hindi Parsing Helpers ---
const HINDI_DIGITS = { '०': '0', '१': '1', '२': '2', '३': '3', '४': '4', '५': '5', '६': '6', '७': '7', '८': '8', '९': '9' };

const NUMBER_WORDS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  ek: 1, do: 2, teen: 3, char: 4, chaar: 4, paanch: 5, chhe: 6, saat: 7, aath: 8, nau: 9, das: 10,
  एक: 1, दो: 2, तीन: 3, चार: 4, पांच: 5, छह: 6, सात: 7, आठ: 8, नौ: 9, दस: 10, बीस: 20
};

export function normalizeHindiDigits(text) {
  let result = text;
  for (const [h, a] of Object.entries(HINDI_DIGITS)) result = result.split(h).join(a);
  return result;
}

export function formatISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function resolveColloquialDate(rawText, baseDate = new Date()) {
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

export function cleanName(raw) {
  return raw
    .replace(/[.,:;!?\n\r]/g, ' ')
    .replace(/\b(bhaiya|uncle|didi|sir|madam|ji|namaste|hello|hi|order|chahiye|bol|rahi|raha|hu|hai|kardo|karna|here|calling|speaking|this side|se)\b/gi, '')
    .trim();
}

export function isValidName(name) {
  if (!name || name.length < 2 || name.length > 35) return false;
  if (/^\d+$/.test(name)) return false;
  if (/^(kurta|cake|tiffin|wiring|order|help|urgent|urgently|please|plz|delivery)$/i.test(name)) return false;
  return true;
}

export function extractCustomerName(rawText) {
  const text = rawText.trim();
  const hereMatch = text.match(/(?:^|[.!?\n\s])(?:bhaiya\s+|ji\s+)?([A-Za-z\u0900-\u097F]+)\s+(?:here|this side|speaking|calling|bol raha|bol rahi)/i);
  if (hereMatch) {
    const candidate = cleanName(hereMatch[1]);
    if (isValidName(candidate)) return candidate;
  }
  const mainMatch = text.match(/(?:^|[.!?\n\s])(?:main|mein|mera naam|i am|this is|my name is|मैं)\s+([A-Za-z\u0900-\u097F]+(?:\s+[A-Za-z\u0900-\u097F]+)?)/i);
  if (mainMatch) {
    const candidate = cleanName(mainMatch[1]);
    if (isValidName(candidate)) return candidate;
  }
  const signoffMatch = text.match(/(?:[-—–~]|regards,?|thanks,?|from:?)\s*([A-Za-z\u0900-\u097F]+(?:\s+[A-Za-z\u0900-\u097F]+)?)\s*$/i);
  if (signoffMatch) {
    const name = cleanName(signoffMatch[1]);
    if (isValidName(name)) return name;
  }
  return null;
}

export function parseWhatsAppMessage(rawMessage, senderName = null, baseDate = new Date()) {
  const norm = normalizeHindiDigits(rawMessage.trim());
  const lower = norm.toLowerCase();
  let customer = extractCustomerName(norm);
  if (!customer && senderName && isValidName(cleanName(senderName))) {
    customer = cleanName(senderName);
  }
  let quantity = 1;
  const qtyMatch = norm.match(/\b(?:qty|quantity|pcs|pieces?|x)\s*[:=\-]?\s*(\d+|[a-zA-Z\u0900-\u097F]+)\b/i)
    || norm.match(/(?:^|[^\d])(\d{1,3})\s+(?=[a-zA-Z\u0900-\u097F]+)/i);
  if (qtyMatch) {
    const v = qtyMatch[1].toLowerCase();
    if (/^\d+$/.test(v)) quantity = parseInt(v, 10);
    else if (NUMBER_WORDS[v]) quantity = NUMBER_WORDS[v];
  }
  const due_date = resolveColloquialDate(norm, baseDate);
  let amount = null;
  const amountMatch = norm.match(/(?:₹|rs\.?|inr|rupees?|rupaye|रुपये)\s*([\d,]+(?:\.\d+)?)/i)
    || norm.match(/([\d,]+(?:\.\d+)?)\s*(?:₹|rs\.?|inr|rupees?|rupaye|रुपये)/i)
    || norm.match(/\b(?:total|bill|rate)\s*[:=\-]?\s*(?:₹|rs\.?)?\s*([\d,]+)/i);
  if (amountMatch) amount = parseFloat(amountMatch[1].replace(/,/g, '')) || null;

  let paidAmount = 0;
  const paidMatch = norm.match(/(?:advance|paid|de diya|pay kiya|gpay|phonepe|paytm|cash diya)\s*[:=\-]?\s*(?:₹|rs\.?)?\s*([\d,]+)/i)
    || norm.match(/(?:₹|rs\.?)?\s*([\d,]+)\s*(?:advance|paid|de diya|pay kiya|gpay|phonepe|paytm|cash diya)/i);
  if (paidMatch) {
    paidAmount = parseFloat(paidMatch[1].replace(/,/g, '')) || 0;
    if (amount === null) amount = paidAmount;
  }

  const references_prior_order = /last time|pichli baar|same as before|repeat order|same naap|waisa hi|पिछली बार/i.test(lower);
  const attributes = {};
  const chestMatch = lower.match(/\b(?:chest|chhati)\s*[:=\-]?\s*(\d{2})/i) || lower.match(/(?:kurta|shirt|blazer)[^,\n]*?,\s*(\d{2})\b/i);
  if (chestMatch) attributes.chest = chestMatch[1];
  const sizeMatch = lower.match(/\b(?:size|waist|length|sleeve)\s*[:=\-]?\s*(\d{1,3}|xl|l|m|s)\b/i);
  if (sizeMatch) attributes.size = sizeMatch[1];
  const colorMatch = lower.match(/\b(navy blue|royal blue|bottle green|teal|maroon|black|white|yellow|pink|kala|safed|laal|neela|hara|peela)\b/i);
  if (colorMatch) attributes.color = colorMatch[1];
  const fabricMatch = lower.match(/\b(cotton|silk|linen|chiffon|georgette|velvet|satin)\b/i);
  if (fabricMatch) attributes.fabric = fabricMatch[1];

  let description = 'Customer order';
  const descMatch = norm.match(/\b(?:[a-zA-Z\u0900-\u097F\s]{0,15}(?:kurta|kameez|blouse|saree|blazer|suit|pant|cake|pastry|thali|tiffin|wiring|fan|geyser)[a-zA-Z\u0900-\u097F\s]{0,20})\b/i);
  if (descMatch) {
    description = descMatch[0].replace(/\b(chahiye|bana do|karna hai|please|plz|urgent|urgently|jaldi|bhaiya|ji|sir|madam)\b/gi, '').replace(/[.,]/g, '').trim();
  }

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
    items: [{ description: description || 'Customer order', quantity: Math.max(1, quantity), attributes }],
    due_date: due_date || null,
    amount,
    paidAmount,
    references_prior_order,
    confidence,
    needs_clarification,
  };
}

// --- WhatsApp Bridge Service Class ---
export class WhatsAppBridgeService extends EventEmitter {
  constructor() {
    super();
    this.status = 'disconnected'; // 'disconnected' | 'connecting' | 'qr_ready' | 'connected'
    this.qrCodeRaw = null;
    this.qrCodeDataUrl = null;
    this.connectedNumber = null;
    this.connectedName = null;
    this.sock = null;
    this.authFolder = path.resolve(process.cwd(), '.whatsapp_auth');
    this.autoReply = false;
    this.autoIngestThreshold = 0.75;
    this.recentMessages = [];

    // Burst debounce buffer map: senderPhone -> buffer state
    this.messageBuffers = new Map();
    this.DEBOUNCE_MS = 3000;
  }

  getStatus() {
    return {
      status: this.status,
      qrDataUrl: this.qrCodeDataUrl,
      qrRaw: this.qrCodeRaw,
      connectedNumber: this.connectedNumber,
      connectedName: this.connectedName,
      autoReply: this.autoReply,
      autoIngestThreshold: this.autoIngestThreshold,
      recentCount: this.recentMessages.length,
      activeBufferCount: this.messageBuffers.size,
    };
  }

  getRecentMessages() {
    return this.recentMessages;
  }

  setSettings({ autoReply, autoIngestThreshold }) {
    if (typeof autoReply === 'boolean') this.autoReply = autoReply;
    if (typeof autoIngestThreshold === 'number') this.autoIngestThreshold = autoIngestThreshold;
    this.emit('settings', this.getStatus());
  }

  async start() {
    if (this.sock && this.status === 'connected') return;
    try {
      this.status = 'connecting';
      this.emit('status', this.getStatus());

      if (!fs.existsSync(this.authFolder)) {
        fs.mkdirSync(this.authFolder, { recursive: true });
      }

      const { state, saveCreds } = await useMultiFileAuthState(this.authFolder);
      const { version } = await fetchLatestBaileysVersion();
      const logger = pino({ level: 'silent' });

      this.sock = makeWASocket({
        version,
        auth: state,
        logger,
        printQRInTerminal: false,
        browser: Browsers.ubuntu('Chrome'),
        syncFullHistory: false,
        generateHighQualityLinkPreview: false,
      });

      this.sock.ev.on('creds.update', saveCreds);

      this.sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          this.qrCodeRaw = qr;
          this.status = 'qr_ready';
          try {
            this.qrCodeDataUrl = await QRCode.toDataURL(qr, { margin: 4, scale: 8, color: { dark: '#000000', light: '#ffffff' } });
          } catch (err) {
            console.error('QR Data URL error:', err);
          }
          try {
            qrcodeTerminal.generate(qr, { small: true });
          } catch {}
          this.emit('qr', { qrRaw: qr, qrDataUrl: this.qrCodeDataUrl });
          this.emit('status', this.getStatus());
        }

        if (connection === 'close') {
          const isLoggedOut = (lastDisconnect?.error)?.output?.statusCode === DisconnectReason.loggedOut;
          this.status = 'disconnected';
          this.qrCodeRaw = null;
          this.qrCodeDataUrl = null;
          this.connectedNumber = null;
          this.connectedName = null;
          this.emit('status', this.getStatus());

          if (isLoggedOut) {
            try {
              if (fs.existsSync(this.authFolder)) fs.rmSync(this.authFolder, { recursive: true, force: true });
            } catch {}
            setTimeout(() => this.start(), 2000);
          } else {
            setTimeout(() => this.start(), 2500);
          }
        } else if (connection === 'open') {
          this.status = 'connected';
          this.qrCodeRaw = null;
          this.qrCodeDataUrl = null;
          const userJid = this.sock.user?.id || '';
          this.connectedNumber = userJid.split(':')[0] || userJid.split('@')[0];
          this.connectedName = this.sock.user?.name || 'WhatsApp Business User';
          this.emit('status', this.getStatus());
        }
      });

      this.sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        for (const msg of messages) {
          if (!msg.message || msg.key.fromMe) continue;

          const messageText = msg.message.conversation
            || msg.message.extendedTextMessage?.text
            || msg.message.imageMessage?.caption
            || '';

          if (!messageText.trim()) continue;

          const senderJid = msg.key.remoteJid || '';
          const senderPhone = senderJid.split('@')[0];
          const pushName = msg.pushName || null;
          const timestamp = Number(msg.messageTimestamp) * 1000 || Date.now();

          this.queueIncomingMessage({
            id: msg.key.id || `msg_${Date.now()}`,
            text: messageText,
            phone: `+${senderPhone}`,
            rawPhone: senderPhone,
            senderJid,
            pushName,
            timestamp,
          });
        }
      });
    } catch (err) {
      console.error('Failed to init WhatsApp socket:', err);
      this.status = 'disconnected';
      this.emit('status', this.getStatus());
    }
  }

  queueIncomingMessage({ id, text, phone, rawPhone, senderJid, pushName, timestamp }) {
    let buffer = this.messageBuffers.get(phone);

    if (buffer) {
      clearTimeout(buffer.timer);
      buffer.messages.push({ id, text, timestamp });
      buffer.lastTimestamp = timestamp;
      if (pushName && !buffer.pushName) buffer.pushName = pushName;
    } else {
      buffer = {
        phone,
        rawPhone,
        senderJid,
        pushName,
        lastTimestamp: timestamp,
        messages: [{ id, text, timestamp }],
        timer: null,
      };
      this.messageBuffers.set(phone, buffer);
    }

    this.emit('chat_activity', {
      type: 'aggregating',
      phone,
      pushName: buffer.pushName || 'Customer',
      messageCount: buffer.messages.length,
      messages: buffer.messages.map((m) => m.text),
      preview: buffer.messages.map((m) => m.text).join(' • '),
    });

    buffer.timer = setTimeout(() => {
      this.flushMessageBuffer(phone);
    }, this.DEBOUNCE_MS);
  }

  async flushMessageBuffer(phone) {
    const buffer = this.messageBuffers.get(phone);
    if (!buffer || buffer.messages.length === 0) return;

    this.messageBuffers.delete(phone);

    const combinedText = buffer.messages
      .map((m) => m.text.trim().replace(/[.!?]+$/, ''))
      .join('. ') + '.';

    const parsed = parseWhatsAppMessage(combinedText, buffer.pushName, new Date(buffer.lastTimestamp));

    const orderPayload = {
      messageId: buffer.messages[0].id,
      rawMessage: combinedText,
      rawMessages: buffer.messages.map((m) => m.text),
      messageCount: buffer.messages.length,
      phone: buffer.phone,
      pushName: buffer.pushName,
      timestamp: buffer.lastTimestamp,
      receivedAt: new Date(buffer.lastTimestamp).toISOString(),
      parsed: {
        customer: parsed.customer || buffer.pushName || 'WhatsApp Customer',
        phone: buffer.phone,
        items: parsed.items,
        due_date: parsed.due_date,
        dueDate: parsed.due_date,
        amount: parsed.amount,
        paidAmount: parsed.paidAmount || 0,
        status: 'new',
        referencesPriorOrder: parsed.references_prior_order,
        confidence: parsed.confidence,
        needsClarification: parsed.needs_clarification,
      },
      autoIngested: parsed.confidence >= this.autoIngestThreshold && !parsed.needs_clarification,
    };

    this.recentMessages.unshift(orderPayload);
    if (this.recentMessages.length > 100) this.recentMessages.pop();

    this.emit('message', orderPayload);

    if (this.autoReply && this.sock && buffer.senderJid && parsed.customer && !parsed.needs_clarification) {
      try {
        const itemNames = parsed.items.map((i) => `${i.quantity}x ${i.description}`).join(', ');
        const replyText = `🙏 Namaste ${parsed.customer} ji!\n\nOrder recorded:\n📦 Items: ${itemNames}\n📅 Due Date: ${parsed.due_date || 'Standard'}\n💰 Total: ${parsed.amount ? `₹${parsed.amount}` : 'As discussed'}${parsed.paidAmount ? ` (Advance: ₹${parsed.paidAmount})` : ''}\n\nThank you! We will update you once it is ready.`;
        await this.sock.sendMessage(buffer.senderJid, { text: replyText });
      } catch (err) {
        console.warn('Auto-reply failed:', err);
      }
    }
  }

  async simulateMessage(input, senderPhone = '+919876543210', pushName = 'Ramesh Kumar') {
    const rawPhone = senderPhone.replace(/\D/g, '');
    const senderJid = `${rawPhone}@s.whatsapp.net`;
    const lines = Array.isArray(input) ? input : input.split(/[\r\n]+/).map((l) => l.trim()).filter(Boolean);

    for (const line of lines) {
      this.queueIncomingMessage({
        id: `sim_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        text: line,
        phone: senderPhone,
        rawPhone,
        senderJid,
        pushName,
        timestamp: Date.now(),
      });
    }

    return { success: true, count: lines.length };
  }

  async disconnect() {
    if (this.sock) {
      try { await this.sock.logout(); } catch {}
      try { this.sock.end(undefined); } catch {}
      this.sock = null;
    }
    if (fs.existsSync(this.authFolder)) {
      try { fs.rmSync(this.authFolder, { recursive: true, force: true }); } catch {}
    }
    this.status = 'disconnected';
    this.qrCodeRaw = null;
    this.qrCodeDataUrl = null;
    this.connectedNumber = null;
    this.connectedName = null;
    this.emit('status', this.getStatus());
  }
}

export const whatsappBridge = new WhatsAppBridgeService();

// --- SSE Client Hub ---
const sseClients = new Set();

whatsappBridge.on('status', (data) => {
  const payload = `event: status\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try { client.write(payload); } catch {}
  }
});

whatsappBridge.on('qr', (data) => {
  const payload = `event: qr\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try { client.write(payload); } catch {}
  }
});

whatsappBridge.on('message', (data) => {
  const payload = `event: message\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try { client.write(payload); } catch {}
  }
});

whatsappBridge.on('chat_activity', (data) => {
  const payload = `event: chat_activity\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try { client.write(payload); } catch {}
  }
});

// --- HTTP Request Handler for Vite / Express / Node HTTP ---
export async function handleWhatsAppHttpRequest(req, res, next) {
  const url = req.url || '';
  if (!url.startsWith('/api/whatsapp')) {
    if (typeof next === 'function') return next();
    return false;
  }

  const parsedUrl = new URL(url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;
  const method = (req.method || 'GET').toUpperCase();

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return true;
  }

  // 1. SSE Stream
  if (pathname === '/api/whatsapp/stream' && method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*',
    });

    // Send initial status
    const status = whatsappBridge.getStatus();
    res.write(`event: status\ndata: ${JSON.stringify(status)}\n\n`);

    if (whatsappBridge.qrCodeRaw && whatsappBridge.qrCodeDataUrl) {
      res.write(`event: qr\ndata: ${JSON.stringify({ qrRaw: whatsappBridge.qrCodeRaw, qrDataUrl: whatsappBridge.qrCodeDataUrl })}\n\n`);
    }

    sseClients.add(res);

    req.on('close', () => {
      sseClients.delete(res);
    });
    return true;
  }

  // Helper to read JSON request body
  const readJsonBody = async () => {
    return new Promise((resolve) => {
      let data = '';
      req.on('data', (chunk) => { data += chunk; });
      req.on('end', () => {
        try { resolve(JSON.parse(data || '{}')); }
        catch { resolve({}); }
      });
    });
  };

  // 2. Status
  if (pathname === '/api/whatsapp/status' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(whatsappBridge.getStatus()));
    return true;
  }

  // 3. Recent Messages
  if (pathname === '/api/whatsapp/recent' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ messages: whatsappBridge.getRecentMessages() }));
    return true;
  }

  // 4. Connect
  if (pathname === '/api/whatsapp/connect' && method === 'POST') {
    whatsappBridge.start().catch((err) => console.error('Bridge start error:', err));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, status: whatsappBridge.status }));
    return true;
  }

  // 5. Disconnect
  if (pathname === '/api/whatsapp/disconnect' && method === 'POST') {
    await whatsappBridge.disconnect();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, status: 'disconnected' }));
    return true;
  }

  // 6. Settings
  if (pathname === '/api/whatsapp/settings' && method === 'POST') {
    const body = await readJsonBody();
    whatsappBridge.setSettings(body);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, settings: whatsappBridge.getStatus() }));
    return true;
  }

  // 7. Test Message Simulator
  if (pathname === '/api/whatsapp/test-message' && method === 'POST') {
    const body = await readJsonBody();
    const result = await whatsappBridge.simulateMessage(body.text, body.phone, body.name);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, result }));
    return true;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not Found' }));
  return true;
}
