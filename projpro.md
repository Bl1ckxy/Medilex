# Major Project Proposal Synopsis

**Project Title:** MediLex : AI-Powered Medical Negligence Litigation Platform

**Project Domain:** Artificial Intelligence / Machine Learning, Web Development, Natural Language Processing, Retrieval-Augmented Generation (RAG)

**Project Type:** Software

**Problem Category:** Legal Technology / Healthcare Law / Social Impact

**SDG Mapped:** SDG 16 – Peace, Justice and Strong Institutions
**Supporting SDGs:** SDG 3 – Good Health and Well-being, SDG 9 – Industry, Innovation and Infrastructure

**SDG Justification:** MediLex primarily supports SDG 16: Peace, Justice and Strong Institutions by making justice for victims of medical negligence more accessible, efficient, and evidence-based. The platform helps legal teams convert unstructured medical records into organised case facts, assess precedent-backed case strength, select the correct forum, and calculate compensation and limitation deadlines, with every output verified by a lawyer before filing. It also supports SDG 3 by promoting accountability and patient safety in healthcare, and SDG 9 through an innovative, secure AI infrastructure for the legal sector.

**Project Guide:** Prof. Sachin Barahate

**Team Details:** _(to be filled)_

---

## Abstract

MediLex is an AI-powered litigation support platform purpose-built for legal teams handling complex medical negligence claims under Indian law. Medical negligence cases are difficult, slow, and expensive to pursue because the evidence is buried in handwritten prescriptions, clinical discharge summaries, and hospital logs, and because lawyers must manually research precedents from the NCDRC, SCDRC, and the Supreme Court of India, compute compensation, and track strict limitation periods.

The proposed system provides a secure workspace where law firms can register cases, upload medical evidence, and receive structured, audit-ready case strategies. Multi-modal OCR using Google Gemini Vision (applied to page images rasterised with pdf2pic) extracts facts from handwritten and scanned records; text is split with a token-aware chunker, embedded as 768-dimensional vectors, and stored in PostgreSQL with the pgvector extension. A hybrid Retrieval-Augmented Generation (RAG) pipeline — dense vector search over curated precedent chunks, refined by Cohere reranking with a graceful fall-back to vector order — grounds the legal inference performed by fast open-weight models hosted on Groq (with Google Gemini as a fallback provider), producing case-strength scores and liability-risk analysis tied to retrieved authorities and verified by a citation checker. Deterministic legal calculators implement the multiplier method for compensation (the approach developed in cases such as *Malay Kumar Ganguly v. WBFHC*) and verify limitation periods under the Limitation Act, 1963, and the platform flags when an AI compensation midpoint deviates more than 25% from the deterministic figure. Security is enforced through Supabase Auth with JWT sessions, Row Level Security (RLS) for firm-level data isolation, constant-time SHA-256 integrity verification of every document, signed storage URLs, and per-IP rate limiting. A strict Lawyer-in-the-Loop workflow ensures that demand notices (versioned, with an explicit AI-provenance flag) and counsel-review outputs are approved by a lawyer before filing.

The expected outcome is a functional, production-oriented prototype — deployed and running — that reduces manual document review, improves precedent research, and helps law firms build stronger, well-documented medical negligence cases, while keeping final legal judgment with the lawyer.

---

## Problem

Medical negligence litigation depends on unstructured, often handwritten medical evidence that must be read and interpreted manually. Precedent research, compensation calculation, forum selection, and limitation tracking are time-consuming and error-prone, and mistakes can lead to rejected claims or missed deadlines.

## Proposed Solution

MediLex is an AI-powered medical negligence litigation platform. It enables law firms to register cases, upload and OCR-process medical evidence, retrieve relevant precedents using hybrid RAG, calculate compensation and limitation deadlines, select the appropriate forum, and draft demand notices that a lawyer reviews and approves.

## Technologies Used

The system uses Next.js 14 (App Router) with TypeScript, PostgreSQL with pgvector and Drizzle ORM schema definitions, and Supabase (Auth, PostgREST, Storage). The AI pipeline uses Google Gemini (Vision OCR and embeddings), Groq-hosted open-weight models (GPT-OSS 20B/120B, Qwen 3.6) for fast structured inference, and Cohere for reranking. Tailwind CSS, Radix UI primitives, React Hook Form, and Zod are used for the interface and validation. RLS, JWT authentication, signed URLs, per-IP rate limiting, and SHA-256 hashing provide security and evidence integrity.

## Expected Outcome

The project delivers a secure and efficient medical negligence litigation prototype. It reduces manual effort, improves evidence analysis and precedent research, and supports faster, more accurate, and audit-ready case preparation.

