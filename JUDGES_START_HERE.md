# 🏆 Vendora — Quick Start Guide for Judges
> **Bit N Build Hackathon** · **Track 3: Jan Jeevan** · **Team CodersMayCry**

Welcome! **Vendora** is a sovereign, offline-first order intake and ledger platform built for India's 63M+ grassroots merchants, kirana stores, and local businesses.

---

## ⏱️ 60-Second Evaluation Checklist

### 1. Test 100% Offline Capability
1. Open the application.
2. Turn off your Wi-Fi or enable **Airplane Mode** in Chrome DevTools (*Network* -> *Offline*).
3. Type or voice-input a colloquial order in the Universal Inbox:
   > *"Bhaiya Ramesh here. 2 kurta navy blue, chest 40, parso chahiye. total ₹1850, 500 advance diya."*
4. Click **Commit to Sovereign Ledger**. Notice instant (< 2ms) parsing, price calculations, customer extraction, and permanent offline saving!

### 2. Test Sovereign WhatsApp Business Intake Bridge
1. Navigate to **WhatsApp Live Desk** from the sidebar (`/whatsapp`).
2. **Physical Device Pairing**: Click **Pair WhatsApp** to generate a live QR code via Baileys multi-device WebSocket. Scan via WhatsApp (*Settings -> Linked Devices -> Link a Device*).
3. **Multi-Turn Burst Debounce Simulator**: Click **"Simulate Real-Time WhatsApp Burst"** to test without a phone.
   - Watch the **3.0s sliding debounce aggregator** display a live pulse indicator as 5 rapid fragmented messages arrive.
   - Watch it merge the chat turns, extract customer names, Devanagari numerals, relative dates (*parso*, *15 tarikh*), measurements (*chest 40*), and financial splits (*total ₹1800, advance ₹1800*).
   - If auto-reply is enabled, it sends an automated receipt back to the customer!

### 3. Run Automated Verification Suite
```bash
pnpm test
```
Validates:
- Universal NLP Parser accuracy across Indian colloquialisms
- Devanagari numerals & Hinglish date resolution
- Sovereign storage durability and local ledger consistency

---

## 📁 Repository Structure
- `artifacts/orders-app/`: Main React 19 offline-first web application
- `scripts/whatsapp-bridge.mjs`: Sovereign Baileys multi-device WhatsApp bridge & burst debouncer
- `lib/`: Shared parser and sovereign offline storage utilities
- `scripts/`: Verification, build, and presentation automation scripts

*Built with ❤️ for Bit N Build Hackathon 2026.*
