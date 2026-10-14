import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildGroundingQuery } from '../../src/lib/ai/query-transformer.ts';

test('buildGroundingQuery does not leak eval answers', () => {
  const forbidden = new Set();
  const lines = fs.readFileSync('data/legal/eval.jsonl', 'utf-8').trim().split(/\r?\n/).filter(Boolean);
  const evalData = lines.map(l => JSON.parse(l));
  for (const q of evalData) {
    for (const c of q.expectedCitations || []) forbidden.add(c.toLowerCase());
  }
  const testQueries = [
    'What is the time limit to file a case?',
    'Can I sue a hospital for a consultant mistake?',
    'How is compensation calculated?',
    'Do I need an expert before filing?',
    'What are the rules for medical records?',
  ];
  for (const q of testQueries) {
    const expanded = buildGroundingQuery(q).toLowerCase();
    for (const f of forbidden) {
      if (f.length > 5 && expanded.includes(f)) assert.fail(`Leaked eval answer "${f}" in expanded query for "${q}"`);
    }
  }
  assert.ok(true, 'No eval leakage detected');
});
