import test from 'node:test';
import assert from 'node:assert/strict';
import {
    mapLegalRows,
    applySimilarityFloor,
    mergeRerankOrder,
} from '../../src/lib/ai/legal-rank.ts';

const row = (id, citation, similarity) => ({
    id,
    citation,
    title: `Title ${id}`,
    source_type: 'statute',
    court: null,
    year: 2019,
    tags: ['limitation'],
    content: 'content',
    similarity,
});

test('mapLegalRows converts cosine distance to cosine similarity (1 - d) and passes fields through', () => {
    const [mapped] = mapLegalRows([row('a', 'Cite A', 0.202)]);
    assert.equal(mapped.id, 'a');
    assert.equal(mapped.citation, 'Cite A');
    assert.equal(mapped.source_type, 'statute');
    assert.ok(Math.abs(mapped.similarity - 0.798) < 1e-9, `expected 0.798, got ${mapped.similarity}`);
});

test('mapLegalRows tolerates null similarity and missing optional fields', () => {
    const [mapped] = mapLegalRows([
        { id: 'b', citation: 'Cite B', title: 't', source_type: 'case', court: null, year: null, tags: [], content: 'c', similarity: null },
    ]);
    assert.equal(mapped.similarity, 0);
    assert.equal(mapped.court, null);
    assert.equal(mapped.year, null);
});

test('applySimilarityFloor drops chunks below the 0.15 similarity floor', () => {
    const chunks = mapLegalRows([
        row('keep1', 'Keep 1', 0.2), // similarity 0.8
        row('keep2', 'Keep 2', 0.5), // similarity 0.5
        row('drop', 'Drop', 0.9), // similarity 0.1 — below floor
    ]);
    const result = applySimilarityFloor(chunks);
    assert.deepEqual(result.map((c) => c.id), ['keep1', 'keep2']);
});

test('applySimilarityFloor keeps the top 2 when the floor empties the set', () => {
    const chunks = mapLegalRows([
        row('worst', 'Worst', 0.98),
        row('mid', 'Mid', 0.95),
        row('best', 'Best', 0.92),
    ]);
    const result = applySimilarityFloor(chunks);
    assert.equal(result.length, 2);
    assert.deepEqual(result.map((c) => c.id), ['best', 'mid']);
});

test('applySimilarityFloor returns input untouched when already short', () => {
    const chunks = mapLegalRows([row('only', 'Only', 0.9)]);
    assert.deepEqual(applySimilarityFloor(chunks).map((c) => c.id), ['only']);
});

test('mergeRerankOrder reorders by rerank index and applies relevance scores', () => {
    const chunks = mapLegalRows([row('a', 'A', 0.3), row('b', 'B', 0.4), row('c', 'C', 0.5)]);
    const ranked = mergeRerankOrder(chunks, [
        { index: 2, relevanceScore: 0.95 },
        { index: 0, relevanceScore: 0.8 },
    ]);
    assert.deepEqual(ranked.map((c) => c.id), ['c', 'a']);
    assert.equal(ranked[0].similarity, 0.95);
});

test('mergeRerankOrder ignores rerank hits beyond the chunk list', () => {
    const chunks = mapLegalRows([row('a', 'A', 0.3)]);
    const ranked = mergeRerankOrder(chunks, [
        { index: 5, relevanceScore: 0.9 },
        { index: 0, relevanceScore: 0.7 },
    ]);
    assert.deepEqual(ranked.map((c) => c.id), ['a']);
    assert.equal(ranked[0].similarity, 0.7);
});
