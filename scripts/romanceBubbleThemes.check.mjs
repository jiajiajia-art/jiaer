import test from "node:test";
import assert from "node:assert/strict";
import { BUBBLE_THEMES, scopeCustomCss, bubbleThemesCss } from "../Romance/src/components/phone/bubbleThemes.ts";
test("theme list matches the requested A/B sets", () => {
  const A = BUBBLE_THEMES.filter((t) => t.kind === "A").map((t) => t.label);
  const B = BUBBLE_THEMES.filter((t) => t.kind === "B").map((t) => t.label);
  assert.deepEqual(A, ["默认", "立体3D", "拟态", "柔和条纹", "网格", "可爱风", "简约os"]);
  assert.deepEqual(B, ["拟态2", "古风", "国风", "手绘涂鸦", "手绘涂鸦2", "可爱条纹", "渐变彩虹", "发光果冻", "金属质感", "海洋风", "猫爪风", "绿色", "自定义"]);
  assert.ok(bubbleThemesCss().includes(".wxb-A{background:var(--wxb-bg)"));
});
test("custom css is scoped to bubbles", () => {
  const s = scopeCustomCss(".wxb-me{background:pink} body, .x::before {color:red}");
  assert.ok(s.includes(".wxb-custom:is(.wxb-me){background:pink}"));
  assert.ok(s.includes(".wxb-custom:is(body)") && s.includes(".wxb-custom:is(.x)::before"));
  assert.ok(!/(^|[\s,}])body\s*[,{]/.test(s.replace(/:is\(body\)/g, "")));
});
test("custom css drops imports, remote urls, media, scripts", () => {
  const s = scopeCustomCss('@import url("https://x/a.css"); @media (max-width:1px){body{display:none}} .wxb-me{background:url(https://evil/x.png)} </style><script>');
  assert.ok(!/@import|@media|https:|<\/style/i.test(s), s);
  assert.ok(s.includes("background:none"));
});
test("keyframes kept", () => {
  assert.ok(scopeCustomCss("@keyframes pop{0%{opacity:0}100%{opacity:1}} .wxb-me{animation:pop 1s}").includes("@keyframes pop{0%{opacity:0}100%{opacity:1}}"));
});
