/**
 * 建角字段：系统只留姓名/性别/年龄/生日；其余靠统一「＋ 添加」；旧内置全清。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const romance = join(root, "Romance/src");
const systemFields = await import(pathToFileURL(join(romance, "game/creationSystemFields.ts")));
const editor = readFileSync(join(romance, "components/ModCreationFieldsEditor.tsx"), "utf8");
const runtime = readFileSync(join(romance, "components/CharacterCreate.tsx"), "utf8");
const blank = readFileSync(join(romance, "mods/registry.ts"), "utf8");

const FORBIDDEN_PRESET_LABELS = [
  "出道身份",
  "人物描述",
  "气质设定",
  "出身阶层",
  "家世叙述",
  "父亲职业",
  "母亲职业",
  "玩家自填字段",
  "外形风格",
  "家庭背景",
  "职业方向",
  "星座",
];

test("新作品的系统建角字段_固定为姓名性别年龄生日", () => {
  assert.deepEqual(systemFields.SYSTEM_CREATION_FIELDS.map((field) => field.key), ["name", "gender", "age", "birthday"]);
  assert.deepEqual(systemFields.SYSTEM_CREATION_FIELDS.map((field) => field.type), ["text", "radio", "number", "date"]);
});

test("性别选项清洗_始终保留男女并追加去重后的自定义项", () => {
  assert.deepEqual(systemFields.normalizeGenderOptions(), ["男", "女"]);
  assert.deepEqual(systemFields.normalizeGenderOptions(["女", "非二元", "男", " 非二元 ", "", "自定义"]), ["男", "女", "非二元", "自定义"]);
});

test("sanitizeCreationBuiltin_只保留系统四项并丢掉旧内置键", () => {
  const cleaned = systemFields.sanitizeCreationBuiltin({
    name: { label: "名字" },
    gender: { options: ["男", "女", "无"] },
    identity: { label: "出道身份", hidden: false },
    description: { label: "气质设定" },
    style: { hidden: true },
    age: { label: "年纪", locked: true, hidden: true },
  });
  assert.deepEqual(Object.keys(cleaned).sort(), ["age", "gender", "name"]);
  assert.equal(cleaned.name.label, "名字");
  assert.deepEqual(cleaned.gender.options, ["男", "女", "无"]);
  assert.equal(cleaned.age.label, "年纪");
  assert.equal(cleaned.age.locked, undefined);
  assert.equal(cleaned.age.hidden, undefined);
  assert.equal(systemFields.sanitizeCreationBuiltin(undefined), undefined);
});

test("字段编辑器_系统四项不可删除且不预置旧内置标签", () => {
  assert.match(editor, /SYSTEM_CREATION_FIELDS/);
  assert.match(editor, /sanitizeCreationBuiltin/);
  assert.match(editor, /始终必填、不可隐藏或删除/);
  assert.match(editor, /系统字段/);
  assert.match(editor, /玩家必填/);
  assert.match(editor, /上移/);
  assert.match(editor, /下移/);
  assert.match(editor, /男 \/ 女不可删除/);
  // 功能注释：统一添加类型为文本/单选/日期；旧 textarea/select/number 仅兼容已有字段
  for (const type of ["text", "radio", "date"]) assert.match(editor, new RegExp(`"${type}"`));
  assert.match(editor, /＋ 添加</);
  assert.doesNotMatch(editor, /＋ 添加字段/);
  // 功能注释：禁止再把旧娱乐圈项写成系统字段标题；「家庭背景」仅允许出现在自定义字段的条件文案里
  for (const label of ["出道身份", "气质设定", "出身阶层", "家世叙述", "父亲职业", "母亲职业", "玩家自填字段", "外形风格", "职业方向", "星座"]) {
    assert.doesNotMatch(editor, new RegExp(label));
  }
  assert.doesNotMatch(editor, /label:\s*"家庭背景"|key:\s*"family"|BUILTINS\.map[\s\S]{0,80}家庭背景/);
  assert.doesNotMatch(editor, />内置</);
});

test("空白世界观模板_creation不预置fields与旧builtin", () => {
  assert.match(blank, /creation: \{ cta: "开启故事" \}/);
  assert.doesNotMatch(blank, /creation: \{[\s\S]*fields:\s*\[/);
});

test("玩家建角页_只渲染系统四项和作者字段且必填会阻止继续", () => {
  assert.match(runtime, /normalizeGenderOptions\(bf\("gender"\)\.options\)/);
  assert.match(runtime, /const systemFieldsComplete =/);
  assert.match(runtime, /const customFieldsComplete = CUSTOM\.every/);
  assert.match(runtime, /disabled=\{step\.k === "who" && !whoComplete\}/);
  assert.match(runtime, /who: <div className="space-y-3">\{stepWho\}\{stepAttrs\}\{stepCustom\}<\/div>/);
  assert.doesNotMatch(runtime, /stepTalent|stepFamily/);
  assert.doesNotMatch(runtime, /shown\(/);
  for (const label of ["出道身份", "玩家自填字段", "外形风格", "父亲职业", "母亲职业", "出身阶层"]) {
    assert.doesNotMatch(runtime, new RegExp(label));
  }
});
