import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyPath, checkIpLimit, CLASS_LIMITS } from '../../middleware/rate-limit-core.ts';

test('classifyPath routes each path class to its own bucket', () => {
    assert.equal(classifyPath('/auth/login'), 'auth');
    assert.equal(classifyPath('/auth/signup'), 'auth');
    assert.equal(classifyPath('/auth/callback'), 'auth');
    assert.equal(classifyPath('/api/auth/session'), 'auth');
    assert.equal(classifyPath('/login'), 'auth');
    assert.equal(classifyPath('/signup'), 'auth');
    assert.equal(classifyPath('/api/legal-ask'), 'api');
    assert.equal(classifyPath('/api/cases/123'), 'api');
    assert.equal(classifyPath('/dashboard'), 'dashboard');
    assert.equal(classifyPath('/dashboard/cases/123'), 'dashboard');
    assert.equal(classifyPath('/'), 'default');
});

test('checkIpLimit: allows requests up to the class budget then blocks', () => {
    const key = `unit-budget-${Date.now()}`;
    for (let i = 0; i < CLASS_LIMITS.api; i += 1) {
        assert.equal(checkIpLimit(key, CLASS_LIMITS.api).ok, true, `request ${i + 1} should pass`);
    }
    const blocked = checkIpLimit(key, CLASS_LIMITS.api);
    assert.equal(blocked.ok, false);
    assert.equal(blocked.remaining, 0);
    assert.ok(blocked.resetSec > 0 && blocked.resetSec <= 60, `resetSec out of range: ${blocked.resetSec}`);
});

test('checkIpLimit: exhausting one class leaves the other classes untouched', () => {
    const ip = `unit-classes-${Date.now()}`;
    let dashboardBlocked = 0;
    for (let i = 0; i < CLASS_LIMITS.dashboard + 50; i += 1) {
        if (!checkIpLimit(`${ip}:dashboard`, CLASS_LIMITS.dashboard).ok) dashboardBlocked += 1;
    }
    assert.ok(dashboardBlocked > 0, 'dashboard class should block past its own budget');

    const apiResult = checkIpLimit(`${ip}:api`, CLASS_LIMITS.api);
    assert.equal(apiResult.ok, true, 'API budget must be untouched by dashboard traffic');
    assert.equal(apiResult.remaining, CLASS_LIMITS.api - 1, 'API budget should still be full');
});

test('checkIpLimit: different IPs never share a budget', () => {
    const stamp = Date.now();
    const keyA = `unit-ip-a-${stamp}`;
    const keyB = `unit-ip-b-${stamp}`;
    for (let i = 0; i < CLASS_LIMITS.auth; i += 1) {
        assert.equal(checkIpLimit(keyA, CLASS_LIMITS.auth).ok, true);
    }
    assert.equal(checkIpLimit(keyA, CLASS_LIMITS.auth).ok, false, 'IP A should be exhausted');
    assert.equal(checkIpLimit(keyB, CLASS_LIMITS.auth).ok, true, 'IP B must have its own budget');
});
