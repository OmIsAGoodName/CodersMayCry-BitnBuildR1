# 🏆 JanVyapar — Quick Start Guide for Judges
> **Bit N Build Hackathon** · **Track 3: Jan Jeevan** · **Team CodersMayCry**

Welcome! **JanVyapar** is a sovereign, offline-first order intake and ledger platform built for India's 63M+ grassroots merchants, kirana stores, and local businesses.

---

## ⏱️ 60-Second Evaluation Checklist

### 1. Test 100% Offline Capability
1. Open the application.
2. Turn off your Wi-Fi or enable **Airplane Mode** in Chrome DevTools (*Network* -> *Offline*).
3. Type or paste a colloquial order in the intake box:
   > *"Rajesh bhai ko 5 packet doodh aur 2 kilo cheeni kal sham 5 baje tak bhejo, advance 300 received"*
4. Click **Parse & Record**. Notice instant (< 2ms) parsing, price calculations, customer extraction, and permanent offline saving!

### 2. Run Automated Verification Suite
```bash
pnpm test
```
All 12 automated verification tests will run and pass, validating:
- Universal NLP Parser accuracy across Indian colloquialisms
- Hybrid Logical Clock (HLC) causality
- Conflict-Free Replicated Data Type (CRDT) merge convergence
- Sovereign storage durability

---

## 📁 Repository Structure
- `artifacts/orders-app/`: Main React 19 offline-first web application
- `artifacts/api-server/`: Synchronization and ledger coordination server
- `lib/`: Shared parser, CRDT sync, and storage utilities
- `scripts/`: Verification and build automation scripts

*Built with ❤️ for Bit N Build Hackathon 2026.*
