import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkRateLimit, TIERS } from '../../src/lib/ratelimit.ts';

test('ratelimit: allows requests within the limit', async () => {
    const key = `test-allow-${Date.now()}`;
    const result = await checkRateLimit('legal-ask', key);

    assert.equal(result.ok, true);
    assert.equal(result.limit, TIERS['legal-ask'].max);
    assert.equal(result.remaining, TIERS['legal-ask'].max - 1);
});

test('ratelimit: blocks requests over the limit and returns correct headers', async () => {
    const key = `test-block-${Date.now()}`;
    const max = TIERS['auth'].max; // 3 requests

    // Exhaust the limit
    for (let i = 0; i < max; i++) {
        const res = await checkRateLimit('auth', key);
        assert.equal(res.ok, true);
    }

    // The next request should fail
    const blockedRes = await checkRateLimit('auth', key);
    assert.equal(blockedRes.ok, false);
    assert.equal(blockedRes.remaining, 0);
    assert.ok(blockedRes.resetSec > 0 && blockedRes.resetSec <= 60);
});

test('ratelimit: different tiers have different limits', async () => {
    const askKey = `test-tier-ask-${Date.now()}`;
    const searchKey = `test-tier-search-${Date.now()}`;

    const askRes = await checkRateLimit('legal-ask', askKey);
    const searchRes = await checkRateLimit('legal-search', searchKey);

    assert.equal(askRes.limit, 10);
    assert.equal(searchRes.limit, 30);
});