---

## Problem Statement

**1. Existing Problem**
Medical negligence claims in India are slow and document-heavy. Key evidence such as handwritten prescriptions, clinical discharge summaries, and hospital logs is unstructured and hard to interpret, and lawyers must manually research verdicts from consumer commissions and the Supreme Court, compute compensation, and track limitation periods for each case.

**2. Current Limitations**
Existing legal-tech tools mostly offer case management, document storage, or generic legal research. They generally do not combine handwritten medical OCR, precedent-grounded RAG, deterministic compensation and limitation calculators, forum selection, and lawyer-verified notice drafting in one platform designed for Indian medical negligence law.

**3. Need for the Project**
There is a need for a secure and intelligent platform that can organise medical evidence, ground AI analysis in real precedents, apply statutory rules deterministically, and keep the lawyer in control. MediLex aims to make medical negligence litigation more accessible, accurate, and less time-consuming for Indian law firms and, ultimately, for the patients they represent.

---

## Objectives

- **AI-Powered Litigation Platform:** Develop an AI-driven case preparation system for medical negligence claims under Indian law.
- **Document Intelligence:** Extract structured facts from handwritten prescriptions, discharge summaries, and hospital logs using multi-modal OCR (Gemini Vision).
- **Hybrid RAG Precedent Analysis:** Retrieve, embed and rerank relevant NCDRC, SCDRC, and Supreme Court precedents to compute case-strength and liability-risk scores, with every AI citation checked against retrieved text.
- **Statutory Calculation Engines:** Implement a compensation framework (multiplier method) and a Limitation Act, 1963 verifier with deadline tracking.
- **Secure Multi-Tenant Architecture:** Enforce JWT authentication, Row Level Security by firm membership and role, signed storage URLs, rate limiting, and SHA-256 document integrity hashing.
- **Lawyer-in-the-Loop Verification:** Require human review and approval of all generated demand notices and counsel-review outputs before filing.
- **Quality Assurance for AI Outputs:** Benchmark retrieval and citation behaviour with a held-out question set including negative controls, and enforce provider-fallback and output-validation hardening.

---

## Scope of the Project

### Features Included

- Structured multi-step case intake (patient history, hospital metadata, treating doctor credentials, allegations of breach) with server-side Zod validation.
- Secure document upload with client/server SHA-256 integrity validation in constant time, private storage, and short-lived signed download URLs.
- Document intelligence workspace: asynchronous OCR pipeline (rasterise → Gemini Vision with a four-model fallback chain → chunk → embed) with OCR status tracking per document.
- Legal research workbench over a curated precedent corpus: grounded **Ask** mode (answers with inline citations and confidence) and **Search-only (no AI)** retrieval mode, with statute filtering.
- Hybrid RAG precedent retrieval (pgvector HNSW similarity search → Cohere rerank with fall-back) with case-strength and compensation scoring, persisted as typed analysis records.
- Compensation calculator (multiplier method: pecuniary and non-pecuniary heads) and Limitation Act verifier that penalises expired deadlines in the case score.
- Forum selection engine (District Commission up to ₹50,00,000; State Commission ₹50,00,001–₹2,00,00,000; NCDRC above ₹2,00,00,000) including applicable filing fees.
- AI-vs-deterministic deviation guardrail: if the AI compensation midpoint deviates more than 25% from the formulaic estimate, the platform flags the deviation with a reason for lawyer review.
- Versioned demand-notice drafting with recipient details, sent/acknowledged tracking, an explicit `generated_by_ai` provenance flag, and a lawyer approval workflow.
- Case hearing tracking and an ODR & filing workspace (notice → negotiation → mediation → filing steps).
- Firm administration panel: manage team roles and account status (suspend/activate with immediate enforcement), firm-wide case oversight, and re-run of analyses; self-lockout is blocked at the database level and **deletion is disabled** for chain of custody.

### Features Excluded

- Direct integration with courts, e-filing portals, or government legal systems.
- AI-generated final legal opinions, judgments, or automatic filing without lawyer approval.
- Replacement of lawyers, judges, or medical experts.
- Guaranteed legal outcomes or enforcement based on AI-generated scores and drafts.

### Future Scope

- Regional-language support and mobile application.
- Support for additional forums and statutes, including High Court and criminal negligence matters.
- Fine-tuned legal and medical models, with expanded precedent databases.
- Integration with digital signature providers and authorised legal organisations.

---

## Proposed System

### Architecture

