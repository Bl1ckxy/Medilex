import test from 'node:test';
import assert from 'node:assert/strict';
import { gateStatusForCitation, gateStatusForMarker } from '../../src/lib/legal/citation-status.ts';

const makeCheck = (verdicts) => ({
    verdicts,
    verifiedCount: verdicts.filter((v) => v.status === 'verified').length,
    totalCount: verdicts.length,
    allVerified: verdicts.every((v) => v.status === 'verified'),
});

test('exact verdict match maps to verified with the shared label', () => {
    const check = makeCheck([{ status: 'verified', citation: 'Kusum Sharma v. Union of India (2010) 3 SCC 797' }]);
    const result = gateStatusForCitation('Kusum Sharma v. Union of India (2010) 3 SCC 797', check);
    assert.equal(result.status, 'verified');
});

test('whitespace differences between answer and verdict still match', () => {
    const check = makeCheck([{ status: 'verified', citation: 'Kusum   Sharma (2010) 3 SCC 797' }]);
    const result = gateStatusForCitation('Kusum Sharma (2010) 3 SCC 797', check);
    assert.equal(result.status, 'verified');
});

test('unmatched verdict with a suggestion maps to partial', () => {
    const check = makeCheck([{ status: 'unmatched', citation: 'Spring Meadows case', suggestion: 'Spring Meadows Hospital v. Harish Kumar' }]);
    const result = gateStatusForCitation('Spring Meadows case', check);
    assert.equal(result.status, 'partial');
    assert.match(result.note, /Harish Kumar/);
});

test('unmatched verdict without a suggestion maps to unverified', () => {
    const check = makeCheck([{ status: 'unmatched', citation: 'Invented Authority v. State', suggestion: null }]);
    const result = gateStatusForCitation('Invented Authority v. State', check);
    assert.equal(result.status, 'unverified');
});

test('malformed verdict maps to unverified with the gate reason', () => {
    const check = makeCheck([{ status: 'malformed', citation: '[???]', reason: 'no reference number' }]);
    const result = gateStatusForCitation('[???]', check);
    assert.equal(result.status, 'unverified');
    assert.equal(result.note, 'no reference number');
});

test('citation present in retrieval but absent from verdicts maps to uncited', () => {
    const result = gateStatusForCitation('Some Retrieved Statute, 2019', makeCheck([]));
    assert.equal(result.status, 'uncited');
});

test('missing check never claims verification', () => {
    assert.equal(gateStatusForCitation('Anything', null).status, 'uncited');
    assert.equal(gateStatusForMarker(1, null, null).status, 'unverified');
});

test('marker resolves through the authorities-block numbering verdict', () => {
    const check = makeCheck([
        { status: 'verified', citation: '[1]' },
        { status: 'unmatched', citation: '[2]', suggestion: 'Closest Authority (2013) 8 SCC 131' },
        { status: 'unmatched', citation: '[3]', suggestion: null },
    ]);
    assert.equal(gateStatusForMarker(1, null, check).status, 'verified');
    assert.equal(gateStatusForMarker(2, null, check).status, 'partial');
    assert.equal(gateStatusForMarker(3, null, check).status, 'unverified');
});

test('marker falls back to citation-text matching before failing', () => {
    const check = makeCheck([{ status: 'verified', citation: 'Sarla Verma v. DTC (2009) 6 SCC 121' }]);
    const result = gateStatusForMarker(4, 'Sarla Verma v. DTC (2009) 6 SCC 121', check);
    assert.equal(result.status, 'verified');
});

test('marker with an authority the gate never saw remaps uncited to partial, not verified', () => {
    const result = gateStatusForMarker(4, 'Retrieved But Uncited Statute, 2019', makeCheck([]));
    assert.equal(result.status, 'partial');
    assert.match(result.note, /not separately gate-checked/);
});

test('marker with no verdict and no authority is unverified, not assumed true', () => {
    const result = gateStatusForMarker(9, null, makeCheck([]));
    assert.equal(result.status, 'unverified');
    assert.match(result.note, /\[9\]/);
});
