<p align="center">
  <img src="https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase" />
  <img src="https://img.shields.io/badge/Drizzle-ORM-029443?style=for-the-badge" alt="Drizzle ORM" />
  <img src="https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white" alt="Vercel" />
</p>

<h1 align="center">🩺 MediLex</h1>
<p align="center">
  <b>AI-Powered Medical Negligence Litigation Platform</b><br>
  Built for Indian law firms — from case intake to court filing.
</p>

<p align="center">
  <a href="#-about">About</a> •
  <a href="#-features">Features</a> •
  <a href="#-tech-stack">Tech Stack</a> •
  <a href="#-getting-started">Getting Started</a> •
  <a href="#-environment-variables">Environment</a> •
  <a href="#-database-setup">Database</a> •
  <a href="#-project-structure">Structure</a> •
  <a href="#-deployment">Deployment</a> •
  <a href="#-license">License</a>
</p>

---

## 🔍 About

**MediLex** streamlines the entire lifecycle of medical negligence cases for Indian law firms. It leverages multiple AI models to analyze case strength, estimate compensation, draft legal documents, and search precedents — all powered by a secure Supabase backend with pgvector semantic search.

<p align="center">
  <img src="https://img.shields.io/github/stars/your-username/medilex?style=social" alt="Stars" />
  <img src="https://img.shields.io/github/forks/your-username/medilex?style=social" alt="Forks" />
  <img src="https://img.shields.io/github/issues/your-username/medilex" alt="Issues" />
  <img src="https://img.shields.io/github/license/your-username/medilex" alt="License" />
</p>

---

## ✨ Features

### 🏛️ Case Management
- Full case lifecycle: **Intake → Investigation → Analysis → Filed → Closed**
- Patient & hospital profile management
- Doctor details & treating physician tracking
- Limitation deadline tracking
- Forum recommendation (District Commission → NCDRC → High Court)

### 🤖 AI-Powered Analysis
- **Case Strength Assessment** — AI evaluates merit of negligence claims
- **Compensation Estimate** — Data-driven settlement projections
- **Precedent Search** — Semantic vector search over legal documents
- **Demand Notice Drafting** — AI-generated legal notices
- **Complaint Drafting** — Automated consumer complaint preparation

### 📄 Document Intelligence
- Multi-format upload (PDF, images)
- OCR extraction with 13 document categories
- pgvector embeddings for semantic search
- Hash-verified integrity checks

### 👥 Role-Based Access
| Role | Permissions |
|------|------------|
| Firm Admin | Full access, manage users |
| Senior Partner | All cases, review AI output |
| Associate | Case creation, document mgmt |
| Paralegal | Intake, document upload |

### 🔐 Security & Compliance
- Row-Level Security (RLS) on every table
- Security headers (CSP, X-Frame-Options, etc.)
- Hash-verified document integrity
- Audit trails on all operations

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 14 (App Router) |
| **Language** | TypeScript 5.4 |
| **Styling** | Tailwind CSS 3.4 + shadcn/ui |
| **Database** | PostgreSQL (Supabase) + pgvector |
| **ORM** | Drizzle ORM |
| **AI Providers** | Google Gemini, Groq (GPT-OSS), Cohere |
| **Auth** | Supabase Auth |
| **Deployment** | Vercel |
| **Testing** | Playwright |
| **Docs** | Lora (serif) + Inter (UI) fonts |

---

## 🚀 Getting Started

### Prerequisites