The system is a full-stack Next.js 14 (App Router, TypeScript) application with server-side rendering, server actions and REST API routes. Schema-first modelling lives in `src/db/schema.ts` (Drizzle) and is materialised as SQL in `supabase/`; runtime data access goes through the Supabase client, so every query is subject to Row Level Security. PostgreSQL holds the pgvector extension with 768-dimensional embeddings for both case documents and the precedent corpus. Supabase provides authentication (JWT sessions via `@supabase/ssr`), Row Level Security, and private storage with signed URLs. The AI layer combines Google Gemini (Vision OCR and embeddings), Groq-hosted open-weight models for fast structured inference, and Cohere for reranking — each behind multi-model fallback chains. Deterministic legal calculators are kept in a separate module (`src/lib/legal/`), isolated from the AI layer (`src/lib/ai/`), and an authentication middleware guards all dashboard and API routes (including rate limiting and suspended-account enforcement).

### Processing Pipeline

1. **Intake & Hash** — The client computes a SHA-256 hash of the file in the browser and streams it to private Supabase Storage; the server re-hashes the bytes and compares the two digests in constant time before ingestion proceeds.
2. **OCR Extraction** — The PDF is rasterised into page images (pdf2pic + sharp) and passed to Gemini Vision, which reads handwritten clinical logs; a four-model fallback chain rides out transient provider outages.
3. **Chunking & Vector Storage** — A token-aware chunker (tiktoken) splits the extracted text; each chunk is embedded to 768 dimensions (Gemini `gemini-embedding-001`) and stored in pgvector with per-document OCR/embedding status.
4. **Hybrid Retrieval** — A query is embedded and matched against the corpus via an HNSW similarity RPC (with optional statute/tag filters), reranked by Cohere (`rerank-english-v3.0`) with a graceful fall-back to vector order, and passed a similarity floor so weak results are discarded.
5. **Legal Inference** — A grounding block of retrieved chunks is placed into a structured prompt sent to Groq (primary) or Gemini (fallback); responses are strictly JSON, with markdown-fence stripping and one parse retry on malformed output.
6. **Citation Verification & Storage** — Emitted citations are checked against the retrieved chunk text; results are written to the `ai_analyses` table and case-strength / compensation scores are updated on the case record, with the AI-vs-formulaic deviation guardrail applied.

### Database Design

The relational schema (`src/db/schema.ts`, deployed via `supabase/*.sql`) uses strict integrity and multi-tenant keys. Core tables are `users`, `cases`, `documents` (with `sha256_hash` and `ocr_status`), `document_chunks` (content and 768-dimensional vector), `legal_chunks` (curated precedent corpus with citation, statute tags and HNSW + GIN indexes), `ai_analyses` (typed JSONB payload, analysis type, model used), `case_hearings`, and `demand_notices` (versioned draft text, status workflow, AI-provenance flag). System enums include `case_status`, `hospital_type`, `negligence_type`, `severity_level`, `forum_type`, `document_category`, `ocr_status`, `embedding_status`, `analysis_type`, `patient_gender`, `demand_notice_status`, and `user_role` (firm_admin / senior_partner / associate / paralegal).

### Statutory Legal Calculation Engines

- **Compensation Framework:** Implements the multiplier method from landmark judgments (for example, *Malay Kumar Ganguly v. WBFHC*) to compute pecuniary and non-pecuniary losses from the victim's age, income, dependents and disability scale — kept fully deterministic and separate from the AI layer.
- **Limitation Period Verifier:** Calculates statutory bars under the Limitation Act, 1963 (typically two years from the date of cause of action or discovery of negligence); an expired or near-expiry deadline reduces the case score and surfaces as a deadline alert.

### Security Architecture

- **Data Isolation:** Supabase Row Level Security policies scope case data through `has_case_access()` (creating lawyer, assigned counsel, or firm admin) and `is_firm_admin()` helpers; firm membership (`firm_id`) supports multi-firm isolation.
- **Middleware Guard:** Session checks protect `/dashboard/*` and `/api/*` (JSON 401/403 for APIs); per-IP rate limiting (100 req/min general, 120 for auth paths); suspended accounts are signed out of the dashboard immediately and rejected by APIs with `ACCOUNT_SUSPENDED`; admin routes additionally require the `firm_admin` role.
- **Service Role Security:** Ingestion, OCR and document-retrieval jobs run only with server-side service keys; the service role is never exposed to the client.
- **Integrity & Access Control:** Client-side SHA-256 is matched with the server hash in constant time to prevent document tampering; downloads use short-lived signed URLs; admin privilege changes are guarded by an idempotent SQL policy plus a database trigger that blocks changing your own role or status; no DELETE policy exists on `users` or `cases` (chain of custody).

### Reliability Engineering

