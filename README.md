# Docta — AI Contract Intelligence Platform

> Upload a contract. Get risk scores, clause analysis, and negotiation advice in seconds — powered by a 3-agent AI pipeline built on [Lemma SDK](https://lemma.work).

---

## What it does

Docta analyzes legal contracts using three specialized AI agents chained together:

| Agent | Role |
|---|---|
| **Clause Extractor** | Identifies all contract clauses, parties, doc type, and flags missing provisions |
| **Risk Assessor** | Scores each clause for legal risk (0–100), flags red flags, classifies overall risk level |
| **Negotiation Advisor** | Generates negotiation tips and counter-language for every high-risk clause |

The final output is stored in a Lemma datastore and surfaced in a clean dashboard — with per-clause drill-downs, risk rings, and one-click copy of counter-language.

---

## User Interface

- Dashboard

  ![Dashboard](assets/dashboard.png)

---

## Tech Stack

- **Framework** — Next.js 16 (Turbopack)
- **AI Orchestration** — [Lemma SDK](https://lemma.work) (3-agent workflow)
- **PDF Extraction** — `pdf-parse` via child process (bypasses Turbopack bundler)
- **DOCX Extraction** — `mammoth`
- **UI** — Vanilla CSS, Lucide icons
- **Database** — Lemma Datastore (managed, no separate DB needed)

---

## Project Structure

```
docta/
├── scripts/
│   ├── refresh-token.cjs    # Runs before dev server — auto-refreshes Lemma auth token
│   └── extract-text.cjs     # Child process PDF/DOCX extractor (Turbopack-safe)
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── lemma/[...path]/  # Proxy: injects fresh CLI token, handles 204/SSL
│   │   │   └── extract/          # File extraction API route
│   │   ├── (app)/
│   │   │   ├── dashboard/        # Contract list + metrics
│   │   │   ├── upload/           # Upload + 3-agent pipeline UI
│   │   │   ├── analysis/[id]/    # Per-contract: overview, clauses, negotiation tabs
│   │   │   ├── onboarding/       # First-time org setup
│   │   │   └── settings/         # Org settings
│   │   └── globals.css           # Design system (CSS vars, light theme)
│   ├── components/
│   │   ├── LemmaProvider.tsx     # Auth + org context
│   │   └── ReactQueryProvider.tsx
│   └── lib/
│       └── lemma.ts              # Singleton LemmaClient
```

---

## Setup

### Prerequisites

- Node.js 18+
- [Lemma CLI](https://lemma.work/docs) installed and logged in (`lemma auth login`)
- A Lemma pod with the following configured:

#### Lemma Tables

```bash
lemma tables create documents
lemma tables create analyses
lemma tables create organizations
```

#### Lemma Agents

| Name | Description |
|---|---|
| `clause-extractor` | Extracts clauses, parties, doc type from raw contract text |
| `risk-assessor` | Scores each clause for legal risk |
| `negotiation-advisor` | Generates negotiation advice and counter-language |

#### Lemma Workflow

```
Workflow name: analyze-document
Chain: clause-extractor → risk-assessor → negotiation-advisor
```

### Environment

Create `.env.local` at the project root:

```env
NEXT_PUBLIC_LEMMA_API_URL=http://localhost:3000/api/lemma
NEXT_PUBLIC_LEMMA_AUTH_URL=https://auth.lemma.work
NEXT_PUBLIC_LEMMA_POD_ID=<your-pod-id>
NEXT_PUBLIC_LEMMA_TOKEN=<token-from-lemma-auth-print-token>
LEMMA_TOKEN=<same-token>
LEMMA_BIN=<path-to-lemma-cli-executable>
```

Get your pod ID and initial token:

```bash
lemma pods list
lemma auth print-token
```

### Install & Run

```bash
npm install
npm run dev
```

> **`npm run dev` automatically refreshes the auth token first** via `scripts/refresh-token.cjs` — no manual token updates needed as long as your CLI session is active (`lemma auth login`).

Open [http://localhost:3000](http://localhost:3000).

---

## How It Works

### Upload Flow

```
User uploads PDF/DOCX
        ↓
/api/extract  →  node scripts/extract-text.cjs
        ↓           (child process, outside Turbopack bundler)
  Extracted text
        ↓
lemma.workflows.run('analyze-document')
        ↓
  clause-extractor → risk-assessor → negotiation-advisor
        ↓
  Final output captured from workflow context keys
        ↓
lemma.records.create('documents') + lemma.records.create('analyses')
        ↓
  Redirect to /analysis/{docId}?aid={analysisId}
```

### Auth Proxy

All Lemma SDK requests route through `/api/lemma/[...path]`, which:

- Injects a fresh CLI token on every request (JWT expiry-aware, refreshes if <5 min left)
- Retries automatically on `401` with a new token
- Handles `204 No Content` responses (required for DELETE)
- Disables SSL verification for Lemma's self-signed cert (`NODE_TLS_REJECT_UNAUTHORIZED=0`)

---

## Business Login

Docta uses **organization-based login**:

- First visit → onboarding creates an org record (stored in `localStorage` + Lemma datastore)
- All subsequent sessions restore from `localStorage`
- No individual user accounts required — the org is the identity unit
- Team member invites are planned (Settings stub is live)

---

## Known Limitations

| Issue | Status |
|---|---|
| Lemma access tokens expire every 60 min | `predev` script auto-refreshes; proxy retries on 401 |
| PDF must be text-based (not scanned/image-only) | Returns 422 with clear error message |
| Multi-user team access | Planned — Settings page has the stub |

---

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Refresh token + start dev server |
| `npm run build` | Production build |
| `node scripts/refresh-token.cjs` | Manually refresh Lemma token in `.env.local` |

---

## License

MIT License - See [LICENSE](./LICENSE.md) file for details
