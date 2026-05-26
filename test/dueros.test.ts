import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createSign } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildApp } from '../src/index.js';
import { createDb } from '../src/memory/db.js';
import { createConversationStore } from '../src/memory/conversation.js';
import { normalizeForTts } from '../src/llm/normalizer.js';
import { extractQuery } from '../src/dueros/parser.js';

const testDuerOsPrivateKey = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDIgb0hHoNw51y9
3ckZqV93/nM9ZatD0emmRZ8NMCouS3iWV+tF486GCJHGoReG2Z7+qkOVKT+AcXyp
6qtE15v1V6yyBRFpPndTLANPLEarPDmOaZA9KNAnDG9aZS4WCO2BXly+qPizMM4K
rxLwhI7ljMVqpc1i76MUR1FljXjGLEUkvQ3mliT6IbHyXqryYkqveHZlbcmDm0Fd
fO8osEpg1fiAVmAb8aKPC2OLa8/uMk/3beD+ArJSLqzd9A0DI83W4Hdw7bhSl04+
shLa6RLWX8bIw2gZmBuvM/0F9qGetoo8cOJRnQ8AFP3Eb2v99/38yzXkfNGCN8cq
vvRjL6lvAgMBAAECggEAG0crR9oy36VaRKprtYYJavW/D9dJGYzxUKGgJdcrpei2
mx2S8IsxiaKY0oEQBlSNAPCBCUX3Ua4e268FZfQ/T32CDSYLXFoXOcV/HcJUSu+C
lRFfgjKPPwC+FXo2buEADt2bmIS8cQRuw51V4krmdexU31F3Q8J+WT/qnvpEOBGH
5J0lC/yp76ID3LzWx5oXOY1Tv6TIzq5jn1wspwTc0fGZ32ssFbJYAjTgetiBdCcj
xLDuGXdCJkggpSqsa7uyCBEr2ZH3d2K75mwxc0ILmUGnIgSP4Fu6eccQaXEVZePt
s/NMSuJMolOyOGeqY1xZRXYbnwaCNttX8dXziTER4QKBgQD3Tyz8/lrwSNnIp3KK
wOieHbtIsCgLEeA5rA4HuBiHi2ERcrk7Q7ztoqxs8VOoPMxDYVACIdZxX0pmQzf0
nhpc8RdByhtBny3MOm/9yTCn9RAmCWxh36VCklYLyOBJh2ASj4e4fMh38fL58tOE
y8bB7XuSDK1aJt0W9luH+lEVfQKBgQDPjYWukDUQRtEObMhr3db3O1sspYXRLhtw
Co/6/MfjQXXxBA0i+2Uf1SVYsQk3SypUX1A1nh1y+qLXn1kqAy58nny42J1fk8Pq
RFdyr/9tbUbjXqUuvewa/kXRhoxT/GzCj5hqxg4kwwL9YmFdSh4JW+8FM/k8ZlXI
v6WJmyf+WwKBgCTEGY0XB0/3lKD2+9lS6oIvK1uYDKvwoWQRhxhwrvzfpLOiWZVM
8bZmW7nqeqRlPXy659kZTLcYEoh3b8cnBgZRNULrl/e+gWF+Qo35LgmaLidpeTpn
tDrcZHxmBaoIvSilO+kaa/cg+h1ck0OHw+mqs5c32UGwy2eRgnQJq6pFAoGBAIHh
St1xCnO0DRCczFKL0QCHWUe4EORUmQDk6zKhyqgQh7CZ22qfrKld5W/54Q2D8Oo5
duUGm+EerJaH9fEPaqC7QMsfamOsATZxK9PuBMZCUtDnojB80uoVYjV6oAfSd3DN
EREH/UPN8OoFDW6meeNbb1hvLLE6TMZB/2H8AOvvAoGAb70icrVG7I/c4Ay4aphS
NuYFOqhbQbfxsTTegZOepymsGZSY5Dg4SuW69jm6e9tors/Kf0FzY9HAuJhLAXWh
eDoeRqEqU5YH+Gix+NlMkFP5Gze84OpUHcAwKcKJSp9aM5GPseVHIIPCj5UgJW+0
q5dXhEmKJpxqHAkJVWOBkg0=
-----END PRIVATE KEY-----`;

const testDuerOsCert = `-----BEGIN CERTIFICATE-----
MIIDQDCCAiigAwIBAgIUHoiL9q1XznO1scs6GNKgjg2c1aMwDQYJKoZIhvcNAQEL
BQAwHzEdMBsGA1UEAwwUZHVlcm9zLWFwaS5iYWlkdS5jb20wHhcNMjYwNTI1MTY1
MzQ4WhcNMjYwNTI2MTY1MzQ4WjAfMR0wGwYDVQQDDBRkdWVyb3MtYXBpLmJhaWR1
LmNvbTCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAMiBvSEeg3DnXL3d
yRmpX3f+cz1lq0PR6aZFnw0wKi5LeJZX60XjzoYIkcahF4bZnv6qQ5UpP4BxfKnq
q0TXm/VXrLIFEWk+d1MsA08sRqs8OY5pkD0o0CcMb1plLhYI7YFeXL6o+LMwzgqv
EvCEjuWMxWqlzWLvoxRHUWWNeMYsRSS9DeaWJPohsfJeqvJiSq94dmVtyYObQV18
7yiwSmDV+IBWYBvxoo8LY4trz+4yT/dt4P4CslIurN30DQMjzdbgd3DtuFKXTj6y
EtrpEtZfxsjDaBmYG68z/QX2oZ62ijxw4lGdDwAU/cRva/33/fzLNeR80YI3xyq+
9GMvqW8CAwEAAaN0MHIwHQYDVR0OBBYEFLlZ0frTQ4eHyPd4kJdWKr6OoGJgMB8G
A1UdIwQYMBaAFLlZ0frTQ4eHyPd4kJdWKr6OoGJgMA8GA1UdEwEB/wQFMAMBAf8w
HwYDVR0RBBgwFoIUZHVlcm9zLWFwaS5iYWlkdS5jb20wDQYJKoZIhvcNAQELBQAD
ggEBAHFqBBchsPP19aqjh02qVWxeFySkvLPdex0RGF+MUeqdixKCKxfj7/xBYlYS
2Ea/3FAZwBFibR8Rjs2tQM1ka7tJZ5NjUl3NRrDNMvxJXuNhdhiLjcuRR2UkwFj2
q2/AHRmKV6zmb/E0tR+uWbvewJM7Ilvj6wrWDWjMTQ0qRzFGPvqJX2h2uyYJszrQ
SIrqF6ziifC1yDyqSZxNWOfV3r18+3dV57byTmqUxCJ2bZzwwkeuYQdlDIm+l57y
Rli9lKL8tsDOaE72fxbr95FRVxA1IrFb5gTcY3GOp7nxukH8a11Xu1wzebOIK9as
dBwO3xeDZBUFavYOVRf66leH5k0=
-----END CERTIFICATE-----`;

const baseSession = {
  sessionId: 'session-1',
  application: { applicationId: 'app-1' },
  user: { userId: 'user-1' }
};

const baseContext = {
  System: {
    device: {
      deviceId: 'device-1'
    }
  }
};

function request(type: string, extra: Record<string, unknown> = {}) {
  return {
    version: '2.0',
    session: baseSession,
    context: baseContext,
    request: {
      type,
      requestId: 'request-1',
      timestamp: new Date().toISOString(),
      ...extra
    }
  };
}

function intent(name: string, slots: Record<string, { value?: string }> = {}) {
  return request('IntentRequest', {
    intent: {
      name,
      slots
    }
  });
}

function signedHeaders(rawBody: string) {
  return {
    'content-type': 'application/json',
    signaturecerturl: 'https://duer.bdstatic.com/saiya/flow/dueros-api.baidu.com.cer.txt',
    signature: createSign('RSA-SHA1').update(rawBody).end().sign(testDuerOsPrivateKey).toString('base64')
  };
}

describe('DuerOS webhook', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'xiaodu-test-'));
    vi.stubEnv('DB_PATH', join(dir, 'app.db'));
    vi.stubEnv('LLM_API_KEY', 'test-key');
    vi.stubEnv('LLM_BASE_URL', 'https://llm.example.test/v1');
    vi.stubEnv('LLM_MODEL', 'test-model');
    vi.stubEnv('MAX_HISTORY_MESSAGES', '12');
    vi.stubEnv('MAX_REPLY_CHARS', '120');
    vi.stubEnv('HA_ENABLED', 'false');
    vi.stubEnv('DUEROS_VERIFY_SIGNATURE', 'false');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    rmSync(dir, { recursive: true, force: true });
  });

  test('GET /health returns ok', async () => {
    const app = await buildApp();
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
  });

  test('LaunchRequest keeps the session open', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/dueros',
      payload: request('LaunchRequest')
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().response.outputSpeech.text).toBe('我在，想问什么？');
    expect(response.json().response.shouldEndSession).toBe(false);
  });

  test('exit intent ends the session', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/dueros',
      payload: intent('AskLLMIntent', { query: { value: '再见' } })
    });

    expect(response.json().response.outputSpeech.text).toBe('好的，再见。');
    expect(response.json().response.shouldEndSession).toBe(true);
  });

  test('help intent returns voice help text', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/dueros',
      payload: intent('HelpIntent')
    });

    expect(response.json().response.outputSpeech.text).toBe('你可以问我问题，也可以让我查询或控制家里的设备。');
    expect(response.json().response.shouldEndSession).toBe(false);
  });

  test('LLM response is normalized for voice and stored with context', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: '# 标题\n- 第一条\n```ts\ncode\n```\n回答 **内容**' } }]
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    const app = await buildApp();
    const first = await app.inject({
      method: 'POST',
      url: '/dueros',
      payload: intent('AskLLMIntent', { query: { value: '你好' } })
    });

    expect(first.json().response.outputSpeech.text).toBe('标题 第一条 回答 内容');
    expect(first.json().response.outputSpeech.text).not.toMatch(/[#*`-]/);

    await app.inject({
      method: 'POST',
      url: '/dueros',
      payload: intent('AskLLMIntent', { query: { value: '继续' } })
    });

    const secondBody = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(secondBody.messages.some((m: { role: string; content: string }) => m.role === 'assistant' && m.content === '标题 第一条 回答 内容')).toBe(true);
  });

  test('LLM failure returns friendly voice response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('bad', { status: 500 })));

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/dueros',
      payload: intent('AskLLMIntent', { query: { value: '讲个笑话' } })
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().response.outputSpeech.text).toBe('我这边暂时有点忙，稍后再试一下。');
  });

  test('default intent uses request query text when no slots are present', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: '你好，我在。' } }]
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/dueros',
      payload: request('IntentRequest', {
        query: {
          type: 'TEXT',
          original: '你好',
          rewritten: '你好'
        },
        intents: [
          {
            name: 'ai.dueros.common.default_intent',
            score: 100,
            confirmationStatus: 'NONE',
            slots: {}
          }
        ]
      })
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().response.outputSpeech.text).toBe('你好，我在。');
    const llmBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(llmBody.messages.at(-1)).toEqual({ role: 'user', content: '你好' });
  });

  test('HA disabled does not call Home Assistant for device commands', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: '已收到' } }]
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const app = await buildApp();
    await app.inject({
      method: 'POST',
      url: '/dueros',
      payload: intent('AskLLMIntent', { query: { value: '打开客厅灯' } })
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://llm.example.test/v1/chat/completions');
  });

  test('HA enabled executes mapped light control through REST API', async () => {
    vi.stubEnv('HA_ENABLED', 'true');
    vi.stubEnv('HA_BASE_URL', 'http://ha.example.test');
    vi.stubEnv('HA_TOKEN', 'ha-token');
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/dueros',
      payload: intent('AskLLMIntent', { query: { value: '打开客厅灯' } })
    });

    expect(response.json().response.outputSpeech.text).toBe('已打开客厅灯。');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe('http://ha.example.test/api/services/light/turn_on');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({ entity_id: 'light.living_room' });
  });

  test('HA enabled queries mapped entity state through REST API', async () => {
    vi.stubEnv('HA_ENABLED', 'true');
    vi.stubEnv('HA_BASE_URL', 'http://ha.example.test');
    vi.stubEnv('HA_TOKEN', 'ha-token');
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ state: 'on' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/dueros',
      payload: intent('AskLLMIntent', { query: { value: '客厅灯开着吗' } })
    });

    expect(response.json().response.outputSpeech.text).toBe('客厅灯现在是开着。');
    expect(String(fetchMock.mock.calls[0][0])).toBe('http://ha.example.test/api/states/light.living_room');
  });

  test('high risk controls create pending confirmation without executing HA service', async () => {
    vi.stubEnv('HA_ENABLED', 'true');
    vi.stubEnv('HA_BASE_URL', 'http://ha.example.test');
    vi.stubEnv('HA_TOKEN', 'ha-token');
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const app = await buildApp();
    const first = await app.inject({
      method: 'POST',
      url: '/dueros',
      payload: intent('AskLLMIntent', { query: { value: '打开门锁' } })
    });

    expect(first.json().response.outputSpeech.text).toBe('这个设备比较敏感，请确认是否继续？');
    expect(fetchMock).not.toHaveBeenCalled();

    const second = await app.inject({
      method: 'POST',
      url: '/dueros',
      payload: intent('AskLLMIntent', { query: { value: '确认' } })
    });

    expect(second.json().response.outputSpeech.text).toBe('为了安全，这类设备暂不支持语音直接控制。');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('rejects unsigned DuerOS requests when signature verification is enabled', async () => {
    vi.stubEnv('DUEROS_VERIFY_SIGNATURE', 'true');

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/dueros',
      payload: request('LaunchRequest')
    });

    expect(response.statusCode).toBe(401);
  });

  test('accepts signed DuerOS requests when signature verification is enabled', async () => {
    vi.stubEnv('DUEROS_VERIFY_SIGNATURE', 'true');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(testDuerOsCert, { status: 200 })));
    const rawBody = JSON.stringify(request('LaunchRequest'));

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/dueros',
      headers: signedHeaders(rawBody),
      payload: rawBody
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().response.outputSpeech.text).toBe('我在，想问什么？');
  });

  test('accepts signed DuerOS requests with unix second timestamps', async () => {
    vi.stubEnv('DUEROS_VERIFY_SIGNATURE', 'true');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(testDuerOsCert, { status: 200 })));
    const rawBody = JSON.stringify(request('LaunchRequest', { timestamp: Math.floor(Date.now() / 1000).toString() }));

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/dueros',
      headers: signedHeaders(rawBody),
      payload: rawBody
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().response.outputSpeech.text).toBe('我在，想问什么？');
  });

  test('accepts signed DuerOS requests with decimal unix second timestamps', async () => {
    vi.stubEnv('DUEROS_VERIFY_SIGNATURE', 'true');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(testDuerOsCert, { status: 200 })));
    const rawBody = JSON.stringify(request('LaunchRequest', { timestamp: (Date.now() / 1000).toString() }));

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/dueros',
      headers: signedHeaders(rawBody),
      payload: rawBody
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().response.outputSpeech.text).toBe('我在，想问什么？');
  });

  test('rejects stale signed DuerOS requests', async () => {
    vi.stubEnv('DUEROS_VERIFY_SIGNATURE', 'true');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(testDuerOsCert, { status: 200 })));
    const rawBody = JSON.stringify(request('LaunchRequest', { timestamp: '2020-01-01T00:00:00.000Z' }));

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/dueros',
      headers: signedHeaders(rawBody),
      payload: rawBody
    });

    expect(response.statusCode).toBe(401);
  });
});

