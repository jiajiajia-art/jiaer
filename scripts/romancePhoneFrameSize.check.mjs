/**
 * 宽屏仿真手机外框：高度≈游戏画面 85%、竖屏 9:19.5 固定比例；禁止被内容撑变形。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const phone = readFileSync(join(root, "Romance/src/components/Phone.tsx"), "utf8");
const css = readFileSync(join(root, "Romance/src/index.css"), "utf8");

test("Phone_宽屏机身外框固定85%与竖屏比例_不跟内容变形", () => {
  assert.match(phone, /phone-stage/);
  assert.match(phone, /phone-frame-fixed/);
  assert.match(phone, /data-phone-frame="1"/);
  assert.match(phone, /data-phone-stage=\{framed \? "1"/);
  // 功能注释：禁止旧方案 h-full + max-h-780 与内容抢高度导致忽长忽窄
  assert.doesNotMatch(phone, /aspect-\[9\/19\.5\] h-full max-h-\[780px\]/);
  assert.match(css, /\.phone-stage\s*\{/);
  assert.match(css, /container-type:\s*size/);
  assert.match(css, /\.phone-frame-fixed\s*\{/);
  assert.match(css, /aspect-ratio:\s*9\s*\/\s*19\.5/);
  assert.match(css, /85cqh/);
  assert.match(css, /85cqh \* 9 \/ 19\.5|85cqh\s*\*\s*9\s*\/\s*19\.5/);
  assert.match(css, /overflow:\s*hidden/);
});
