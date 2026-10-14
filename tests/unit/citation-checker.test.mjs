import test from 'node:test';
import assert from 'node:assert/strict';
import {
    normalizeCitation,
    checkCitations,
    stripSentencesWithCitations,
} from '../../src/lib/ai/citation-checker.ts';

const chunks = [
    {
        id: 'c1',
        citation: 'Consumer Protection Act, 2019, s.69',
        title: 'Two-year limitation period',
        source_type: 'statute',
        court: null,
        year: 2019,
        tags: ['limitation'],
        content: 'A complaint must be filed within two years.',
        similarity: 0.82,
    },
    {
        id: 'c2',
        citation: "Martin F. D'Souza v. Mohd. Ishfaq, (2009) 4 SCC 386",
        title: 'Expert opinion before summoning doctors',
        source_type: 'case',
        court: 'Supreme Court of India',
        year: 2009,
        tags: ['expert_screening'],
        content: 'Expert opinion required before issuing process.',
        similarity: 0.75,
    },
    {
        id: 'c3',
        citation: 'Limitation Act, 1963, s.3',
        title: 'General principle of limitation',
        source_type: 'statute',
        court: null,
        year: 1963,
        tags: ['limitation'],
        content: 'Suits after the prescribed period are dismissed.',
        similarity: 0.71,
    },
];

test('normalizeCitation collapses whitespace, unifies quotes/dashes, strips trailing period, casefolds', () => {
    const raw = '  Martin\u2019s \u201Ccase\u201D \u2014  (2009)  4 SCC 386.  ';
    const norm = normalizeCitation(raw);
    assert.equal(norm, "martin's \"case\" - (2009) 4 scc 386");
});

test('exact citation in brackets is verified against retrieved chunks only', async () => {
    const result = await checkCitations(
        'A complaint must be filed within two years [Consumer Protection Act, 2019, s.69].',
        chunks,
    );
    assert.equal(result.totalCount, 1);
    assert.equal(result.verifiedCount, 1);
    assert.equal(result.allVerified, true);
    assert.equal(result.verdicts[0].status, 'verified');
    assert.equal(result.verdicts[0].chunkId, 'c1');
});

test('SCC pattern outside brackets matches retrieved citation by substring', async () => {
    const result = await checkCitations(
        'The court mandated an expert opinion, Martin F. D\u2019Souza v. Mohd. Ishfaq, (2009) 4 SCC 386, before issuing process.',
        chunks,
    );
    const verified = result.verdicts.find((v) => v.citation.includes('2009) 4 SCC 386'));
    assert.ok(verified, 'expected a verdict for the SCC span');
    assert.equal(verified.status, 'verified');
    assert.equal(verified.chunkId, 'c2');
});

test('section pattern and act-year pattern are extracted as candidates', async () => {
    const result = await checkCitations(
        'See s.3 of the Limitation Act, 1963 for the general principle.',
        chunks,
    );
    const norms = result.verdicts.map((v) => normalizeCitation(v.citation));
    assert.ok(result.verdicts.length >= 2, `expected >=2 candidates, got ${JSON.stringify(norms)}`);
    assert.ok(result.verdicts.every((v) => v.status === 'verified'), JSON.stringify(result.verdicts));
});

test('citation NOT in the retrieved set is unmatched with a Jaccard suggestion', async () => {
    const result = await checkCitations(
        'Complaints must be filed within one year [Consumer Protection Act, 2019, s.71].',
        chunks,
    );
    assert.equal(result.allVerified, false);
    const verdict = result.verdicts.find((v) => v.citation.includes('s.71'));
    assert.ok(verdict, 'expected verdict for s.71');
    assert.equal(verdict.status, 'unmatched');
    assert.equal(verdict.suggestion, 'Consumer Protection Act, 2019, s.69');
});

test('unmatched with no close token overlap has null suggestion', async () => {
    const result = await checkCitations(
        'The Motor Vehicles Act, 2019 governs this claim [Motor Vehicles Act, 2019, s.163].',
        chunks,
    );
    const verdict = result.verdicts.find((v) => v.citation.includes('s.163'));
    assert.ok(verdict);
    assert.equal(verdict.status, 'unmatched');
    assert.equal(verdict.suggestion, null);
});

test('garbage bracketed span with no reference number is malformed', async () => {
    const result = await checkCitations('See [above] for details.', chunks);
    const verdict = result.verdicts.find((v) => normalizeCitation(v.citation) === 'above');
    assert.ok(verdict, JSON.stringify(result.verdicts));
    assert.equal(verdict.status, 'malformed');
    assert.ok(verdict.reason.length > 0);
});

test('numeric bracketed reference resolves via the authorities block numbering', async () => {
    const result = await checkCitations('The two-year rule applies [2].', chunks);
    assert.equal(result.verdicts[0].status, 'verified');
    assert.equal(result.verdicts[0].chunkId, 'c2');
    assert.equal(result.allVerified, true);
});

test('numeric reference beyond the block is unmatched, not verified', async () => {
    const result = await checkCitations('See [9].', chunks);
    assert.equal(result.verdicts[0].status, 'unmatched');
    assert.equal(result.allVerified, false);
});

test('allVerified is false when the answer contains no citations at all', async () => {
    const result = await checkCitations('The limitation period is two years.', chunks);
    assert.equal(result.totalCount, 0);
    assert.equal(result.allVerified, false);
});

test('answer citing only retrieved authorities across mixed patterns passes the gate', async () => {
    const answer =
        'A complaint must be filed within two years [Consumer Protection Act, 2019, s.69]. ' +
        'The general bar under the Limitation Act, 1963 applies [Limitation Act, 1963, s.3]. ' +
        'Expert screening follows (2009) 4 SCC 386.';
    const result = await checkCitations(answer, chunks);
    assert.equal(result.allVerified, true, JSON.stringify(result.verdicts, null, 2));
});

test('stripSentencesWithCitations removes sentences containing non-verified candidates only', async () => {
    const answer =
        'A complaint must be filed within two years [Consumer Protection Act, 2019, s.69]. ' +
        'It must instead be filed within one year [Consumer Protection Act, 2019, s.71]. ' +
        'Expert screening follows (2009) 4 SCC 386.';
    const result = await checkCitations(answer, chunks);
    const bad = result.verdicts.filter((v) => v.status !== 'verified').map((v) => v.citation);
    const stripped = stripSentencesWithCitations(answer, bad);
    assert.ok(stripped.includes('within two years'), stripped);
    assert.ok(stripped.includes('2009) 4 SCC 386'), stripped);
    assert.ok(!stripped.includes('s.71'), stripped);
    assert.ok(!stripped.includes('within one year'), stripped);
});
