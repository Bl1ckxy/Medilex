import test from 'node:test';
import assert from 'node:assert/strict';
import { stripFences, parseJsonWithRetry } from '../../src/lib/ai/json-parse.ts';

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
