const { setTimeout: delay } = require('node:timers/promises');

class AssistantError extends Error {
  constructor(code, status, retryAfter) {
    super(code);
    this.code = code;
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

async function requestFreeReply(messages, {
  apiKey = process.env.OPENROUTER_API_KEY,
  signal,
  fetchImpl = fetch,
  wait = delay,
  attemptTimeoutMs = 25000,
} = {}) {
  if (!apiKey?.trim()) throw new AssistantError('assistant_not_configured', 503);
  const overall = AbortSignal.any([AbortSignal.timeout(55000), ...(signal ? [signal] : [])]);
  for (let attempt = 0; attempt < 2; attempt++) {
    overall.throwIfAborted();
    let failure;
    let retryable = true;
    try {
      const requestSignal = AbortSignal.any([overall, AbortSignal.timeout(attemptTimeoutMs)]);
      const response = await fetchImpl('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey.trim()}`, 'Content-Type': 'application/json', 'X-Title': 'BioNum' },
        body: JSON.stringify({ model: 'openrouter/free', messages, max_tokens: 800, temperature: 0.5, reasoning: { enabled: false } }),
        signal: requestSignal,
      });
      const payload = await response.json().catch(() => null);
      requestSignal.throwIfAborted();
      const status = Number(payload?.error?.code) || response.status;
      if (response.ok && !payload?.error) {
        const content = payload?.choices?.[0]?.message?.content;
        if (typeof content === 'string' && content.trim()) return content.trim().slice(0, 6000);
        failure = new AssistantError('invalid_reply', 502);
      } else if (status === 429) {
        // Never blindly retry an exhausted shared free quota.
        const raw = response.headers.get('retry-after');
        const seconds = raw && (/^\d+$/.test(raw) ? Number(raw) : Math.ceil((Date.parse(raw) - Date.now()) / 1000));
        failure = new AssistantError('busy', 429, seconds > 0 ? seconds : undefined);
        retryable = false;
      } else if ([401, 402, 403].includes(status)) {
        failure = new AssistantError('assistant_configuration', 502);
        retryable = false;
      } else {
        failure = new AssistantError(status === 408 || status === 504 ? 'assistant_timeout' : 'assistant_unavailable', status === 408 || status === 504 ? 504 : 503);
        retryable = status === 408 || status >= 500;
      }
    } catch (error) {
      if (overall.aborted) throw error;
      failure = new AssistantError(error.name === 'TimeoutError' || error.name === 'AbortError' ? 'assistant_timeout' : 'assistant_unavailable', error.name === 'TimeoutError' || error.name === 'AbortError' ? 504 : 503);
    }
    if (!retryable || attempt === 1) throw failure;
    await wait(750, undefined, { signal: overall });
  }
}

module.exports = { requestFreeReply, AssistantError };
