# Aitbaar AI

**A WhatsApp-native, voice-first AI assistant bringing digital trust to Pakistan's informal savings committees (bisi/kameti).**

Built for the Alibaba Cloud AI Hackathon 2026, Financial Inclusion Track.

---

## Team

- **Hafsah Shahzad**, Team Lead
- **Esha Irfan**, Team Member

---

## The Problem

Roughly 100 million Pakistanis (41% of the population) save through informal committees (*bisi/kameti*), moving an estimated **$5 billion annually**, entirely outside the formal banking system. Bank account ownership rose from 16% (2015) to 64% (2023), but only **43% of women** hold a formal account, and existing digital finance apps assume smartphone literacy, English, and comfort typing, excluding exactly the people who rely on committees most.

| # | Problem | Description |
|---|---------|-------------|
| 1 | **Organizer Fraud** | An organizer collects cash but disappears, or under-reports what was paid, with no record to prove otherwise. |
| 2 | **No Digital Records** | Everything is tracked on paper or from memory. One lost notebook erases months of payment history. |
| 3 | **Payout Disputes** | Members argue over payout order with no fair, transparent process to settle it. |
| 4 | **Digital Exclusion** | Existing finance apps require an app download and literacy, excluding low-literacy and non-smartphone users. |
| 5 | **Impersonation Scams** | Fraudsters pose as the organizer and ask members to send money to a "new" account number. |
| 6 | **Invisible Credit History** | Years of reliable payments never become a credit record a bank would recognize. |

## The Solution

Aitbaar digitizes trust in committees **without changing how people already save**. A member sends a WhatsApp voice note or text in Urdu, Roman Urdu, or English reporting a payment. The AI understands the request and logs it, and a human organizer verifies every claim before it is confirmed, so the AI assists rather than decides alone. Verified payment behavior updates a transparent Trust Score for every member.

Aitbaar never holds or moves money. It is a record-keeping and verification layer.

---

## Key Features

- **WhatsApp-native, voice-first access:** no app download. Members register, report payments, and check status through WhatsApp text or voice notes, with voice replies for voice messages.
- **Multi-language understanding:** Urdu script, Roman Urdu, English, and mixed input, with the language detected per message.
- **AI intent detection:** classifies payment confirmations, trust score queries, score explanations, priority requests, and general questions.
- **Grounded answers with live data:** Qwen answers using function calling (trust score, payment records, next payment date, committee info, payout position). For financial facts it reads the database instead of guessing, and it verifies the organizer's identity by phone number before sharing committee-wide data.
- **Due-date-aware payment logging:** each committee has a fixed monthly contribution and due date, and every payment is checked against it (`due_date`, `is_late`, `days_late`).
- **Transparent Trust Score:** see the formula below.
- **AI Trust Score Explainer:** explains in plain language *why* a score is what it is, with a payment breakdown (on-time, late, missed, rejected, pending) and tips to improve.
- **AI Scam Shield:** scans every incoming message with a fast rule-based pass for account-change, urgency, secrecy, and impersonation patterns, followed by AI analysis. Suspicious messages are blocked, the member gets a warning, and the organizer is alerted.
- **Automatic payment reminders:** members receive a WhatsApp reminder every month before the due date.
- **Payment risk prediction:** a monthly job predicts which members are likely to pay late and alerts the organizer.
- **Weekly anomaly check:** flags suspicious payment and communication patterns.
- **Committee Health Score:** a 0 to 100 score combining average trust, collection rate, anomalies, and payment consistency, with a short AI summary for the organizer.
- **AI-assisted payout order and priority requests:** AI proposes a fair payout order, and members can request an early payout for genuine need. The AI analyzes urgency and fairness, and the committee votes.
- **Receipts and member rules:** payment receipts as image and PDF, and a member rules PDF.
- **Organizer web dashboard:** approve or reject payments, manage payout order, review scam alerts and anomaly flags, and view the audit log.
- **Multi-committee support and session memory:** members can belong to several committees, and the bot remembers conversation state.

---

## Trust Score

Each committee month is worth `100 / duration_months` points. For every month whose due date has passed:

| Payment | Points earned |
|---|---|
| Confirmed, on time or within the **7-day grace period** | Full value |
| Confirmed, 8-10 days late | 90% |
| Confirmed, 11-15 days late | 80% |
| Each further 5-day block | 10% less, down to 0 |
| 51+ days late, missed, or rejected | 0 |
| Pending organizer decision | Not counted yet |

The score grows as the committee progresses. For example, in a 10-month committee, two resolved months (one on time, one 9 days late) give 10 + 9 = **19/100**.

---

## Tech Stack

