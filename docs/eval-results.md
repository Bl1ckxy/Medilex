# Legal QA eval — full run results

## Run metadata

| Field | Value |
| --- | --- |
| Date | 2026-10-15T13:48:23.800Z |
| Command | `node --env-file=.env.local scripts/eval-legal.mjs` (npm script equivalent; repo has no `.env`) |
| Questions | 21 (`data/legal/eval.jsonl`: 18 positive + 3 negative controls) |
| Retrieval | `match_legal_chunks` RPC, top-8, Gemini `gemini-embedding-001` (768d) |
| Answering LLM | Groq `openai/gpt-oss-20b`, temperature 0.2, max_tokens 1024 |
| Status | **Clean full run — 21/21 answered, 0 question errors** |

## Headline numbers (as produced by the script)

- **Retrieval hit rate: 33.3% (7/21)** — an expected citation appears in the top-8
  retrieved chunks.
- **Citation precision (proxy): 100.0%** — ⚠️ **not a verified metric.** The script
  counts every returned citation as verified (see the "approximated for speed"
  note in `scripts/eval-legal.mjs`). Treat it as "the LLM emitted citations", not
  as evidence they are grounded. A real precision gate is the in-app
  `checkCitations` path, which was not part of this run.

## Decomposition (factual, not a threshold change)

- The script's hit rate divides by all 21 questions, but the 3 negative controls
  have no expected citations, so they can never "hit". Positive-only retrieval:
  **7/18 = 38.9%**. Both figures are stated; the script was not changed to score
  differently.
- **Negative controls: 3/3 correct.** `n01`, `n02`, `n03` each returned **0
  citations** — no fabricated authorities on questions with no expected source.

## Per-question results

```
q01 hit=true  citations=1    q10 hit=true  citations=7
q02 hit=true  citations=7    q11 hit=false citations=7
q03 hit=true  citations=1    q12 hit=false citations=5
q04 hit=true  citations=1    q13 hit=false citations=1
q05 hit=true  citations=3    q14 hit=false citations=4
q06 hit=false citations=5    q15 hit=false citations=4
q07 hit=false citations=3    q16 hit=false citations=3
q08 hit=false citations=5    q17 hit=false citations=2
q09 hit=true  citations=3    q18 hit=false citations=3
                              n01 hit=false citations=0
                              n02 hit=false citations=0
                              n03 hit=false citations=0
```

`hit=false` on a positive question means the expected authority was not in the
top-8 retrieved chunks. The LLM still answered from retrieved chunks, which is
why several misses show non-zero citations — retrieval coverage, not answer
failure, is the binding constraint.

## Provider behavior during the run

- 2 truncated/malformed Groq JSON responses absorbed by parse-retry
  (`[EVAL] Malformed JSON from Groq, retrying`).
- 1 Groq TPM rate-limit absorbed by backoff (`x-ratelimit-limit-tokens: 8000`,
  window waited out; `[EVAL] Groq rate limited — waiting 59s`).
- 0 questions failed as a result. The two earlier pre-hardening attempts lost
  10–12 questions to rate limits; those runs are superseded by this one.

## What this means / next steps

- 33.3% (7/21) retrieval is the honest current state. The corpus
  (`legal_chunks`, 62 chunks) does not yet cover the authority set the eval
  expects (e.g. `Limitation Act, 1963, s.17 & s.27`, CP Act 2019 s.46/s.47/s.69
  practice notes). Raising hit rate means **corpus coverage work** — sourcing
  and seeding more primary authorities via `npm run seed:legal:prod`.
- Do not tune prompts, retrieval parameters or the eval set toward these
  questions; the eval set is a measurement instrument, not an optimization
  target.
- The precision proxy should eventually be replaced by running every emitted
  citation through `checkCitations` against chunk content.
