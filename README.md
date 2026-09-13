# Vendora — Sovereign Offline-First Commerce & Order Ledger for Bharat
> **Bit N Build Hackathon 2026** · **Track 3: Jan Jeevan (Technology for Everyday Life & Real-World Indian Challenges)**  
> **Team**: CodersMayCry  
> 🌐 **Live Cloud Deployment**: [https://vendora-bridge.onrender.com](https://vendora-bridge.onrender.com)  
> 🏆 **Judges / Evaluators**: Please refer to [**Guide for Judges**](GUIDE_FOR_JUDGES.md) for a brief guide, evaluation checklist, and demo credentials (`cookie` / `1111`).

---

## 👨‍⚖️ Guide for Judges & Quick Evaluation

Judges can see [**Guide for Judges**](GUIDE_FOR_JUDGES.md) for a brief evaluation walkthrough, architecture breakdown, and testing checklist:
- 🚀 **Live Web App**: [https://coders-may-cry-bitn-build-r1-api-se.vercel.app](https://coders-may-cry-bitn-build-r1-api-se.vercel.app)
- ⚡ **WhatsApp Cloud Bridge**: [https://vendora-bridge.onrender.com](https://vendora-bridge.onrender.com)
- 🔑 **Demo Login Credentials**:
  - **Username**: `cookie`
  - **Password**: `1111`
  *(Note: Vendora also operates 100% locally with zero login required!)*
- 📖 **Full Evaluation Checklist**: See [**Guide for Judges**](GUIDE_FOR_JUDGES.md)

---

## 🇮🇳 Problem Statement (Track 3 — Jan Jeevan)

Over **63 million micro-enterprises, kirana store owners, mandi traders, and rural service providers** across India power the nation's grassroots economy. However, they face acute daily operational bottlenecks:
1. **Unreliable & Intermittent Connectivity**: Tier-2/Tier-3 towns and rural mandis frequently suffer network dropouts where cloud-only SaaS tools fail completely.
2. **Linguistic & Interface Friction**: Existing ERP/inventory software forces rigid English forms and nested dropdowns, failing to parse fast-paced colloquial Indian orders (Hinglish, Hindi numerals, regional measurements like *kilo, packet, peti, darjan*).
3. **Data Sovereignty & Vendor Lock-in**: Small merchants risk losing operational data during outages or subscription locks. They need an independent, sovereign local ledger that works 100% offline without mandatory cloud accounts.

---

## 💡 The Solution: Vendora

**Vendora** is an ultra-fast, offline-first sovereign order intake and ledger platform built specifically for Indian everyday commerce.

- **100% Offline Universal Parser**: Sub-2ms on-device deterministic NLP parser capable of understanding colloquial order messages, Hinglish terms, Hindi numerals (०-९), colloquial relative dates (*kal sham tak, parso subah*), and multi-item lists without requiring any internet connection.
- **Sovereign Local-First Database**: Runs directly on browser IndexedDB with an atomic local-storage operation log fallback. Zero sign-up required, zero downtime.
- **Distributed CRDT Synchronization**: State-based Last-Write-Wins (LWW) conflict-free replicated data type with Hybrid Logical Clocks (HLC) ensuring smooth peer-to-peer and client-cloud sync whenever connectivity is available.
- **Local-First AI Assistance**: DeepSeek-R1 / Gemini local or cloud-assisted natural language processing with seamless fallback to rule-based parser.
- **Multi-Device Live Sync**: Seamless synchronization across merchant counters, delivery partners, and back-office devices.

---

## 🛠️ Technology Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons, Radix UI, Sonner Toast, Framer Motion
- **Parsing Engine**: Zero-dependency Deterministic Rule-based Tokenizer & Semantic Parser (< 2ms execution)
- **Local Database**: IndexedDB with synchronous localStorage oplog & backup
- **Sync Architecture**: State-based LWW-CRDT with Hybrid Logical Clocks (HLC)
- **API & Cloud Sync Server**: Node.js, Express, TypeScript, REST & Event endpoints
- **Testing**: End-to-end multi-scenario automated test suite

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js >= 20.0.0
- pnpm >= 9.0.0 (or npm)

### Installation
```bash
# Install dependencies
pnpm install
```

### Running the App
```bash
# Start the full stack development environment
pnpm run dev
```
Open your browser at [http://localhost:5173](http://localhost:5173) to access the application.

### Running Verification Tests
```bash
# Run all automated tests (Parser, CRDT, Storage, Date Resolver)
pnpm test
```

On Windows, you can also double-click:
- `start.bat` to launch the application
- `test.bat` to execute the verification suite

---

## 👥 Team CodersMayCry — Bit N Build Hackathon
