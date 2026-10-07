const test = require('node:test');
const assert = require('node:assert/strict');
const { requestFreeReply } = require('../utils/openrouter');
const reply = (text = 'Hello') => Response.json({ choices: [{ message: { content: text } }] });
const options = (fetchImpl) => ({ apiKey: 'test-key', fetchImpl, wait: async () => {} });

test('uses only the free router and returns the reply', async () => {
  assert.equal(await requestFreeReply([], options(async (_, init) => {
    const body = JSON.parse(init.body);
    assert.equal(body.model, 'openrouter/free');
    assert.equal(body.reasoning.enabled, false);
    return reply();
  })), 'Hello');
});
test('retries transient provider failure once', async () => {
  let calls = 0;
  assert.equal(await requestFreeReply([], options(async () => ++calls === 1 ? new Response('', { status: 503 }) : reply())), 'Hello');
  assert.equal(calls, 2);
});
test('retries empty content and errors inside a successful HTTP response', async () => {
  for (const first of [reply(''), Response.json({ error: { code: 503 } })]) {
    let calls = 0;
    assert.equal(await requestFreeReply([], options(async () => ++calls === 1 ? first : reply())), 'Hello');
    assert.equal(calls, 2);
  }
});
test('does not retry quota or key failures', async () => {
  for (const status of [429, 401, 402, 403]) {
    let calls = 0;
    await assert.rejects(requestFreeReply([], options(async () => {
      calls++;
      return Response.json({ error: { code: status } }, { status, headers: { 'Retry-After': '60' } });
    })), error => {
      assert.equal(error.code, status === 429 ? 'busy' : 'assistant_configuration');
      if (status === 429) assert.equal(error.retryAfter, 60);
      return true;
    });
    assert.equal(calls, 1);
  }
});
test('bounds retries and identifies timeouts', async () => {
  let calls = 0;
  await assert.rejects(requestFreeReply([], options(async () => {
    calls++;
    throw new DOMException('Timed out', 'TimeoutError');
  })), { code: 'assistant_timeout', status: 504 });
  assert.equal(calls, 2);
});
test('missing key never sends a request', async () => {
  await assert.rejects(requestFreeReply([], { apiKey: '', fetchImpl: () => assert.fail('unexpected fetch') }), { code: 'assistant_not_configured' });
});
test('cancellation does not retry', async () => {
  const controller = new AbortController();
  let calls = 0;
  await assert.rejects(requestFreeReply([], { ...options(async () => {
    calls++;
    controller.abort();
    throw controller.signal.reason;
  }), signal: controller.signal }), { name: 'AbortError' });
  assert.equal(calls, 1);
});
