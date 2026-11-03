/**
 * 生成世界：按用户+作品持久化；生成完成刷新须直达编辑器，不得丢回重新生成。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const romance = join(root, "Romance/src");
const read = (rel) => readFileSync(join(romance, rel), "utf8");

function mockStorage() {
  const mem = new Map();
  const sess = new Map();
  const api = (store) => ({
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => {
      store.set(k, String(v));
    },
    removeItem: (k) => {
      store.delete(k);
    },
  });
  globalThis.localStorage = api(mem);
  globalThis.sessionStorage = api(sess);
  return mem;
}

test("worldGenSessionKey_按用户与draftId隔离并兼容旧键", async () => {
  mockStorage();
  globalThis.localStorage.setItem(
    "auth-storage",
    JSON.stringify({ state: { user: { token: "x", user: { userId: "u42", id: 42 } } } }),
  );
  // 伪造 location.search
  const sess = await import(
    pathToFileURL(join(romance, "lib/worldGenSession.ts")).href + `?k=${Date.now()}`
  );
  const key = sess.worldGenSessionKey("?createWorld=1&draftId=abc123", "u42");
  assert.match(key, /\.u\.u42\.d\.abc123$/);
  const cands = sess.worldGenSessionKeyCandidates("?draftId=abc123");
  assert.ok(cands.some((k) => k.includes("abc123")));
  assert.ok(cands[0].includes("u42") || cands.some((k) => k.includes("u.u42")));
});

test("resolveSessionStep_有基线step2保持编辑器_trim恢复强制step1", async () => {
  mockStorage();
  const sess = await import(
    pathToFileURL(join(romance, "lib/worldGenSession.ts")).href + `?r=${Date.now()}`
  );
  assert.equal(sess.resolveSessionStep(2, true, false), 2);
  assert.equal(sess.resolveSessionStep(2, false, true), 2);
  assert.equal(sess.resolveSessionStep(1, true, false), 1);
  sess.markWorldGenTrimRecover();
  assert.equal(sess.resolveSessionStep(2, true, false), 1);
  sess.clearWorldGenTrimRecover();
});

test("parse与save_生成完成step2刷新仍带mod", async () => {
  const mem = mockStorage();
  globalThis.localStorage.setItem(
    "auth-storage",
    JSON.stringify({ state: { user: { token: "t", user: { userId: "u9" } } } }),
  );
  // location for draftId key — patch via search arg on helpers
  const sess = await import(
    pathToFileURL(join(romance, "lib/worldGenSession.ts")).href + `?s=${Date.now()}`
  );
  const ok = {
    step: 2,
    s1: {
      title: "我是二狗子",
      setting: "没考上大学",
      aiPolish: true,
      engineId: "balanced",
      contentIds: ["world"],
      editorStepIds: ["prompt"],
    },
    draft: {
      title: "我是二狗子",
      setting: "没考上大学",
      aiPolish: true,
      engineId: "balanced",
      contentIds: ["world"],
      editorStepIds: ["prompt"],
    },
    mod: {
      id: "w1",
      name: "我是二狗子",
      version: "0.1.0",
      author: "",
      description: "",
      kind: "world",
      dependencies: [],
      content: {},
    },
    scrollY: 0,
    updatedAt: Date.now(),
  };
  const parsed = sess.parseWorldGenSession(ok);
  assert.equal(parsed?.step, 2);
  assert.ok(parsed?.mod);
  assert.equal(parsed?.mod?.name, "我是二狗子");

  // 写入权威键（无 location 时用无 draft 键）；再 load
  assert.ok(sess.saveWorldGenSession(ok));
  const loaded = sess.loadWorldGenSession();
  assert.equal(loaded?.step, 2);
  assert.ok(loaded?.mod);
  assert.ok([...mem.keys()].some((k) => String(k).includes("worldGenSession")));
});

test("WorldGenWizard_boot直达step2且不把完成态降成step1", () => {
  const wiz = read("components/WorldGenWizard.tsx");
  assert.match(wiz, /loadWorldGenSessionAsync/);
  assert.match(wiz, /wantsResumeEditor/);
  assert.match(wiz, /resumeEditor/);
  assert.match(wiz, /step: \(resumeEditor \? 2 : 1\)/);
  // 禁止再把「有基线」强行落盘成 step1
  assert.doesNotMatch(
    wiz,
    /保留已生成\/已保存基线，但落盘为 step1/,
  );
  assert.match(wiz, /按当前 step 落盘/);
});

test("platformAvatarLibrary_readFunloomUserId", () => {
  const src = read("lib/platformAvatarLibrary.ts");
  assert.match(src, /export function readFunloomUserId/);
  assert.match(src, /user\.userId/);
});

test("CreatorWorksPanel_书架续编带resume=1", () => {
  const panel = readFileSync(
    join(root, "src/components/Create/CreatorWorksPanel.tsx"),
    "utf8",
  );
  assert.match(panel, /createWorld=1&draftId=.*resume=1/);
});