- Node.js ≥ 18
- npm ≥ 9
- Supabase account
- API keys from [Groq](https://console.groq.com), [Google AI](https://aistudio.google.com), & [Cohere](https://cohere.com)

### 1. Clone the repository

```bash
git clone https://github.com/your-username/medilex.git
cd medilex
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials (see [Environment Variables](#-environment-variables)).

### 3. Set up the database

```bash
# Push Drizzle schema to Supabase
npm run db:push

# Or open Drizzle Studio for visual management
npm run db:studio
```

### 4. Run migrations & seed (optional)

```bash
npx drizzle-kit generate
npx drizzle-kit push
```

### 5. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — 🎉

---

## 🔑 Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres

# AI Providers
GROQ_API_KEY=gsk_your-groq-api-key
GOOGLE_AI_API_KEY=your-google-ai-api-key
GOOGLE_AI_MODEL=gemini-3.6-flash
GROQ_MODEL=openai/gpt-oss-20b
COHERE_API_KEY=your-cohere-api-key

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

---

## 🗄️ Database Setup

Run the SQL scripts in order inside your Supabase SQL editor:

```bash
supabase/schema.sql          # Tables, enums, indexes
supabase/rls_policies.sql    # Row-level security
supabase/functions.sql       # Stored functions (match_chunks, timeline, stats)
supabase/storage.sql         # Storage buckets
```

### Key Tables

| Table | Purpose |
|-------|---------|
| `users` | Firm members with roles |
| `cases` | Medical negligence cases |
| `documents` | Uploaded medical/legal files |
| `document_chunks` | Split text + embeddings |
| `ai_analyses` | AI results per case |
| `case_hearings` | Hearing schedule |
| `demand_notices` | Generated demand letters |

---

## 📁 Project Structure

```
medilex/
├── src/
│   ├── app/                  # Next.js App Router
│   │   ├── (auth)/           # Login / signup pages
│   │   ├── dashboard/        # Main dashboard
│   │   ├── api/              # Route handlers
│   │   └── layout.tsx        # Root layout
│   ├── components/
│   │   ├── analysis/         # AI analysis panels
│   │   ├── cases/            # Case forms & lists
│   │   ├── dashboard/        # Dashboard widgets
│   │   ├── evidence/         # Document viewer
│   │   ├── odr/              # Online dispute resolution
│   │   ├── review/           # Document review
│   │   ├── workspace/        # Case workspace
│   │   └── shared/           # Reusable UI
│   ├── db/                   # Drizzle schema
│   ├── lib/                  # Utilities & helpers
│   ├── types/                # TypeScript types
│   └── hooks/                # Custom React hooks
├── supabase/                 # SQL migrations
│   ├── schema.sql
│   ├── rls_policies.sql
│   ├── functions.sql
│   └── storage.sql
├── tests/                    # Playwright e2e tests
├── drizzle.config.ts
├── next.config.mjs
└── tailwind.config.ts
```

---

## 📋 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server on port 3000 |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | ESLint check |
| `npm run lint:fix` | ESLint auto-fix |
| `npm run format` | Prettier format all files |
| `npm run type-check` | TypeScript check |
| `npm run db:generate` | Drizzle migration generator |
| `npm run db:push` | Push schema to DB |
| `npm run db:studio` | Open Drizzle Studio GUI |
| `npx playwright test` | Run E2E tests |

---

## 🌐 Deployment

### Vercel (Recommended)

[![Deploy with Vercel](https://vercel.com/button.svg)](https://vercel.com/new/clone?repository-url=https://github.com/your-username/medilex)

1. Fork this repo
2. Connect to [Vercel](https://vercel.com/new)
3. Add all environment variables in Project Settings → Environment Variables
4. Deploy! 🚀

### Manual

```bash
npm run build
npm run start
```

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

Please ensure code passes linting and type-checking before submitting PRs.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

<p align="center">
  Made with ❤️ for Indian legal professionals by HARSH ROKADE (https://github.com/Bl1ckxy)
</p>`r`n## ? Legal Corpus & Grounded QA`r`n- Curated 62-authority Indian medical-negligence corpus (`data/legal/`), embedded with `gemini-embedding-001` (768d), retrieved via HNSW (`supabase/legal_corpus.sql`), verified by deterministic citation gate (`src/lib/ai/citation-checker.ts`).`r`n- `/dashboard/legal` � ask or search the corpus; answers are gated � unverified citations are stripped before persistence. See `docs/legal-corpus-card.md`, `docs/legal-qa-eval.md`, `docs/PANEL-ONEPAGER.md`.`r`n- `npm run test:unit` covers retrieval + gate; `npm run eval:legal` (script `scripts/eval-legal.mjs`) runs 18 questions with 3 negative controls against live APIs.`r`n
