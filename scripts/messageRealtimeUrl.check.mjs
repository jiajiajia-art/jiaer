/**
 * 消息 WS：Aliyun 空 HOST 必须同源，禁止回落到 api-test2
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildMessageRealtimeWebSocketUrl } from '../src/hooks/messageRealtimeUrl.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('buildMessageRealtimeWebSocketUrl_绝对HOST直连该主机', () => {
  const url = buildMessageRealtimeWebSocketUrl({
    token: 'abc',
    hostAddress: 'https://api-test2.kurangames.com',
    pageProtocol: 'https:',
    pageHost: 'gogo.kurangames.cn',
  });
  assert.match(url, /^wss:\/\/api-test2\.kurangames\.com\/api\/auth\/messages\/ws/);
  assert.match(url, /[?&]token=abc/);
});

test('buildMessageRealtimeWebSocketUrl_空HOST走当前页同源_禁止api-test2', () => {
  const url = buildMessageRealtimeWebSocketUrl({
    token: 'tok',
    hostAddress: '',
    pageProtocol: 'http:',
    pageHost: 'gogo.kurangames.cn',
  });
  assert.equal(
    url,
    'ws://gogo.kurangames.cn/api/auth/messages/ws?token=tok',
  );
  assert.doesNotMatch(url, /api-test2/);
});

test('buildMessageRealtimeWebSocketUrl_https页用wss', () => {
  const url = buildMessageRealtimeWebSocketUrl({
    token: 'x',
    hostAddress: '',
    pageProtocol: 'https:',
    pageHost: 'kurangames.cn',
  });
  assert.match(url, /^wss:\/\/kurangames\.cn\/api\/auth\/messages\/ws/);
});

test('useMessageRealtime_须用纯函数且禁止硬编码api-test2回落', () => {
  const src = readFileSync(join(root, 'src/hooks/useMessageRealtime.ts'), 'utf8');
  assert.match(src, /buildMessageRealtimeWebSocketUrl/);
  assert.doesNotMatch(src, /api-test2\.kurangames\.com/);
  const util = readFileSync(join(root, 'src/hooks/messageRealtimeUrl.ts'), 'utf8');
  assert.doesNotMatch(util, /api-test2\.kurangames\.com/);
});
