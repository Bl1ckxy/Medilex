# MediLex Legal Corpus — Data Card

## Purpose
Domain-specialised legal AI layer over a hand-curated Indian medical-negligence law corpus.

## Corpus (source of truth: `data/legal/corpus.jsonl`)
- 62 chunks / ~7,607 words
- Statute 18 · Practice 14 · Doctrine 13 · Case 11 · Guideline 6
- Negligence types: `all` (42), `delayed_treatment` (15), `medication_error` (11), `surgical_error` (11)
- 103 distinct tags; `verify:true` on 38/62 chunks
- Source texts: Consumer Protection Act 2019, Limitation Act 1963, BND Act, MCA, Bharatiya Nyaya Sanhita 2023, NCDRC guidelines, Supreme Court / High Court judgments.

## Provenance & Verification
- Hand-curated from primary sources; not scraped or LLM-generated.
- `data/legal/VERIFICATION.md`: 49 checklist rows (5 sections), all chunk IDs verified against corpus, with section D (known gaps) reused in corpus card.
- `case-mca-v-uni-of-india-1996` flagged as least-certain citation (VERIFICATION row 29).

## Embedding & Index (applied to prod `bjobscohkauwcdzimlut.supabase.co`)
- Model: `gemini-embedding-001` (retired `text-embedding-004` removed; dead header cleaned)
- Dimensions: 768 (`EMBEDDING_DIMENSIONS = 768` asserted)
- Index: HNSW (`legal_corpus.sql`); `match_legal_chunks` `SECURITY DEFINER`
- RLS: SELECT-only for `authenticated`; never deny-all `document_chunks`.
- Retrieval: embed → HNSW RPC → Cohere rerank (graceful fall-back to vector order) → similarity floor 0.15 (cosine distance in `similarity` column; mapped to true similarity 1−d at read-time) → keep top 2 if emptied.

## Citation Gate (`src/lib/ai/citation-checker.ts`)
- Retrieved-set-only verification; unmatched citations stripped from answer before persistence; model may only cite chunks retrieval actually returned; unverified authorities dropped from `authorities` array.

## Evaluation
- `tests/eval/legal-qa.json`: 18 questions (12 positive, 3 negative controls) — see `docs/legal-qa-eval.md` for run results.
- Targets: ≥80% retrieval hit, 100% citation precision, 3/3 negative controls.

## Limitations
- Curated coverage only (not a comprehensive statute database).
- English-language corpus; Indian jurisdiction only.
- Research support, not legal advice; a licensed advocate must verify before filing.
- `VERIFICATION.md` 49 hand-check boxes still need physical sign-off before submission.