describe('DuerOS parser', () => {
  test('extracts query with configured slot priority and fallback concatenation', () => {
    expect(extractQuery({ query: { value: '优先问题' }, text: { value: '文本' } })).toBe('优先问题');
    expect(extractQuery({ text: { value: '文本' }, content: { value: '内容' } })).toBe('文本');
    expect(extractQuery({ first: { value: '打开' }, second: { value: '客厅灯' } })).toBe('打开 客厅灯');
  });
});

describe('conversation store', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'xiaodu-db-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test('reads only the most recent configured messages', () => {
    const db = createDb(join(dir, 'app.db'));
    const store = createConversationStore(db, 12);

    for (let i = 0; i < 15; i += 1) {
      store.addMessage('user-key', 'session-1', 'user', `message-${i}`);
    }

    const history = store.getHistory('user-key');
    expect(history).toHaveLength(12);
    expect(history[0].content).toBe('message-3');
    expect(history[11].content).toBe('message-14');
    db.close();
  });
});

describe('normalizeForTts', () => {
  test('removes markdown, headings, lists, code blocks, and excess whitespace', () => {
    expect(normalizeForTts('## 标题\n\n1. 第一项\n- 第二项\n```js\nconst a = 1\n```\n**重点**')).toBe('标题 第一项 第二项 重点');
  });

  test('truncates long replies and asks whether to continue', () => {
    const text = normalizeForTts('一二三四五六七八九十', 5);
    expect(text).toBe('一二三四五要不要我继续说？');
  });
});

