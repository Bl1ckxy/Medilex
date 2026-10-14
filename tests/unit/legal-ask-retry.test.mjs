import test from 'node:test';
import assert from 'node:assert/strict';
import { generateWithRetry } from '../../src/lib/legal/legal-ask.ts';

test('generateWithRetry returns the first success without retrying', async () => {
    let calls = 0;
    const result = await generateWithRetry(async () => {
        calls += 1;
        return 'ok';
    });
    assert.equal(result, 'ok');
    assert.equal(calls, 1);
});

test('generateWithRetry retries after a transient failure and succeeds', async () => {
    let calls = 0;
    const result = await generateWithRetry(
        async () => {
            calls += 1;
            if (calls < 3) throw new Error('transient');
            return 'recovered';
        },
        { attempts: 3, delayMs: 1 },
    );
    assert.equal(result, 'recovered');
    assert.equal(calls, 3);
});

test('generateWithRetry throws the last error once attempts are exhausted', async () => {
    let calls = 0;
    await assert.rejects(
        generateWithRetry(
            async () => {
                calls += 1;
                throw new Error(`fail ${calls}`);
            },
            { attempts: 2, delayMs: 1 },
        ),
        /fail 2/,
    );
    assert.equal(calls, 2);
});
