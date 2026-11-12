/** 云存档客户端：启用条件 / 未开通自动关闭 / 自动槽节流 / 云端更新拉回本机 / 409 不覆盖 */
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const lib = join(dirname(fileURLToPath(import.meta.url)), '..', 'Romance', 'src', 'lib', 'cloudSaves.ts');
let n = 0;
// 每个用例重新加载模块，避免「未开通」等会话状态串用例
const fresh = () => import(`${pathToFileURL(lib).href}?t=${n++}`);

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
const login = () => store.set('auth-storage', JSON.stringify({ state: { user: { token: 'tk' } } }));
const logout = () => store.delete('auth-storage');

function mockFetch(handler) {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method, body: init.body ? JSON.parse(init.body) : undefined, auth: init.headers?.Authorization });
    const { status = 200, json = { success: true } } = (await handler(String(url), init)) ?? {};
    return { ok: status < 400, status, json: async () => json };
  };
  return calls;
}
const tick = (ms = 5) => new Promise((r) => setTimeout(r, ms));

test('cloud_未登录/无作品/预览时不请求', async () => {
  const c = await fresh();
  const calls = mockFetch(() => ({}));
  logout();
  assert.equal(c.cloudOffReason('g1', false)?.reason, 'not-logged-in');
  login();
  assert.equal(c.cloudOffReason('local', false)?.reason, 'no-game');
  assert.equal(c.cloudOffReason('g1', true)?.reason, 'preview');
  assert.equal(c.cloudOffReason('g1', false), null);
  c.queueCloudPush('local', { id: 's1', name: 'a', updatedAt: 1, state: {} }, false);
  await tick();
  assert.equal(calls.length, 0);
});

test('cloud_手动槽立即上传带token_作者预览槽不传', async () => {
  const c = await fresh();
  login();
  const calls = mockFetch(() => ({}));
  c.queueCloudPush('g1', { id: 's1', name: 'a', updatedAt: 1, state: { x: 1 } }, false);
  c.queueCloudPush('g1', { id: '__author_preview_auto', name: 'p', updatedAt: 1, state: {} }, false);
  await tick();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'PUT');
  assert.match(calls[0].url, /\/api\/romance\/saves\/s1\?gameFileId=g1$/);
  assert.equal(calls[0].auth, 'Bearer tk');
  assert.equal(c.getCloudStatus().kind, 'ok');
});

test('cloud_自动槽节流_只传最后一次', async () => {
  const c = await fresh();
  login();
  const calls = mockFetch(() => ({}));
  const slot = (v) => ({ id: 'autosave', name: '自动', updatedAt: v, auto: true, state: { v } });
  c.queueCloudPush('g1', slot(1), false);
  await tick();
  c.queueCloudPush('g1', slot(2), false);
  c.queueCloudPush('g1', slot(3), false);
  await tick();
  assert.equal(calls.length, 1, '节流窗口内不重复上传');
  await c.flushCloudPushes();
  assert.equal(calls.length, 2);
  assert.equal(calls[1].body.state.v, 3, '只上传最后一次进度');
});

test('cloud_接口404时本会话关闭', async () => {
  const c = await fresh();
  login();
  const calls = mockFetch(() => ({ status: 404, json: {} }));
  c.queueCloudPush('g1', { id: 's1', name: 'a', updatedAt: 1, state: {} }, false);
  await tick();
  assert.deepEqual(c.getCloudStatus(), { kind: 'off', reason: 'unavailable' });
  assert.match(c.cloudStatusText(c.getCloudStatus()), /暂未开通/);
  c.queueCloudPush('g1', { id: 's2', name: 'b', updatedAt: 1, state: {} }, false);
  await tick();
  assert.equal(calls.length, 1, '关闭后不再请求');
});

test('cloud_409不覆盖云端', async () => {
  const c = await fresh();
  login();
  mockFetch(() => ({ status: 409, json: { success: false, code: 'STALE_SAVE', message: 'stale' } }));
  c.queueCloudPush('g1', { id: 's1', name: 'a', updatedAt: 1, state: {} }, false);
  await tick();
  assert.equal(c.getCloudStatus().kind, 'error');
  assert.match(c.getCloudStatus().message, /云端有更新的进度/);
});

test('cloud_拉取只下载比本机新的槽', async () => {
  const c = await fresh();
  login();
  const calls = mockFetch((url) => {
    if (/saves\?gameFileId/.test(url)) {
      return { json: { success: true, data: { items: [
        { id: 'autosave', name: '自动', updatedAt: 200, auto: true },
        { id: 's1', name: '旧', updatedAt: 50 },
        { id: '__author_preview_auto', name: 'p', updatedAt: 999 },
      ] } } };
    }
    return { json: { success: true, data: { id: 'autosave', name: '自动', updatedAt: 200, auto: true, state: { from: 'cloud' } } } };
  });
  const written = [];
  const local = new Map([['autosave', 100], ['s1', 80]]);
  const got = await c.pullCloudSaves('g1', false, local, async (s) => { written.push(s); return true; });
  assert.equal(got, 1);
  assert.equal(written[0].state.from, 'cloud');
  assert.equal(calls.filter((x) => /saves\/autosave/.test(x.url)).length, 1);
  assert.equal(calls.filter((x) => /saves\/s1|author_preview/.test(x.url)).length, 0);
});
