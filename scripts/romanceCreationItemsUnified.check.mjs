/**
 * 建角字段统一列表：属性 / 字段 / 开局资金不再分三块；
 * 单一「＋ 添加」选 文本/单选/数值/日期/货币；系统四项置顶不可删。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const romance = join(root, "Romance/src");
const read = (p) => readFileSync(join(romance, p), "utf8");
const items = await import(pathToFileURL(join(romance, "lib/creationItems.ts")).href);

const panel = read("components/ModEditorPanel.tsx");
const editor = read("components/ModCreationFieldsEditor.tsx");
const attrsEd = read("components/ModAttrsEditor.tsx");
const create = read("components/CharacterCreate.tsx");
const types = read("lib/types.ts");
const data = read("game/data.ts");

const createSec = panel.slice(panel.indexOf('title="建角"'), panel.indexOf('title="地点"'));

test("creationItems_添加类型固定为文本单选数值日期货币", () => {
  assert.deepEqual(items.CREATION_ITEM_ADD_TYPES.map((t) => t.id), ["text", "radio", "number", "date", "currency"]);
  assert.deepEqual(items.CREATION_ITEM_ADD_TYPES.map((t) => t.label), ["文本", "单选", "数值", "日期", "货币"]);
  assert.match(items.CURRENCY_ATTR_DESC, /这是货币/);
  const num = items.newNumberAttr("a1");
  assert.equal(num.label, "新数值");
  assert.equal(num.init, 0);
  assert.equal(num.max, 100);
  const cur = items.newCurrencyAttr("c1");
  assert.equal(cur.label, "金币");
  assert.match(cur.desc, /这是货币/);
  assert.equal(cur.max, undefined);
  assert.equal(items.creationAttrKindLabel(cur), "货币");
  assert.equal(items.creationAttrKindLabel(num), "数值");
});

test("visibleCreatorAttrs_隐藏项不进建角预览列表", () => {
  assert.deepEqual(items.visibleCreatorAttrs(undefined), []);
  assert.deepEqual(
    items.visibleCreatorAttrs([
      { id: "a", label: "可见", init: 1 },
      { id: "b", label: "藏", init: 2, hidden: true },
    ]).map((a) => a.id),
    ["a"],
  );
});

test("ModEditorPanel_建角区不再拆属性字段开局资金三块", () => {
  assert.match(createSec, /ModCreationFieldsEditor/);
  assert.doesNotMatch(createSec, /ModAttrsEditor/);
  assert.doesNotMatch(createSec, /mb-2 text-\[12px\] font-bold text-ink">属性</);
  assert.doesNotMatch(createSec, /mb-2 text-\[12px\] font-bold text-ink">字段</);
  assert.doesNotMatch(createSec, /mb-2 text-\[12px\] font-bold text-ink">开局资金</);
  assert.match(createSec, /onStartMoney=/);
  assert.match(createSec, /onAttrs=/);
  assert.match(createSec, /startMoney=\{c\.startMoney\}/);
  // Section 标题仍是「建角」；列表内标题才是「建角字段」
  assert.doesNotMatch(panel, /title="建角字段"/);
  assert.match(editor, /建角字段/);
});

test("ModCreationFieldsEditor_统一添加与系统四项置顶", () => {
  assert.match(editor, /SYSTEM_CREATION_FIELDS/);
  assert.match(editor, /始终必填、不可隐藏或删除/);
  assert.match(editor, /系统字段/);
  assert.match(editor, /开局资金/);
  assert.match(editor, /authorField: "author-field-start-money"/);
  assert.match(editor, /货币名称/);
  assert.match(editor, /Badge tone="gold">必填/);
  assert.doesNotMatch(editor, /Badge tone="jade">货币/);
  assert.match(editor, /货币名称/);
  assert.match(editor, /＋ 添加</);
  assert.doesNotMatch(editor, /＋ 添加字段/);
  assert.doesNotMatch(editor, /＋ 添加属性/);
  assert.doesNotMatch(editor, /＋ 添加货币/);
  assert.match(editor, /分档（多少分叫什么）/);
  for (const label of ["文本", "单选", "数值", "日期", "货币"]) {
    assert.match(editor, new RegExp(label));
  }
  assert.match(editor, /CREATION_ITEM_ADD_TYPES/);
  assert.match(editor, /AttrDefForm/);
  // 功能注释：范围/开局/隐藏/状态栏在 AttrDefForm；统一列表必须挂上该表单
  assert.match(attrsEd, /建角页隐藏/);
  assert.match(attrsEd, /显示在顶部状态栏/);
  // 功能注释：渲染顺序——BUILTINS.map → 开局资金 row → 统一添加（避开「＋ 添加性别」等其它按钮）
  const builtinsMap = editor.indexOf("{BUILTINS.map");
  const money = editor.indexOf('row("startMoney"');
  const addBtn = editor.indexOf('setPicking(true)');
  assert.ok(builtinsMap > 0 && money > builtinsMap && addBtn > money, "系统项 → 开局资金 → 添加按钮");
});

test("AttrDef_支持hidden且表单含范围开局隐藏状态栏", () => {
  assert.match(types, /hidden\?: boolean/);
  assert.match(attrsEd, /建角页隐藏/);
  assert.match(attrsEd, /显示在顶部状态栏/);
  assert.match(attrsEd, /开局取值/);
  assert.match(attrsEd, /固定数值/);
  assert.doesNotMatch(attrsEd, />投骰子</);
  assert.match(attrsEd, /type="checkbox"/);
  assert.match(attrsEd, /属性说明/);
  assert.match(attrsEd, /AttrDefForm/);
});

test("CreationFieldType_含date且建角页可填", () => {
  assert.match(data, /"text" \| "textarea" \| "select" \| "radio" \| "number" \| "date"/);
  assert.match(create, /visibleCreatorAttrs/);
  assert.match(create, /f\.type === "date"/);
  assert.match(create, /如：3月15日/);
  // 功能注释：自定义日期禁止原生 type=date，以免触碰「不可自选开局日期」契约
  assert.doesNotMatch(create, /type="date"/);
});

test("禁止再出现拆分入口文案在建角 Section", () => {
  assert.doesNotMatch(createSec, /＋ 添加属性/);
  assert.doesNotMatch(createSec, /＋ 添加字段/);
  assert.doesNotMatch(createSec, /＋ 添加货币/);
  assert.doesNotMatch(createSec, /还没有属性/);
});
