# Aitbaar AI

**A WhatsApp-native, voice-first AI assistant bringing digital trust to Pakistan's informal savings committees (bisi/kameti).**

Built for the Alibaba Cloud AI Hackathon 2026 — Financial Inclusion Track.

---

## Team

- **Hafsah Shahzad** — Team Lead
- **Esha Irfan** — Team Member

---

## The Problem

Roughly 100 million Pakistanis 41% of the population save through informal committees (*bisi/kameti*), moving an estimated **$5 billion annually**, entirely outside the formal banking system. Bank account ownership rose from 16% (2015) to 64% (2023), but only **43% of
women** hold a formal account, and existing digital finance apps assume smartphone literacy, English, and comfort typing excluding exactly the people who rely on committees most.

This creates six recurring, real problems:

| # | Problem | Description |
|---|---------|-------------|
| 1 | **Organizer Fraud** | An organizer collects cash but disappears, or under-reports what was paid with no record to prove otherwise. |
| 2 | **No Digital Records** | Everything is tracked on paper or from memory. One lost notebook erases months of payment history. |
| 3 | **Payout Disputes** | Members argue over payout order with no fair, transparent process to settle it. |
| 4 | **Digital Exclusion** | Existing finance apps require an app download and literacy excluding low-literacy and non-smartphone users. |
| 5 | **Impersonation Scams** | Fraudsters pose as the organizer and ask members to send money to a "new" account number. |
| 6 | **Invisible Credit History** | Years of reliable payments never translate into a credit record a bank would recognize. |

## The Solution

Aitbaar digitizes trust in committees **without changing how people already save**. A member sends a WhatsApp voice note or text in Urdu, Roman Urdu, or English reporting a payment. The AI understands the request and logs it; a human organizer verifies every claim before it's confirmed, so the AI assists rather than decides alone. Verified payment behavior updates a transparent, ongoing Trust Score for every member.

---

## Key Features

- **WhatsApp-native, voice-first access** : no app download required. Members register, pay, and check their status entirely through WhatsApp text or voice notes.
- **Multi-language understanding** : Urdu script, Roman Urdu, English, and mixed-language input, auto-detected per message.
- **AI intent detection** : classifies payment confirmations, trust score queries, priority requests, and general questions using Qwen via Alibaba Cloud Model Studio.
- **Fixed, due-date-aware payment logging** : each committee has a fixed monthly contribution and a due date set at creation; payments are automatically checked against that date rather than relying on the user to state an amount or date.
- **Trust Score engine** : a transparent, reliability-based score that rewards on-time confirmed payments (with a diminishing bonus and a consecutive on-time streak bonus), gives partial credit for late-but-confirmed payments, and penalizes rejected payments and missed months.
- **AI Trust Score Explainer** : generates a natural-language, Urdu/Roman Urdu breakdown of *why* a member's score is what it is, with specific, actionable tips to improve it.
- **AI Scam Shield** : scans every incoming message in real time for fraud and impersonation patterns (e.g. requests to pay a "new" account number) before it reaches the member.
- **AI-assisted priority payout requests** : members can request an early payout for genuine need (medical emergency, school fees); the AI analyzes urgency and fairness and recommends a resolution for the committee to vote on.
- **Organizer web dashboard** : approve or reject payments, manage payout order, review scam alerts and anomaly flags, and view a full audit log.
- **Multi-committee support** : members can belong to and manage more than one committee, identified by committee code, with session continuity across conversations.
- **Session & conversation memory** : the bot remembers a member's last flow state and recent conversation history, so it can pick up where a conversation left off instead of restarting.

---

## Tech Stack

