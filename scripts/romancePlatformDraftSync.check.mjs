/**
 * Romance 书架草稿：同 draftId 只 PATCH 更新；禁止保存路径再 createRomance。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const mod = await import(pathToFileURL(join(root, "Romance/src/lib/platformRomanceDraft.ts")).href);

test("platformRomanceDraft_标题与URL契约", () => {
  assert.equal(mod.resolveRomanceDraftTitle(""), "未命名 Romance 作品");
  assert.equal(mod.resolveRomanceDraftTitle("  星港  "), "星港");
  assert.equal(mod.readRomancePlatformDraftId("?createWorld=1&draftId=abc123"), "abc123");
  assert.equal(mod.readRomancePlatformDraftId("?createWorld=1"), "");
  assert.match(mod.romanceDraftUpdateUrl("fid1", ""), /\/api\/auth\/games\/drafts\/romance\/fid1$/);
});

test("platformRomanceDraft_防抖只更新不create", async () => {
  mod.resetRomancePlatformDraftSyncForTests();
  const calls = [];
  const deps = {
    update: async (fileId, title) => {
      calls.push({ fileId, title });
      return true;
    },
  };
  mod.scheduleRomancePlatformDraftSync("d1", "一", deps, 20);
  mod.scheduleRomancePlatformDraftSync("d1", "二", deps, 20);
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], { fileId: "d1", title: "二" });
  await mod.commitRomancePlatformDraft("d1", "终稿", deps);
  assert.equal(calls.at(-1).title, "终稿");
  mod.resetRomancePlatformDraftSyncForTests();
});

test("WorldGenWizard_保存与自动保存走平台PATCH", () => {
  const wiz = read("Romance/src/components/WorldGenWizard.tsx");
  assert.match(wiz, /commitRomancePlatformDraft/);
  assert.match(wiz, /scheduleRomancePlatformDraftSync/);
  assert.match(wiz, /readRomancePlatformDraftId/);
  assert.doesNotMatch(wiz, /createRomance/);
});

test("CreateType_Romance只在入口create一次", () => {
  const tsx = read("src/page/CreateType.tsx");
  assert.match(tsx, /creatorDraftApi\.createRomance\(\)/);
  assert.equal([...tsx.matchAll(/createRomance\(/g)].length, 1);
  assert.match(tsx, /st_draft_appId/);
  assert.match(tsx, /type === 'st' \|\| type === 'avg'/);
});

test("creatorDraftApi_有updateRomance与dedupe", () => {
  const api = read("src/api/creator/creatorDraftApi.ts");
  assert.match(api, /updateRomance:/);
  assert.match(api, /method:\s*['"]patch['"]|api\.patch/);
  assert.match(api, /dedupe:/);
  assert.doesNotMatch(api, /createRomance[\s\S]*createRomance/);
});

test("StGameCreate_复用本机appId禁止反复create-empty", () => {
  const st = read("src/page/StGameCreate.tsx");
  assert.match(st, /ST_DRAFT_APP_KEY|st_draft_appId/);
  assert.match(st, /localStorage\.setItem\(ST_DRAFT_APP_KEY/);
  assert.match(st, /localStorage\.getItem\(ST_DRAFT_APP_KEY\)/);
});
