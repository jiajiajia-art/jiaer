/**
 * Romance 真实提审回归（前端）：
 * 1) 发布门禁对齐后端（封面 + 题材）
 * 2) publish 前先 PATCH 双封面 + POST tags，再 POST publish
 * 3) 编辑器「发布」走就绪拦截，WorldGen 传入 prep.mod
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const romance = join(root, "Romance/src");
const read = (rel) => readFileSync(join(romance, rel), "utf8");

const readyMod = await import(pathToFileURL(join(romance, "lib/romancePublishReady.ts")).href);
const draftMod = await import(pathToFileURL(join(romance, "lib/platformRomanceDraft.ts")).href);
const authorMod = await import(pathToFileURL(join(romance, "lib/authorPreview.ts")).href);

const completeMod = (patch = {}) => {
  const { content, ...manifest } = patch;
  return {
    id: "publish-world",
    name: "本地流动回归",
    version: "1.0.0",
    kind: "world",
    themeTagId: 11,
    cover: "https://cdn.example/cover.webp",
    description: "简介",
    ...manifest,
    content: {
      prompt: { scriptTone: "雨夜旅馆的细腻基调。" },
      rooms: { lobby: { name: "大厅", desc: "雨声", exits: {} } },
      startRoom: "lobby",
      cover: { image: "https://cdn.example/cover.webp" },
      ...(content ?? {}),
    },
  };
};

test("assessRomancePublishReady_齐全材料_可提交", () => {
  assert.deepEqual(readyMod.assessRomancePublishReady(completeMod()), []);
});

test("assessRomancePublishReady_缺封面或缺题材_拦截", () => {
  const noCover = readyMod.assessRomancePublishReady(completeMod({
    cover: "",
    content: { cover: {} },
  }));
  assert.ok(noCover.some((i) => i.field === "cover"));

  const noTheme = readyMod.assessRomancePublishReady(completeMod({ themeTagId: null }));
  assert.ok(noTheme.some((i) => i.field === "themeTag"));

  // 功能注释：预览门禁仍可不拦封面；发布门禁必须拦
  assert.deepEqual(authorMod.assessAuthorRequiredFields(completeMod({
    cover: "",
    themeTagId: null,
    content: { cover: {} },
  })), []);
});

/** 功能注释：主站 auth-storage 形态，供 readFunloomAuthToken 读到假 token。 */
function installFakeAuthStorage() {
  const raw = JSON.stringify({ state: { user: { token: "tok" } } });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key) => (key === "auth-storage" ? raw : null),
      setItem: () => {},
      removeItem: () => {},
    },
  });
}

test("publishRomancePlatformDraft_真实顺序_封面题材再publish", async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  // 功能注释：注入假 token / fetch，断言真实场景请求顺序与 payload
  installFakeAuthStorage();

  globalThis.fetch = async (url, init = {}) => {
    const href = String(url);
    const method = String(init.method || "GET").toUpperCase();
    const body = init.body ? JSON.parse(String(init.body)) : null;
    calls.push({ href, method, body });
    if (method === "PATCH" && /\/drafts\/romance\//.test(href)) {
      assert.equal(body.cover_url, "https://cdn.example/cover.webp");
      assert.equal(body.portrait_cover_url, "https://cdn.example/cover.webp");
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }
    if (method === "POST" && /\/api\/auth\/games\/tags$/.test(href)) {
      assert.deepEqual(body.tagIds, [11]);
      assert.equal(body.audienceType, "all");
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }
    if (method === "POST" && /\/api\/auth\/games\/publish$/.test(href)) {
      assert.equal(body.fileId, "fid-1");
      assert.equal(body.priceAmount, 0);
      assert.equal(body.audienceType, "all");
      return new Response(JSON.stringify({
        success: true,
        data: { moderation_status: "pending_review", is_public: 0 },
      }), { status: 200 });
    }
    return new Response(JSON.stringify({ success: false }), { status: 500 });
  };

  try {
    const result = await draftMod.publishRomancePlatformDraft(
      "fid-1",
      { description: "简介", audienceType: "all" },
      { mod: completeMod(), title: "本地流动回归" },
      "http://localhost:5173",
    );
    assert.equal(result.ok, true);
    assert.equal(result.pendingReview, true);
    assert.equal(calls.length, 3);
    assert.match(calls[0].href, /\/drafts\/romance\/fid-1$/);
    assert.equal(calls[0].method, "PATCH");
    assert.match(calls[1].href, /\/api\/auth\/games\/tags$/);
    assert.equal(calls[1].method, "POST");
    assert.match(calls[2].href, /\/api\/auth\/games\/publish$/);
    assert.equal(calls[2].method, "POST");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("publishRomancePlatformDraft_缺题材_不打publish", async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  installFakeAuthStorage();
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ href: String(url), method: String(init.method || "GET").toUpperCase() });
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  };
  try {
    const result = await draftMod.publishRomancePlatformDraft(
      "fid-1",
      { description: "简介", audienceType: "female" },
      { mod: completeMod({ themeTagId: null }) },
      "http://localhost:5173",
    );
    assert.equal(result.ok, false);
    assert.match(result.message, /题材/);
    assert.equal(calls.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("编辑器与向导_发布门禁与prep契约", () => {
  const editor = read("components/ModEditorPanel.tsx");
  const wizard = read("components/WorldGenWizard.tsx");
  const theme = read("components/WorldThemeFields.tsx");
  assert.match(editor, /assessRomancePublishReady/);
  assert.match(editor, /blockIfRequiredMissing\("发布"\)/);
  assert.match(wizard, /publishRomancePlatformDraft\(fileId, input, \{ mod: current/);
  assert.match(theme, /data-author-field="author-field-theme"/);
  assert.match(read("lib/platformRomanceDraft.ts"), /portrait_cover_url/);
  assert.match(read("lib/platformRomanceDraft.ts"), /syncRomancePlatformThemeTags/);
});