| Layer | Technology | Role |
|---|---|---|
| AI Reasoning | **Qwen3.7-Plus / Flash** (Alibaba Cloud Model Studio, DashScope-compatible endpoint) | Multi-language intent detection, conversation, and function-calling for live data |
| AI Fairness Engine | Qwen-driven priority scoring | Analyzes urgent payout requests and recommends fairness-based decisions |
| Trust & Security | AI Scam Shield | Real-time fraud/impersonation pattern detection on every incoming message |
| Speech | Groq Whisper (STT) + TTS pipeline | Urdu voice note transcription and voice replies |
| Database | **Supabase (PostgreSQL)** | Committees, members, payments, trust scores, sessions, scam alerts, audit logs |
| Communication | **WhatsApp Business API** | Text and voice-note messaging channel |
| Backend | **Node.js / Express** | Webhook handling, session state, business logic |
| Frontend | **React.js** | Organizer web dashboard |

---

## How It Works

1. **Member speaks or texts** : a WhatsApp voice note or text message, in any supported language.
2. **AI understands & acts** : Qwen detects the intent and, where needed, calls a tool to fetch real data (trust score, payment history, payout position) directly from the database it never guesses or invents financial data.
3. **Organizer verifies** : every payment claim is confirmed or rejected by the human organizer before it counts.
4. **Trust Score updates** : on verification, the Trust Score engine recalculates the member's score based on their full payment history, including whether the payment was on time relative to the committee's due date.

---

## Project Structure (backend)

```
├── server.js
├── config/
│   └── supabaseClient.js
├── routes/
│   ├── whatsappRoutes.js        # WhatsApp webhook + conversation flow
│   ├── dashboardRoutes.js       # Organizer dashboard endpoints
│   ├── paymentRoutes.js
│   ├── payoutRoutes.js
│   ├── priorityRoutes.js
│   └── scamShieldRoutes.js
├── services/
│   ├── llmProvider.js           # Qwen/DashScope client wrapper
│   ├── llmService.js            # Conversational AI + tool-calling for live data
│   ├── intentService.js         # AI intent classification
│   ├── languageService.js       # Language detection + message templates
│   ├── paymentService.js        # Payment logging, due-date/lateness calc, verification
│   ├── trustScoreCalculator.js  # Trust Score formula
│   ├── trustScoreExplainerService.js  # AI-generated score explanations
│   ├── scamDetectionService.js  # AI Scam Shield
│   ├── priorityRequestService.js
│   ├── payoutAssignmentService.js
│   ├── memberService.js
│   ├── committeeService.js
│   ├── messageService.js
│   ├── mediaService.js
│   ├── speechToTextService.js
│   └── textToSpeechService.js
└── payment/
    ├── weeklyAnomalyCheck.js
    └── monthlyPaymentReminder.js
    └── monthlyPaymentPrediction.js
```

---

## Database Schema (Supabase / PostgreSQL)

Key tables: `members`, `committees`, `organizers`, `payment_records`, `trust_scores`, `member_sessions`, `messages`, `scam_alerts`, `anomaly_flags`, `payout_orders`, `payout_positions`, `payout_change_requests`, `priority_requests`, `priority_votes`, `payout_audit_log`.

`payment_records` includes `due_date`, `is_late`, and `days_late` computed at the moment a payment is logged, so lateness is measured against a real due date rather than reconstructed later.

---



## Currently Refining

We're being upfront about what's still in progress rather than presenting the system as fully finished:

- **Pre-due-date payment reminders** : automated nudges before a payment is due, not yet built.
- **Trust score formula tuning** : the due-date-aware scoring logic is implemented and running; we're continuing to tune it against real usage data.
- **Premium / monetization features** : instant committee matching, priority payout slots, and B2B microfinance partnerships are roadmap items, not yet built.

---

## Business Model

Aitbaar uses a **freemium model**: core saving, tracking, and trust scoring remain free, since Pakistani committee users already do this for free and are highly resistant to fees on the act of saving itself. Monetization comes from optional convenience features (instant committee matching, priority payout slots), default-protection insurance, and future B2B licensing to microfinance institutions not from the core user base.

---

## License

Built for the Alibaba Cloud AI Hackathon 2026. All rights reserved by the Aitbaar team unless otherwise licensed.
