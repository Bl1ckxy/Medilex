import test from 'node:test';
import assert from 'node:assert/strict';
import { LEGAL_ASK_SYSTEM_PROMPT, legalAskPrompt } from '../../src/lib/ai/prompts/legal-ask.ts';

const authorities = [
    {
        id: 'c1',
        citation: 'Consumer Protection Act, 2019, s.69',
        title: 'Two-year limitation period',
        source_type: 'statute',
        court: null,
        year: 2019,
        tags: ['limitation'],
        content: 'A complaint must be filed within two years.',
        similarity: 0.8,
    },
    {
        id: 'c2',
        citation: "Martin F. D'Souza v. Mohd. Ishfaq, (2009) 4 SCC 386",
        title: 'Expert opinion before summoning doctors',
        source_type: 'case',
        court: 'Supreme Court of India',
        year: 2009,
        tags: [],
        content: 'Expert opinion required before issuing process.',
        similarity: 0.7,
    },
];

test('system prompt forbids inventing authorities and requires verbatim inline citations', () => {
    assert.match(LEGAL_ASK_SYSTEM_PROMPT, /Answer ONLY from the AUTHORITIES block/);
    assert.match(LEGAL_ASK_SYSTEM_PROMPT, /copied verbatim/);
    assert.match(LEGAL_ASK_SYSTEM_PROMPT, /does not cover this/);
    assert.match(LEGAL_ASK_SYSTEM_PROMPT, /never guess/);
    assert.match(LEGAL_ASK_SYSTEM_PROMPT, /not legal\s+advice/i);
});

test('legalAskPrompt renders the question', () => {
    const prompt = legalAskPrompt({ question: 'What is the limitation period?', authorities });
    assert.ok(prompt.includes('What is the limitation period?'));
    assert.ok(prompt.startsWith(LEGAL_ASK_SYSTEM_PROMPT));
});

test('legalAskPrompt numbers each authority with citation, title, type and year', () => {
    const prompt = legalAskPrompt({ question: 'q', authorities });
    assert.ok(prompt.includes('[1] Consumer Protection Act, 2019, s.69 — Two-year limitation period (statute, 2019)'));
    assert.ok(prompt.includes("[2] Martin F. D'Souza v. Mohd. Ishfaq, (2009) 4 SCC 386 — Expert opinion before summoning doctors (case, 2009)"));
});

test('legalAskPrompt includes each authority content verbatim', () => {
    const prompt = legalAskPrompt({ question: 'q', authorities });
    assert.ok(prompt.includes('A complaint must be filed within two years.'));
    assert.ok(prompt.includes('Expert opinion required before issuing process.'));
});

test('legalAskPrompt instructs citation by exact copy and states the no-authority fallback', () => {
    const prompt = legalAskPrompt({ question: 'q', authorities });
    assert.match(prompt, /copying the citation text exactly/);
    assert.match(prompt, /does not cover this/);
});

test('legalAskPrompt demands a strict JSON object with answer, citations and confidence (generateJson contract)', () => {
    const prompt = legalAskPrompt({ question: 'q', authorities });
    assert.match(prompt, /Return (a strict )?JSON/i);
    assert.match(prompt, /"answer"/);
    assert.match(prompt, /"citations"/);
    assert.match(prompt, /"confidence"/);
});

test('legalAskPrompt shows active filters when supplied', () => {
    const prompt = legalAskPrompt({
        question: 'q',
        authorities,
        filters: { matchType: 'case', matchTags: ['limitation'] },
    });
    assert.ok(prompt.includes('case'));
    assert.ok(prompt.includes('limitation'));
});

test('legalAskPrompt handles an empty authority list without a blank block', () => {
    const prompt = legalAskPrompt({ question: 'q', authorities: [] });
    assert.match(prompt, /no authorities/i);
});