| Layer | Technology | Role |
|---|---|---|
| Conversation and explanations | **Qwen** (Alibaba Cloud Model Studio, DashScope-compatible API) | Answers members, function calling for live data, Trust Score explanations |
| Intent detection and analysis | **Gemini** | Intent classification, scam analysis, payout order, priority requests, risk prediction |
| Speech to text | **Groq Whisper large-v3** | Urdu voice-note transcription |
| Text to speech | **Edge TTS (ur-PK)** | Urdu voice replies |
| Database | **Supabase (PostgreSQL)** | Committees, members, payments, scores, sessions, alerts, audit logs |
| Channel | **WhatsApp Business API** | Text and voice-note messaging |
| Backend | **Node.js / Express**, node-cron | Webhook, business logic, scheduled jobs |
| Frontend | **React (Vite), Tailwind, Recharts** | Organizer and admin dashboards |
| Documents | **Puppeteer, PDFKit** | Receipt images and PDFs |

---

## How It Works

1. **Member speaks or texts** on WhatsApp, in any supported language.
2. **Speech to text:** voice notes are transcribed with Whisper.
3. **Scam Shield:** every message is scanned first. Suspicious messages stop here.
4. **Intent detection:** Gemini classifies what the member wants.
5. **Answer:** Qwen responds, calling tools to read real data from the database when needed.
6. **Organizer verifies:** every payment claim is approved or rejected by the human organizer.
7. **Trust Score updates** from the member's full payment history, measured against the committee's due dates.

---

## Project Structure

```
├── .env.example
├── client/                      # React organizer + admin dashboards (Vite)
│   └── src/
│       ├── pages/               # Landing, Login, Dashboard, AdminDashboard, HowitWorks
│       ├── components/
│       └── api/
└── server/
    ├── server.js
    ├── config/supabaseClient.js
    ├── routes/                  # whatsapp, dashboard, payment, payout, priority, scamShield, admin, rules
    ├── controllers/
    ├── middleware/              # rate limiter, admin auth
    ├── services/
    │   ├── llmProvider.js       # Qwen / DashScope client
    │   ├── llmService.js        # Conversational AI + tool calling
    │   ├── intentService.js     # Intent classification
    │   ├── scamDetectionService.js
    │   ├── trustScoreCalculator.js
    │   ├── trustScoreExplainerService.js
    │   ├── paymentService.js
    │   ├── payout*.js, priorityRequestService.js
    │   ├── speechToTextService.js, textToSpeechService.js
    │   └── ...
    └── payment/                 # Scheduled jobs: reminders, prediction, weekly anomaly check
```

---

## Database Schema (Supabase / PostgreSQL)

Key tables: `members`, `committees`, `organizers`, `payment_records`, `trust_scores`, `member_sessions`, `messages`, `scam_alerts`, `anomaly_flags`, `payout_orders`, `payout_positions`, `payout_change_requests`, `priority_requests`, `priority_votes`, `payout_audit_log`.

`payment_records` stores `due_date`, `is_late`, and `days_late`, computed when a payment is logged.

---

## Getting Started

### Prerequisites
Node.js 18+, a Supabase project, a Meta WhatsApp Business app, and API keys for Alibaba Cloud Model Studio, Gemini, and Groq.

### Environment variables
Copy `.env.example` to `.env` in `server/` and fill in:

```
PORT=5000
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
GROQ_API_KEY=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_VERIFY_TOKEN=
GMAIL_USER=
GMAIL_APP_PASSWORD=
ADMIN_EMAIL=
ADMIN_PASSWORD=
ADMIN_NAME=
DASHSCOPE_API_KEY=
DASHSCOPE_BASE_URL=
```

> While using Meta's test number, every recipient phone must be added to the allowed recipient list, and the test access token expires after 24 hours. Use a permanent system-user token for demos.

### Run

```bash
# Backend
cd server
npm install
npm run dev          # http://localhost:5000

# Frontend
cd client
npm install
npm run dev
```

Point the WhatsApp webhook to `https://<your-host>/webhook`.

Handy endpoints: `GET /api/health`, `GET /api/test-db`, `POST /api/anomaly/run`, `POST /api/predict/:committeeId`.

---

## Roadmap and Current Limits

- **Trust Score tuning:** the due-date-aware formula is live, and we are tuning it against real usage data.
- **Model consolidation:** moving more analysis tasks to Qwen.
- **Data protection:** stronger encryption and explicit member consent before production.
- **Premium features:** instant committee matching, priority payout slots, default-protection insurance, and B2B licensing to microfinance institutions.
- **Speech accuracy:** Urdu accents and noise can affect transcription, which is why a human verifies every payment.

---

## Business Model

Freemium. Core saving, tracking, and trust scoring stay free, since committee users already do this for free and resist fees on saving itself. Revenue comes from optional convenience features, default-protection insurance, and future B2B licensing to microfinance institutions.

---

## License

Built for the Alibaba Cloud AI Hackathon 2026. All rights reserved by the Aitbaar team unless otherwise licensed.
