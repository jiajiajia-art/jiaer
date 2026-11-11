/**
 * 开场页助手 / Codex 在平台暗色壳里按钮须可读：
 * - 计费徽章、状态胶囊不用 bg-paper / 浅金糊成白底
 * - .codex-ui 重映射 --jade 后，world-gen 主按钮不能白底白字
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

test("AiModelBillingBadge_用jade珊瑚软底_禁止金底纸底", () => {
  const src = read("Romance/src/components/CodexChat.tsx");
  const i = src.indexOf("export function AiModelBillingBadge");
  assert.ok(i >= 0);
  const block = src.slice(i, i + 700);
  assert.match(block, /bg-jade\/15/);
  assert.match(block, /text-coral/);
  assert.match(block, /ring-jade\/35/);
  assert.doesNotMatch(block, /bg-gold|text-gold|bg-paper/);
});

test("OpeningStyleStudio_状态胶囊禁止rounded-full+bg-paper", () => {
  const src = read("Romance/src/components/OpeningStyleStudio.tsx");
  assert.match(src, /bg-jade\/15 text-coral ring-jade\/35/);
  assert.match(src, /bg-ink\/10 text-ink-soft ring-line/);
  assert.doesNotMatch(src, /rounded-full[^`\n]*bg-paper text-ink-soft/);
});

test("Composer_发送钮用酒红实心圆_禁止白底ui-btn-primary", () => {
  const src = read("Romance/src/components/CodexChat.tsx");
  assert.match(src, /aria-label="发送"[\s\S]{0,160}codex-composer-send/);
  assert.match(src, /aria-label="停止生成"[\s\S]{0,160}codex-composer-send/);
  assert.match(src, /IconSend/);
  assert.doesNotMatch(src, /aria-label="发送"[\s\S]{0,160}ui-btn-primary/);
  assert.doesNotMatch(src, /aria-label="停止生成"[\s\S]{0,160}ui-btn-primary/);
});

test("CSS_codex发送钮酒红白标_禁止world-gen刷成白底圆", () => {
  const css = read("Romance/src/index.css");
  assert.match(css, /\.codex-ui\s*\{\s*--jade:\s*var\(--ink\)/);
  assert.match(css, /\.codex-composer-send\s*\{/);
  assert.match(css, /linear-gradient\(160deg,\s*#d47886/);
  assert.match(css, /\.world-gen-editor\s+\.codex-ui\s+\.codex-composer-send\s*\{/);
  const m = css.match(
    /\.world-gen-editor\s+\.codex-ui\s+\.codex-composer-send\s*\{([^}]+)\}/,
  );
  assert.ok(m, "须有 .world-gen-editor .codex-ui .codex-composer-send 规则");
  const body = m[1];
  assert.match(body, /#a8283c/);
  assert.match(body, /color:\s*#fff\s*!important/);
  assert.doesNotMatch(body, /background-color:\s*var\(--ink\)/);
  assert.doesNotMatch(css, /\.world-gen-editor\s+\.codex-ui\s+\.ui-btn-primary\s*\{/);
});
