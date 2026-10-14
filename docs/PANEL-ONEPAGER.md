# MediLex — Domain-Specialised Legal AI for Indian Medical Negligence

## The Criticism & The Response
**Panel said:** "You just integrated LLM APIs."  
**Response:** We built a legal-AI layer — a curated 62-chunk Indian medical-negligence corpus, an HNSW retrieval pipeline, a deterministic citation gate that strips anything retrieval did not return, and engine-computed limitation/forum/compensation facts. The LLM (Groq/Gemini) is a text renderer; our IP is the corpus, the gate, and the grounding, not the model weights.

## What Ships (6 technical contributions, all in repo)
1. **Curated corpus** (`data/legal/corpus.jsonl`, 62 chunks) with 49-point verification log (`VERIFICATION.md`) — source-of-truth for retrieval and citation checking.
2. **Retrieval** (`legal-retriever.ts`, HNSW RPC `match_legal_chunks`) — embed (`gemini-embedding-001`, 768d) → cosine-distance HNSW → Cohere rerank → 0.15 floor with top-2 rescue. No lexical fallback (no un-embedded copy to scan).
3. **Citation gate** (`citation-checker.ts`) — retrieved-set-only verification; unmatched citations stripped from answer and reported; `allVerified` controls persistence.
4. **Grounded analysis pipeline** (`day4.ts` prompts + `strength`/`compensation`/`verify` routes) — case material + retrieved authorities + engine facts (limitation, forum, formulaic compensation) fed into the LLM; deviation banner if midpoint differs >25%.
5. **Offline evaluation** (`data/legal/eval.jsonl`, `scripts/eval-legal.mjs`) — 18 questions (3 negative controls); targets: ≥80% retrieval hit, 100% citation precision, 3/3 controls.
6. **Panel defense one-pager + README** (`docs/PANEL-ONEPAGER.md`, `docs/legal-corpus-card.md`, README section) — under 600 words, demo script included.

## Architecture (≤5 lines)
Corpus → `embedText` → `match_legal_chunks` (HNSW, cosine) → Cohere rerank → `applySimilarityFloor` (0.15) → `legalAskPrompt` / `strengthPrompt` with `renderGroundingBlock` → `generateJson` → `checkCitations` → gate strips / reports → `analysis-workbench.tsx` shows Authorities + engine-facts + deviation banner.

## Numbers (measured on this branch)
- **Corpus:** 62 chunks / 7,607 words / 103 tags / 38 verified.
- **Retrieval:** 3/3 smoke tests passed (limitation `s.69`, expert screening `D'Souza`, forum selection).
- **Citation gate:** 5/5 unit tests pass; fabricated citation `Sharma v. Kusum, 2019 SCC 999` correctly marked `unverified`; answer stripped before persistence.
- **Eval targets (18 questions):** retrieval hit rate TBD — pending real eval run (target ≥80%); citation precision TBD — pending real eval run (target 100%); unverified-citation rate TBD — pending real eval run (target 0%); term coverage TBD — pending real eval run.
- **Build / gates:** `tsc` 0, `lint` 0 errors (38 pre-existing warnings unchanged), `build` 0, all 30 unit + 5 new e2e = 35 passing, 11 full-suite green (after rate-limit fix 20→60).

## Honest Limitations (stated, not hidden)
- Curated 66-authority coverage is a sample, not a comprehensive statute database.
- English-language; Indian jurisdiction only; clinical contexts only.
- No GPU, no LoRA fine-tune — RAG-only by design (3–4 day window; hallucination control is the stronger answer to the panel).
- `VERIFICATION.md` 49 hand-check boxes remain to be signed off physically; `case-mca-v-uni-of-india-1996` is flagged least-certain (row 29).
- Vercel `.env.production` needs real values in dashboard (GitHub-connected vs CLI; Hobby 60s vs Pro 300s).

## The Demo Line (30-second pitch)
> "Ask something the corpus doesn't cover — 'What is the penalty for practicing homeopathy without a license in 2024?' The answer says 'The curated corpus does not cover this,' and the citation gate shows zero fabricated citations. That is the difference between a chatbot and a verifiable research tool."

## Two Q&A (panel defense script)
**Q: Why not fine-tune a model?**  
A: No GPU available, 3–4 days won't train safely, and fine-tuning doesn't control citations — the panel's actual criticism is hallucination, which grounding + gate solves directly without model changes.

**Q: How do we know it's correct?**  
A: Every retrieved citation is verified against the 62-authority corpus with a deterministic Dice check; 49-point verification log exists; 18-question eval with negative controls measures both retrieval and precision; unverified citations are stripped from the answer before persistence; the workbench shows the exact authorities and deviation banner.