- Multi-model fallback chains for every provider leg (Gemini generation, Gemini OCR, Gemini embeddings, Groq inference) so a single model outage or decommission does not break a flow.
- Strict-JSON response handling with markdown-fence stripping and one bounded parse retry; provider errors propagate to the Groq→Gemini fallback chain instead of failing the request.
- End-to-end test suite (Playwright: authentication, case creation, document upload with OCR, legal research, responsive layouts at 375/768/1280 px), unit tests (Node test runner), ESLint + TypeScript + production build as release gates, and a 21-question legal-QA benchmark with negative controls to detect fabricated citations.

---

## Advantages

- Faster review of medical evidence and precedent research.
- Handwritten and scanned records converted into searchable, structured facts.
- Precedent-grounded, explainable case-strength and risk scores — with citations verified against source text, not asserted.
- Accurate, rule-based compensation and limitation calculations, with an automatic flag when AI and formulaic figures disagree by more than 25%.
- Secure, tamper-evident, role-scoped document management with signed URLs and rate limiting.
- Human oversight through the Lawyer-in-the-Loop workflow, AI provenance flags on every generated notice.
- Deterministic calculators and AI reasoning are deliberately isolated, so statutory outputs remain auditable even as models change.

---

## Novelty / Innovation

**What makes this project different?** MediLex combines handwritten medical OCR, hybrid RAG over Indian precedents, deterministic statutory calculators, forum selection, and lawyer-verified notice drafting in a single platform dedicated to medical negligence litigation under Indian law — with citation verification and an AI-vs-deterministic deviation guardrail built into the core loop.

**What value does it add?** It reduces manual effort by automatically extracting facts from medical records and scoring cases against retrieved authorities, helping lawyers prepare audit-ready strategies, avoid missed limitation deadlines, and choose the correct forum.

**How does it improve existing solutions?** Existing tools generally focus on case management, document storage, or generic legal research. MediLex separates AI reasoning from deterministic legal rules, verifies AI citations against source text, and keeps a lawyer in control of every output — creating a more accurate, secure, and trustworthy litigation workflow for the medical negligence domain.

---

## Technology Stack

### Software

- **Programming Languages:** TypeScript, JavaScript, SQL, React
- **IDE:** Visual Studio Code
- **Framework:** Next.js 14 with App Router (full stack), React Hook Form with Zod (forms and validation)
- **Database:** PostgreSQL (Supabase) with pgvector (768-dimensional embeddings), Drizzle ORM schema definitions, SQL migrations in `supabase/`
- **Authentication & Storage:** Supabase Auth (JWT sessions via `@supabase/ssr`, Row Level Security) and Supabase Storage (private bucket, signed URLs)
- **AI Models:** Google Gemini (Vision OCR, embeddings `gemini-embedding-001`), Groq-hosted open-weight models (GPT-OSS 20B/120B, Qwen 3.6) for structured inference, Cohere `rerank-english-v3.0` for reranking
- **User Interface:** Tailwind CSS, Radix UI primitives, lucide-react icons, Sonner (toasts), Recharts (dashboard), Inter + Lora typefaces
- **Other Tools:** pdf2pic + sharp (PDF rasterisation), tiktoken (token-aware chunking), pdf-lib, react-dropzone, date-fns, SHA-256 (Web Crypto + Node crypto), Husky + lint-staged + Prettier (quality hooks), Playwright (E2E)

### Deployment

- **Application:** Vercel (production deployment)
- **Backend Services:** Supabase (hosted PostgreSQL + Auth + Storage)

---

## Expected Outcomes

### Deliverables

- Functional MediLex web platform, deployed in production.
- Secure role- and RLS-scoped authentication and case management, with a firm admin panel.
- OCR-based document intelligence pipeline with hybrid RAG precedent analysis and citation verification.
- Compensation calculator, limitation verifier, forum selection, and lawyer-approved demand notice drafting.
- Automated quality gates: E2E + unit test suites, and a legal-QA benchmark harness with negative controls.

### Performance Goals

- Accurate OCR and fact extraction from clinical documents, resilient to provider outages.
- Relevant, well-cited precedent retrieval (measured by benchmark hit-rate against a held-out question set).
- Correct compensation and limitation calculations, deterministic and reproducible.
- Secure, tamper-evident evidence management with signed, time-limited access.
- Fast case information retrieval across all workspace views, responsive from 375 px mobile to desktop.

### Expected Users

- Law firms and advocates handling medical negligence claims.
- Legal researchers and paralegals.
- Organisations and legal-aid bodies supporting patients and families.

### Benefits

- Faster, better-prepared medical negligence cases.
- Reduced manual document review and research effort.
- Organised, secure, and verifiable digital evidence.
- Reduced risk of missed deadlines and wrong forum selection.
