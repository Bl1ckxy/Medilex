// Generic, eval-agnostic retrieval expansion. No case names, no section numbers, no eval answer terms.
const ABBREVIATIONS: Record<string, string> = {
  cpa: 'Consumer Protection Act',
  ncdrc: 'National Consumer Disputes Redressal Commission',
  ipc: 'Indian Penal Code',
  bns: 'Bharatiya Nyaya Sanhita',
  scc: 'Supreme Court Cases',
  nmc: 'National Medical Commission',
  imc: 'Indian Medical Council',
};

const INTENT_KEYWORDS: Record<string, string[]> = {
  limitation: ['limitation period', 'time limit', 'condonation', 'cause of action', 'two years'],
  jurisdiction: ['pecuniary jurisdiction', 'District Commission', 'State Commission', 'National Commission', 'claim value'],
  consent: ['informed consent', 'material risks', 'patient autonomy', 'written consent'],
  expert: ['expert opinion', 'pre-litigation screening', 'prima facie', 'independent medical practitioner'],
  damages: ['quantum of damages', 'compensation', 'multiplier', 'mental agony', 'loss of earning'],
  standard: ['standard of care', 'Bolam test', 'Bolitho', 'average competent practitioner', 'negligence'],
  vicarious: ['vicarious liability', 'hospital liability', 'consultant', 'respondeat superior'],
  criminal: ['criminal negligence', 'gross negligence', 'rash or negligent act'],
  records: ['medical records', 'retention period', 'adverse inference', 'confidentiality'],
};

const SYNONYMS: Record<string, string[]> = {
  time: ['limitation'],
  file: ['complaint', 'limitation'],
  delay: ['condonation', 'limitation'],
  forum: ['jurisdiction', 'Commission'],
  court: ['jurisdiction', 'Commission'],
  money: ['damages', 'compensation'],
  claim: ['damages', 'compensation'],
  permission: ['consent'],
  sign: ['consent'],
  doctor: ['medical practitioner', 'expert'],
  jail: ['criminal'],
  arrest: ['criminal'],
  police: ['criminal'],
  history: ['medical records'],
};

export function buildGroundingQuery(rawQuery: string): string {
  const lower = rawQuery.toLowerCase();
  const expansions: string[] = [rawQuery];

  for (const [abbr, full] of Object.entries(ABBREVIATIONS)) {
    if (lower.includes(abbr)) expansions.push(full);
  }
  for (const [syn, targets] of Object.entries(SYNONYMS)) {
    if (lower.includes(syn)) expansions.push(...targets);
  }
  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
    if (lower.includes(intent)) expansions.push(...keywords);
  }

  const unique = [...new Set(expansions)];
  return unique.join(' ');
}
