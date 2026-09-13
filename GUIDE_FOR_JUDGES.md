# Guide for Judges
> **Bit N Build Hackathon 2026** · **Track 3: Jan Jeevan (Everyday Indian Life & Micro-Commerce)** · **Team CodersMayCry**

Welcome! **Vendora** is a sovereign, offline-first order intake and financial ledger platform purpose-built for India's 63M+ grassroots micro-merchants, kiranas, tailors, and local service providers.

---

## 🌐 Live Deployments & Instant Access
- 🚀 **Live Web Application (Vercel)**: [https://coders-may-cry-bitn-build-r1-api-se.vercel.app](https://coders-may-cry-bitn-build-r1-api-se.vercel.app)
- ⚡ **WhatsApp Cloud Bridge (Render)**: [https://vendora-bridge.onrender.com](https://vendora-bridge.onrender.com)
- 🧪 **Local Dev Server**: `http://localhost:5173/`

---

## 🔑 Demo Account Login Credentials
For judging & evaluating the multi-employee RBAC, team collaboration, and cloud sync capabilities:
- **Username**: `cookie`
- **Password**: `1111`

> 💡 **Note**: Vendora also works **100% locally with zero login required**! You can simply test all parsing, order ingestion, and sovereign ledger operations right out of the box on the local sovereign database without logging in. Use these credentials to test multi-device synchronization and store team management.

---

## ⏱️ 3-Minute Evaluation Checklist for Judges

### 1. 100% Offline Capability (Airplane Mode Test)
1. Open the application.
2. Turn off Wi-Fi or toggle **Airplane Mode / Offline** in Chrome DevTools (*Inspect -> Network -> Offline*).
3. Type or voice-record an Indian colloquial order in the **Universal Inbox** (`/inbox`):
   > *"Bhaiya Ramesh here. 2 kurta navy blue, chest 40, parso chahiye. total ₹1850, 500 advance diya."*
4. Click **Commit to Sovereign Ledger**.
   - Notice instant (< 2ms) sub-zero latency parsing, date translation (*parso* -> exact ISO date), measurement extraction (*chest 40*), and offline persistence via IndexedDB.

### 2. Dual-Engine Online AI with Automatic Groq Failover
1. In the **Intake Controls** bar at the top of the Inbox or WhatsApp Desk:
   - Notice the **Engine Selector**: Choose between **⚡ Groq Ultra-Fast (14,400 req/day)**, **⚡ Google Gemini 3.6 Flash**, or **🛡️ Sovereign Local Engine**.
   - If Google Gemini reaches free tier quota limits (HTTP 429), Vendora **automatically and seamlessly fails over to Groq's high-throughput LLaMA/Qwen model** with an explicit on-screen badge so merchant operations never halt!

### 3. Privacy Keyword Gate (`order` filter)
1. Toggle the **Keyword Gate** switch in the Intake Controls bar.
2. When active, domestic/casual chatter (*"Hi mummy kaisa hai"* or *"What is the score?"*) is safely ignored.
3. Commercial orders starting with `"order"` (*"order 2kg atta total 120"*) are ingested with 100% precision, protecting personal privacy on shared family phones.

### 4. Sovereign WhatsApp Business Intake Bridge (`/whatsapp`)
1. **Device Pairing**: Click **Pair WhatsApp** to generate a live QR code via Baileys multi-device WebSocket protocol.
2. **Multi-Turn Burst Debounce Simulator**: Click **"Simulate Real-Time WhatsApp Burst"** to test without a physical phone:
   - Watch the **3.0s sliding debounce aggregator** display a live pulse indicator as 5 rapid fragmented messages arrive.
   - Automatically merges chat turns, extracts customer names, clean Indian mobile numbers (`+91 XXXXX XXXXX`), Devanagari numerals, relative dates, and financial splits.
   - Dispatches automated customer receipts if auto-reply is toggled!

### 5. Printable Ledger & Selective PDF Statement (`/` and `/orders`)
1. On the Home Dashboard or Orders Ledger, click **"🖨️ Print Ledger (PDF)"**.
2. **Selective Order Printing**:
   - Check/uncheck individual customer orders or click **"Only with Dues"** to isolate pending balances.
   - Watch the 4 summary KPI cards (Gross Value, Advance Paid, Balance Due) recompute in real-time for your selection.
3. Click **"Print X Selected Orders (PDF)"**:
   - Generates an ink-efficient A4 landscape statement document formatted for Indian merchant tax/accounting records, complete with customer details, measurements, balance dues, and an authorized signature/seal box.
4. Click **"Export CSV"** for 1-click export to Microsoft Excel or Tally.

---

## 🧪 Automated Verification Suite
Run the 100% automated test suite from the terminal:
```bash
pnpm test
```
**Test Coverage:**
- ✅ Indian Colloquial Date Resolution (*aaj*, *kal*, *parso*, *tarso*, *15 tarikh*)
- ✅ Universal Message NLP Parser & `schema.json` Strict Contract
- ✅ Deterministic CRDT Multi-Device Sync Convergence (Scenario 1 & Scenario 2)
- ✅ Offline Operational Query Layer (Due today, overdue, debt balances)

---

## 📁 Repository Architecture
```
artifacts/orders-app/      -> React 19 + TypeScript + Vite offline-first PWA
artifacts/orders-app/src/
  ├── components/
  │   ├── PrintableLedgerModal.tsx -> Selective PDF statement generator & print view
  │   ├── WhatsAppDesk.tsx         -> WhatsApp live device bridge & burst simulator
  │   ├── QueryDesk.tsx            -> Natural language offline query desk
  │   └── OrgHeader.tsx            -> Store switcher & team RBAC header
  ├── lib/
  │   ├── parser/hybridParser.ts   -> Dual Gemini + Groq AI parser with auto-failover
  │   ├── storage/offlineDb.ts     -> Sovereign IndexedDB schema & CRDT oplog
  │   └── sync/offlineSyncManager.ts -> Background multi-peer Supabase synchronization
scripts/
  ├── whatsapp-bridge.mjs          -> Baileys WebSocket bridge server with sliding debounce
  └── test-all.mjs                 -> Comprehensive test suite runner
```

*Built with ❤️ for Bit N Build Hackathon 2026 by Team CodersMayCry.*
