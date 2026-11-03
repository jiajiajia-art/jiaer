import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const romance = join(root, "Romance/src");
const opening = await import(pathToFileURL(join(romance, "lib/openingCharacters.ts")));
const panel = readFileSync(join(romance, "components/ModEditorPanel.tsx"), "utf8");
const pools = readFileSync(join(romance, "components/ModPoolsEditor.tsx"), "utf8");
const store = readFileSync(join(romance, "lib/store.ts"), "utf8");
const wizard = readFileSync(join(romance, "lib/worldGenWizard.ts"), "utf8");
const template = readFileSync(join(romance, "mods/registry.ts"), "utf8");
const data = readFileSync(join(romance, "game/data.ts"), "utf8");
const voice = readFileSync(join(romance, "components/phone/screenShare.tsx"), "utf8");

test("角色开局状态_已认识与联系人使用通用人物开关", () => {
  const result = opening.resolveOpeningCharacterIds([
    { id: "teacher", metStart: true },
    { id: "boss", wxStart: true },
    { id: "stranger" },
  ], ["legacy", "teacher"]);
  assert.deepEqual(result.met, ["legacy", "teacher", "boss"]);
  assert.deepEqual(result.contacts, ["boss"]);
});

test("空人物表_不会自动生成或添加父母", () => {
  assert.deepEqual(opening.resolveOpeningCharacterIds([], []), { met: [], contacts: [] });
  assert.doesNotMatch(store, /familyNpcs\(|FAMILY_NPC_IDS/);
  assert.doesNotMatch(store, /ensureFamily/);
  assert.doesNotMatch(store, /familyWx/);
});

test("人物编辑器_删父母特例并提供两个通用开关", () => {
  assert.doesNotMatch(panel, /父母开局就在微信里/);
  assert.doesNotMatch(panel, /父亲音色/);
  assert.doesNotMatch(panel, /母亲音色/);
  assert.doesNotMatch(panel, /familyWx/);
  assert.doesNotMatch(panel, /familyVoices/);
  assert.match(panel, /开局已认识/);
  assert.match(panel, /出现在联系人/);
  assert.match(panel, /metStart/);
  assert.match(panel, /wxStart/);
});

test("建角编辑器_不再提供内置选项池或人生模拟专用默认值", () => {
  assert.doesNotMatch(panel, /title="建角选项池"/);
  assert.doesNotMatch(panel, /ModPoolsEditor/);
  assert.doesNotMatch(wizard, /id: "creationPools"/);
  assert.doesNotMatch(template, /school: "", parentJobs:/);
  assert.doesNotMatch(template, /styles: \[\{ id: "s1"/);
  assert.doesNotMatch(pools, />母校</);
  assert.doesNotMatch(pools, /父母职业池/);
  assert.doesNotMatch(pools, /parentJobs|schoolText|jobLines|value\.school/);
  assert.match(data, /slot<string\[\]>\("parentJobs", \(\) => RAW_PARENT_JOBS, \(\) => \[\]\)/);
  assert.doesNotMatch(data, /GENERIC_PARENT_JOBS/);
  assert.doesNotMatch(voice, /familyVoices/);
  assert.doesNotMatch(template, /familyWx: wc\.familyWx/);
  assert.doesNotMatch(template, /familyVoices: wc\.familyVoices/);
});