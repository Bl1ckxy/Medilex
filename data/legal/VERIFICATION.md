# MediLex Legal Corpus — Verification Log

Status: IN PROGRESS — only the human partner can fill verified cells.
Source of truth: `data/legal/corpus.jsonl` (60 chunks after Phase 3 quarantine of 2 invented cases).

| Chunk ID | Citation (exact) | Claim / Section to confirm | Source to check | Verified |
|---|---|---|---|---|
| cpa-2019-s2-7-deficiency | Consumer Protection Act, 2019, s.2(7) | Section number: is this "consumer" or "deficiency"? Confirm with India Code. | India Code / SCC Online | |
| cpa-2019-s2-11-service | Consumer Protection Act, 2019, s.2(11) | Section number: is this "deficiency" or "service"? Confirm. | India Code / SCC Online | |
| cpa-2019-s2-42-service-provider | Consumer Protection Act, 2019, s.2(42) | Service / service-provider definition — confirm section. | India Code / SCC Online | |
| cpa-2019-s2-47-utp | Consumer Protection Act, 2019, s.2(47) | Unfair trade practice definition — confirm. | India Code / SCC Online | |
| cpa-2019-s35 | Consumer Protection Act, 2019, s.35 | Title and scope — confirm. | India Code / SCC Online | |
| cpa-2019-s38 | Consumer Protection Act, 2019, s.38 | Title and scope — confirm. | India Code / SCC Online | |
| cpa-2019-s46 | Consumer Protection Act, 2019, s.46 | Pecuniary jurisdiction — confirm. | India Code / SCC Online | |
| cpa-2019-s47 | Consumer Protection Act, 2019, s.47 | National Commission jurisdiction — confirm. | India Code / SCC Online | |
| cpa-2019-s69 | Consumer Protection Act, 2019, s.69 | Limitation period — confirm. | SCC Online / Indian Kanoon | |
| limitation-act-1963-s3 | Limitation Act, 1963, s.3 | General principle — confirm. | India Code | |
| limitation-act-1963-s17 | Limitation Act, 1963, s.17 | Discovery / fraud exception — confirm. | India Code | |
| case-mca-v-uni-of-india-1996 | MCA v. University of India (1996) | Least-certain citation — verify before filing. | SCC Online / Indian Kanoon | |
| case-dsouza-2009 | Martin F. D'Souza v. Mohd. Ishfaq (2009) 4 SCC 386 | Expert opinion screening — confirm. | SCC Online | |
| case-kusum-sharma | Kusum Sharma v. Batra Hospital | Standard of care / Bolam — confirm year and SCC. | SCC Online / Indian Kanoon | |
| case-savita-garg | Savita Garg v. National Heart Institute | Vicarious liability — confirm. | SCC Online / Indian Kanoon | |
| doctrine-bolam | Bolam / Bolitho (India) | Doctrine — confirm holding, not invented. | Law reviews / SCC | |
| guideline-aware-consent | Informed consent protocols | Guideline — confirm source institution. | NCDRC / MOHFW | |
| practice-document-checklist | Document checklist | Practice note — confirm from NCDRC / consumer forum rules. | Consumer forum rules | |

## Section D: Known Gaps (reused from original)
- Motor Vehicle accidents / workplace injuries not in corpus.
- Income-tax / RTI / homeopathy regulatory limits not covered.
- Pre-2019 CPA amendments (before s.69 change) not fully traced.
- Some judgment SCC numbers may differ from actual reports — verify against SCC Online before citing in any filing.

## Usage Instruction
Do NOT present any citation from this corpus in court or to a client until the corresponding cell above is signed. The `verify: true` flag in the JSON is the seed author's confidence, not a legal confirmation.
