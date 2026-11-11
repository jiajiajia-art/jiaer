/**
 * 开场页助手必须走平台文案模型（world-gen/complete），禁止本机 AI 配置个人 Key。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "Romance/src/components/OpeningStyleStudio.tsx"), "utf8");
const platform = readFileSync(join(root, "Romance/src/lib/platformWorldGenAi.ts"), "utf8");

test("OpeningStyleStudio_走completeViaPlatform_禁止个人Key", () => {
  assert.match(src, /from "\.\.\/lib\/platformWorldGenAi"/);
  assert.match(src, /completeViaPlatform\(/);
  assert.match(src, /completed\.text|const full = completed\.text/);
  assert.match(src, /moduleId:\s*"opening-style"/);
  assert.match(src, /OPENING_STYLE_MAX_TOKENS/);
  assert.match(src, /readFunloomAuthToken/);
  assert.match(src, /请先登录平台账号/);
  assert.match(src, /平台文案模型/);
  assert.match(src, /AiModelBillingBadge mode="platform"/);
  assert.doesNotMatch(src, /from "\.\.\/lib\/ai"/);
  assert.doesNotMatch(src, /from "\.\.\/lib\/store"/);
  assert.doesNotMatch(src, /loadConfig\(/);
  assert.doesNotMatch(src, /streamChat\(/);
  assert.doesNotMatch(src, /isConfigured\(/);
  assert.doesNotMatch(src, /标准.*升级|tierPicker|st\.tier|st\.upgrade/);
});

test("platformWorldGenAi_注释声明禁止个人Key", () => {
  assert.match(platform, /禁止读局内「AI 配置」/);
  assert.match(platform, /world-gen\/complete/);
  assert.match(platform, /world-gen\/refund/);
  assert.match(platform, /export async function completeViaPlatform/);
  assert.match(platform, /export async function refundWorldGenPointsViaPlatform/);
  assert.match(platform, /pointsDeducted/);
});