describe('project deliverables', () => {
  test('includes Docker and README files required by the goal spec', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
      packageManager?: string;
      devDependencies?: Record<string, string>;
    };
    expect(packageJson.packageManager).toBe('pnpm@10.33.4');
    expect(packageJson.devDependencies?.['@types/node']).toMatch(/^\^20\./);

    expect(readFileSync('.npmrc', 'utf8')).toContain('confirmModulesPurge=false');

    expect(existsSync('Dockerfile')).toBe(true);
    expect(existsSync('docker-compose.yml')).toBe(true);
    expect(existsSync('README.md')).toBe(true);

    const dockerfile = readFileSync('Dockerfile', 'utf8');
    expect(dockerfile).toContain('FROM node:20-bookworm-slim AS build');
    expect(dockerfile).toContain('corepack enable');
    expect(dockerfile).toContain('python3 make g++');
    expect(dockerfile).toContain('gosu');
    expect(dockerfile).toContain('pnpm install --frozen-lockfile');
    expect(dockerfile).toContain('pnpm build');
    expect(dockerfile).toContain('docker-entrypoint.sh');
    expect(readFileSync('docker-entrypoint.sh', 'utf8')).toContain('chown -R node:node /app/data');

    const compose = readFileSync('docker-compose.yml', 'utf8');
    expect(compose).toContain('image: xiaodu-llm-assistant:latest');
    expect(compose).toContain('build:');
    expect(compose).toContain('context: .');
    expect(compose).toContain('pull: true');
    expect(compose).toContain('"3000:3000"');
    expect(compose).toContain('env_file:');
    expect(compose).toContain('./xiaodu.env');
    expect(compose).toContain('DB_PATH: /app/data/app.db');
    expect(compose).toContain('xiaodu-data:/app/data');
    expect(compose).toContain('xiaodu-data:');
    expect(compose).toContain('healthcheck:');
    expect(readFileSync('xiaodu.env.example', 'utf8')).toContain('LLM_API_KEY=sk-xxxx');

    const readme = readFileSync('README.md', 'utf8');
    expect(readme).toContain('启动方法');
    expect(readme).toContain('环境变量');
    expect(readme).toContain('DuerOS');
    expect(readme).toContain('curl');
    expect(readme).toContain('小度测试话术');
    expect(readme).toContain('Home Assistant');
  });
});
