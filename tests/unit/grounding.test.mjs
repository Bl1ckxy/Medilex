import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGroundingQuery } from '../../src/lib/ai/grounding.ts';

test('buildGroundingQuery combines negligence type and description', () => {
    const q = buildGroundingQuery({ negligence_type: 'delayed_treatment', incident_description: 'Delayed diagnosis' });
    assert.ok(q.includes('delayed treatment'), 'should include converted negligence type');
});

test('buildGroundingQuery replaces underscores with spaces', () => {
    assert.equal(buildGroundingQuery({ negligence_type: 'medication_error', incident_description: null }), 'medication error');
});

test('buildGroundingQuery truncates long descriptions at 400 chars', () => {
    const long = 'x'.repeat(500);
    const q = buildGroundingQuery({ negligence_type: 'surgical_error', incident_description: long });
    assert.equal(q.length, 'surgical error '.length + 400);
});

test('buildGroundingQuery returns empty for empty material', () => {
    assert.equal(buildGroundingQuery({}), '');
});
