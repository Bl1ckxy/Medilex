import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { stripFences, parseJsonWithRetry } from '../../src/lib/ai/json-parse.ts';

const ConfidenceSchema = z.object({
    answer: z.string(),
    confidence: z.number(),
});

test('stripFences extracts the payload from a fenced json block', () => {
    assert.equal(stripFences('```json\n{"a":1}\n```'), '{"a":1}');
});

test('stripFences passes plain JSON through unchanged', () => {
    assert.equal(stripFences('{"a":1}'), '{"a":1}');
});

test('stripFences trims stray edge fences without a language tag', () => {
    assert.equal(stripFences('```\n{"a":1}\n```'), '{"a":1}');
});

test('stripFences extracts a fence embedded after prose', async () => {
    const text = 'Here you go:\n```json\n{"a":1}\n```\n';
    assert.equal(stripFences(text), '{"a":1}');
});

test('parseJsonWithRetry returns parsed JSON and calls the provider once when valid', async () => {
    let calls = 0;
    const result = await parseJsonWithRetry(async () => {
        calls += 1;
        return '{"ok":true}';
    }, 'Test');
    assert.deepEqual(result, { ok: true });
    assert.equal(calls, 1);
});

test('parseJsonWithRetry retries exactly once on malformed JSON then succeeds', async () => {
    const responses = ['{"broken": ', '{"ok": true}'];
    let calls = 0;
    const originalWarn = console.warn;
    console.warn = () => {};
    try {
        const result = await parseJsonWithRetry(async () => {
            calls += 1;
            return responses.shift();
        }, 'Test');
        assert.deepEqual(result, { ok: true });
    } finally {
        console.warn = originalWarn;
    }
    assert.equal(calls, 2);
});

test('parseJsonWithRetry throws a labeled error when the retry is also malformed', async () => {
    let calls = 0;
    const originalWarn = console.warn;
    console.warn = () => {};
    try {
        await assert.rejects(
            () =>
                parseJsonWithRetry(async () => {
                    calls += 1;
                    return 'not json at all';
                }, 'Test'),
            (err) =>
                err instanceof Error && err.message.includes('after retry') && err.message.includes('Test'),
        );
    } finally {
        console.warn = originalWarn;
    }
    assert.equal(calls, 2);
});

test('parseJsonWithRetry does not retry provider errors', async () => {
    let calls = 0;
    await assert.rejects(
        () =>
            parseJsonWithRetry(async () => {
                calls += 1;
                throw new Error('429 rate limited');
            }, 'Test'),
        /429 rate limited/,
    );
    assert.equal(calls, 1);
});

test('parseJsonWithRetry succeeds on valid JSON without schema', async () => {
    const call = async () => '{"answer": "hello"}';
    const result = await parseJsonWithRetry(call, 'mock-provider');
    assert.deepEqual(result, { answer: 'hello' });
});

test('parseJsonWithRetry retries once on schema drift, then throws', async () => {
    let calls = 0;
    const originalWarn = console.warn;
    console.warn = () => {};
    try {
        await assert.rejects(
            () =>
                parseJsonWithRetry(async () => {
                    calls += 1;
                    return '{"answer": "hello"}';
                }, 'mock-provider', ConfidenceSchema),
            /Schema drift/,
        );
    } finally {
        console.warn = originalWarn;
    }
    assert.equal(calls, 2, 'Should have attempted exactly twice (1 initial + 1 retry)');
});

test('parseJsonWithRetry succeeds on retry if schema drift is fixed', async () => {
    let calls = 0;
    const originalWarn = console.warn;
    console.warn = () => {};
    try {
        const result = await parseJsonWithRetry(async () => {
            calls += 1;
            if (calls === 1) return '{"answer": "hello"}';
            return '{"answer": "hello", "confidence": 0.9}';
        }, 'mock-provider', ConfidenceSchema);
        assert.deepEqual(result, { answer: 'hello', confidence: 0.9 });
    } finally {
        console.warn = originalWarn;
    }
    assert.equal(calls, 2);
});

test('parseJsonWithRetry bubbles up provider errors immediately (no retry)', async () => {
    let calls = 0;
    await assert.rejects(
        () =>
            parseJsonWithRetry(async () => {
                calls += 1;
                const err = new Error('Rate limit');
                err.status = 429;
                throw err;
            }, 'mock-provider', ConfidenceSchema),
        /Rate limit/,
    );
    assert.equal(calls, 1, 'Provider errors must NOT trigger the parse retry loop');
});
