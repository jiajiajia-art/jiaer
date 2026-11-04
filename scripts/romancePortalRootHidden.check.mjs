/**
 * 作者预览：portal 不得挂进 hidden / aria-hidden 的平台壳。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "Romance/src/lib/romancePortalRoot.ts"), "utf8");

test("romancePortalRoot_源码跳过hidden与aria-hidden宿主", () => {
  assert.match(src, /function isUsablePortalHost/);
  assert.match(src, /classList\.contains\("hidden"\)/);
  assert.match(src, /getAttribute\("aria-hidden"\) === "true"/);
  assert.match(src, /querySelectorAll<HTMLElement>\("\[data-author-preview-shell='1'\]"\)/);
  assert.match(src, /querySelectorAll<HTMLElement>\("\[data-platform-ui='1'\]"\)/);
  assert.match(src, /parentElement/);
  assert.match(src, /document\.body/);
});

test("romancePortalRoot_运行时优先预览壳再选可见平台壳", async () => {
  /** 极简 DOM：只实现 romancePortalRoot 用到的 API */
  function el(init) {
    const classNames = new Set((init.className || "").split(/\s+/).filter(Boolean));
    const attrs = { ...(init.attrs || {}) };
    const node = {
      hidden: !!init.hidden,
      classList: { contains: (c) => classNames.has(c) },
      getAttribute: (k) => (k in attrs ? attrs[k] : null),
      parentElement: null,
      _sel: init.sel || [],
    };
    return node;
  }
  const hidden = el({
    className: "romance-platform hidden",
    attrs: { "data-platform-ui": "1", "aria-hidden": "true" },
    sel: ["[data-platform-ui='1']", ".romance-platform"],
  });
  const preview = el({
    className: "author-preview-runtime min-h-screen",
    attrs: { "data-author-preview-shell": "1" },
    sel: ["[data-author-preview-shell='1']"],
  });
  const visible = el({
    className: "romance-platform min-h-screen",
    attrs: { "data-platform-ui": "1" },
    sel: ["[data-platform-ui='1']", ".romance-platform"],
  });
  const body = el({ className: "" });
  const bySel = (sel) => [hidden, preview, visible].filter((n) => n._sel.includes(sel));
  globalThis.document = {
    querySelectorAll: (sel) => bySel(sel),
    querySelector: (sel) => {
      if (sel === ".romance-host") return null;
      return bySel(sel)[0] || null;
    },
    body,
  };

  const mod = await import(
    join(root, "Romance/src/lib/romancePortalRoot.ts") + `?t=${Date.now()}`
  );
  const picked = mod.romancePortalRoot();
  assert.equal(picked, preview);
  assert.notEqual(picked, hidden);
  assert.notEqual(picked, visible);
});
