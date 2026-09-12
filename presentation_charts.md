# 📊 Vendora — Presentation Flowcharts (User Flow & Data Flow)

> Designed for PPT slides, pitch decks, and technical evaluation.  
> You can paste the Mermaid diagrams below directly into [Mermaid Live Editor](https://mermaid.live) to export transparent high-res PNG/SVG images, or copy the PPT text blocks into your slides.

---

## 1. User Flow Diagram (Operational Lifecycle)

```mermaid
flowchart TD
    Start["🏪 Customer Arrives / Sends Message"] --> InputType{"Input Channel"}

    InputType -->|🎤 Audio / Mic| Voice["Live Voice Intake<br/>MediaRecorder / Speech Engine"]
    InputType -->|💬 Text / WhatsApp| Text["Raw Text / WhatsApp Paste<br/>Hinglish, Roman, Devanagari"]
    InputType -->|➕ Manual Counter| Manual["Quick Add Modal<br/>Direct Manual Form Entry"]

    Voice --> Parse["⚡ Hybrid NLP Parser<br/>Extracts: Customer, Items, Due Date, ₹ Amount"]
    Text --> Parse

    Parse --> Review{"Confidence Check<br/>Needs Clarification?"}

    Review -->|⚠️ Missing Details| Flag["Flagged in Yellow<br/>Operator Corrects Field"]
    Flag --> Commit
    Review -->|✅ High Confidence| Commit["1-Tap: Commit to Sovereign Ledger"]
    Manual --> Commit

    Commit --> Storage[("💾 Local Sovereign IndexedDB<br/>Immediate 0ms Persistence")]

    Storage --> Ledger["📋 Orders Ledger & Kanban<br/>Filter: New → In Progress → Ready → Delivered"]

    Ledger --> Settle["💰 Cash Collection / Mark Paid<br/>Records Outstanding Balance / Khata"]

    Storage --> QueryDesk["🔍 Natural Language Query Desk<br/>Voice/Text: 'Aaj kya deliver karna hai?'<br/>Instant Filter & Balance Tally"]

    subgraph TeamCollaboration ["👥 Multi-User Team Sync"]
        Storage -.-> Sync["🔄 Background Cloud Sync<br/>Auto-flushes queued mutations"]
        Sync -.-> Supabase[("☁️ Supabase Cloud DB")]
        Supabase -.-> Employees["📲 Team Member / Employee Devices<br/>Role-Secured: Owner / Manager / Operator"]
    end

    classDef startNode fill:#1E293B,stroke:#3B82F6,stroke-width:2px,color:#F8FAFC;
    classDef actionNode fill:#151D2D,stroke:#38BDF8,stroke-width:1.5px,color:#F8FAFC;
    classDef decisionNode fill:#1E293B,stroke:#F59E0B,stroke-width:1.5px,color:#F8FAFC;
    classDef successNode fill:#064E3B,stroke:#10B981,stroke-width:2px,color:#ECFDF5;
    classDef queryNode fill:#312E81,stroke:#818CF8,stroke-width:1.5px,color:#EEF2FF;

    class Start startNode;
    class InputType,Review decisionNode;
    class Voice,Text,Manual,Parse,Flag,Commit,Ledger,Settle,Sync,Employees actionNode;
    class Storage,Supabase successNode;
    class QueryDesk queryNode;
```

---

## 2. PPT Slide Ready: User Flow (Text & Block Format)

Copy-paste this directly into a 4-column PPT slide:

```
┌────────────────────────┐      ┌────────────────────────┐      ┌────────────────────────┐      ┌────────────────────────┐
│  1. INTAKE & PARSE     │  ──> │  2. 0ms LOCAL COMMIT   │  ──> │  3. FULFILLMENT        │  ──> │  4. QUERY & SYNC       │
├────────────────────────┤      ├────────────────────────┤      ├────────────────────────┤      ├────────────────────────┤
│ • Voice Mic / Audio    │      │ • Instant Structured   │      │ • Kanban Progression:  │      │ • Natural Voice Desk:  │
│ • WhatsApp / SMS Paste │      │   Review (Name, Date,  │      │   New → Progress →     │      │   "Aaj kya deliver     │
│ • Hinglish, Numerals & │      │   Items, ₹ Amount)     │      │   Ready → Delivered    │      │   karna hai?"          │
│   Devanagari Parsing   │      │ • 1-Tap Save to        │      │ • Payment Settle:      │      │ • Auto Cloud Backup    │
│ • Hybrid AI + Heuristic│      │   Sovereign IndexedDB  │      │   Advance / Balance    │      │   to Supabase when     │
│   (Zero lock-in)       │      │ • 100% Offline Capable │      │   Tracking (Khata)     │      │   Internet reconnects  │
└────────────────────────┘      └────────────────────────┘      └────────────────────────┘      └────────────────────────┘
```

---

## 3. Data Flow Diagram (Architectural Pipeline)

```mermaid
flowchart LR
    subgraph ClientLayer ["Client & Device Layer (PWA)"]
        UI["🖥️ Responsive Web App / PWA"]
        Mic["🎙️ Web Speech API / MediaRecorder"]
        NetworkCheck["📶 navigator.onLine Detector"]
    end

    subgraph ProcessingLayer ["Hybrid Intelligence & Parsing Tier"]
        Normalizer["🔤 Transliteration & Date Normalizer<br/>Devanagari, 'Parso', 'Kal', Currency"]
        LocalNLP["⚡ 0ms Heuristics & RegEx Parser<br/>Works 100% Offline"]
        CloudAI["✨ Managed Cloud AI<br/>Gemini 2.5 Flash / Groq"]
        QueryEngine["🧠 Operational Search Engine<br/>Intent Matching & Metric Aggregator"]
    end

    subgraph SovereignStorage ["Sovereign Client Storage (Single Source of Truth)"]
        IDB[("💾 Browser IndexedDB<br/>Orders, Settings, Team")]
        WAL[("📝 Local Write-Ahead Log<br/>Pending Mutations Queue")]
    end

    subgraph CloudLayer ["Cloud Synchronization Tier"]
        OfflineManager["🔄 OfflineSyncManager<br/>Flush & Pull Engine"]
        Supabase[("☁️ Supabase PostgreSQL<br/>Multi-Tenant Store Ledger")]
    end

    Mic -->|Raw Audio Stream| CloudAI
    UI -->|Raw Message Text| Normalizer
    Normalizer -->|Online Mode| CloudAI
    Normalizer -->|Offline / Fallback| LocalNLP

    CloudAI -->|Structured JSON| UI
    LocalNLP -->|Structured JSON| UI

    UI -->|Save / Edit Order| IDB
    UI -->|Enqueue Mutation| WAL

    UI -->|Operational Question| QueryEngine
    QueryEngine <-->|Sub-2ms In-Memory Scan| IDB

    NetworkCheck -->|Online Detected| OfflineManager
    WAL -->|Read Pending Ops| OfflineManager
    OfflineManager -->|HTTPS / WSS Push| Supabase
    Supabase -->|Pull Remote Changes| OfflineManager
    OfflineManager -->|Merge to Local Ledger| IDB

    classDef clientTier fill:#0F172A,stroke:#38BDF8,stroke-width:2px,color:#F8FAFC;
    classDef logicTier fill:#1E1B4B,stroke:#818CF8,stroke-width:2px,color:#F8FAFC;
    classDef localDataTier fill:#064E3B,stroke:#10B981,stroke-width:2px,color:#F8FAFC;
    classDef cloudTier fill:#3B0764,stroke:#C084FC,stroke-width:2px,color:#F8FAFC;

    class UI,Mic,NetworkCheck clientTier;
    class Normalizer,LocalNLP,CloudAI,QueryEngine logicTier;
    class IDB,WAL localDataTier;
    class OfflineManager,Supabase cloudTier;
```

---

## 4. PPT Slide Ready: Data Flow (Text & Block Format)

Copy-paste this directly into an Architecture / Data Flow slide:

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 1. CLIENT INTAKE & SENSORY LAYER                                 │
│  • PWA Web UI (Mobile & Desktop)     • Audio MediaRecorder (Voice Mic)     • Network Listener    │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                │
                                                ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                  2. DUAL-TIER HYBRID PARSER                                      │
│  • Fast Offline Engine: RegEx + Hinglish Date Resolver ('parso', 'agle hafte', Devanagari ₹)      │
│  • Online Cloud Engine: Managed Gemini 2.5 Flash for nuanced, ambiguous multi-item transcripts   │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                │
                                                ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                           3. SOVEREIGN CLIENT STORAGE (GROUND TRUTH)                             │
│  • IndexedDB (Orders, Settings, Capacity)   ──> Sub-2ms instant local read/writes                │
│  • Write-Ahead Mutation Log (WAL)           ──> Guarantees zero data loss in airplane mode        │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                │
                                                ▼ (When Internet Available)
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                            4. BACKGROUND CLOUD RECONCILIATION                                    │
│  • OfflineSyncManager batches and pushes queued mutations via HTTPS to Supabase PostgreSQL       │
│  • Multi-device team synchronization across Store Owner, Managers, and Counter Operators         │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Key Highlights to Speak to During PPT Presentation

1. **True Sovereign Offline-First**:
   - The device never waits for a cloud response to commit an order. Counter checkouts occur at **0ms latency** on local IndexedDB.
2. **Hybrid Intelligence**:
   - If there is internet, high-accuracy LLM intelligence parses complex multi-item conversations.
   - If power or cellular data cuts out in the bazaar, deterministic local heuristics take over without interruption.
3. **Frictionless Natural Language Desk**:
   - Shopkeepers do not write complex SQL or filter through spreadsheets. They speak or tap: *"Kiska paisa baki hai?"* and get immediate real-time metrics.
4. **Role-Based Store Security**:
   - Store owners invite employees with granular access; employees can fulfill orders and log counter transactions without risking business configuration or store sovereignty.
