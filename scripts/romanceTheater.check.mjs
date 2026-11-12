import test from "node:test";
import assert from "node:assert/strict";
import { buildTheaterDirective, parseTheaterOutput, sanitizeTheaterHtml, theaterSrcDoc } from "../Romance/src/lib/theaterFormats.ts";
test("directive mentions format, topic, cast and asks for html", () => {
  const d = buildTheaterDirective("groupchat", "一起过年", ["林若雪", "沈渔"]);
  assert.ok(d.includes("形式：群聊") && d.includes("一起过年") && d.includes("林若雪、沈渔") && d.includes("```html"));
  assert.ok(!buildTheaterDirective("text", "", []).includes("```html"));
});
test("parse title, summary, html", () => {
  const p = parseTheaterOutput("【标题】年夜饭群聊\n```html\n<div style=\"color:red\">嗨</div>\n```\n【梗概】大家在群里抢红包");
  assert.equal(p.title, "年夜饭群聊"); assert.equal(p.summary, "大家在群里抢红包");
  assert.ok(p.html.includes("<div")); assert.equal(p.prose, "");
});
test("parse plain text format", () => {
  const p = parseTheaterOutput("【标题】雨夜\n「沈渔」：伞给你。\n【梗概】借伞");
  assert.equal(p.html, ""); assert.ok(p.prose.includes("伞给你")); assert.ok(!p.prose.includes("梗概"));
});
test("sanitize strips scripts, handlers, js urls, remote resources", () => {
  const s = sanitizeTheaterHtml('<div onclick="x()">a</div><script>alert(1)</script><a href="javascript:evil()">b</a><img src="https://t.co/x.png"><div style="background:url(https://x/y.png)"></div><iframe src="x"></iframe>');
  assert.ok(!/script|onclick|javascript:|https:|iframe/i.test(s), s);
  assert.ok(s.includes("<div>a</div>"));
});
test("srcdoc wraps fragments", () => {
  assert.ok(theaterSrcDoc("<div>x</div>").startsWith("<!doctype html>"));
  assert.ok(theaterSrcDoc("<html><head></head><body>x</body></html>").includes("<head><style>"));
});
