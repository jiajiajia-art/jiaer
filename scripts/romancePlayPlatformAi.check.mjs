/**
 * Romance 局内叙事 / Studio 预览必须可走平台文案模型（play/complete），
 * 有 JWT 时禁止再直连个人 AI Key。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const romance = join(root, "Romance/src");
const aiSrc = readFileSync(join(romance, "lib/ai.ts"), "utf8");
const platSrc = readFileSync(join(romance, "lib/platformPlayAi.ts"), "utf8");
const routesHint = "/api/romance/play/complete";

test("platformPlayAi_注释声明禁止个人Key且路径正确", () => {
  assert.match(platSrc, /禁止读局内「AI 配置」/);
  assert.match(platSrc, /play\/complete/);
  assert.match(platSrc, /export async function completePlayViaPlatform/);
  assert.match(platSrc, /export function hasPlatformPlayAuth/);
  assert.match(platSrc, /pointsDeducted/);
});

test("platformPlayAi_空基址须拼同源api路径", async () => {
  const plat = await import(pathToFileURL(join(romance, "lib/platformPlayAi.ts")).href);
  assert.equal(plat.playCompleteUrl(""), routesHint);
  assert.equal(
    plat.playCompleteUrl("https://kurangames.cn/cn-test-api"),
    `https://kurangames.cn/cn-test-api${routesHint}`,
  );
});

test("ai_ts_有平台JWT时streamChat与complete须走playComplete", () => {
  assert.match(aiSrc, /from "\.\/platformPlayAi\.ts"/);
  assert.match(aiSrc, /hasPlatformPlayAuth\(\)/);
  assert.match(aiSrc, /completePlayViaPlatform/);
  assert.match(aiSrc, /streamChatViaPlatform/);
  // 功能注释：必须静态 import，禁止动态拆包导致发版后旧 hash 404
  assert.doesNotMatch(aiSrc, /await\s+import\(\s*["'].*platformPlayAi/);
  assert.match(aiSrc, /isPersonalConfigured/);
  assert.match(aiSrc, /hasPlatformPlayAuth\(\)\s*\|\|\s*isPersonalConfigured/);
});

test("textLlmConfig_usage含romance_play", () => {
  const catalog = readFileSync(join(root, "src/lib/textLlmConfig.ts"), "utf8");
  assert.match(catalog, /key:\s*'romance_play'/);
});
