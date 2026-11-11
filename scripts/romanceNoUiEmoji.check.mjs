/**
 * Romance UI：组件里禁止再用 Emoji / 颜文字 / 装饰字符当图标。
 * 允许：纯注释行；聊天表情选择器 CHAT_EMOJIS；日记心情选择器 MOODS。
 * 版权符 © 等法律标记不算图标。
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(root, 'Romance/src/components');

/** 常见 UI 装饰字符（含用户点名的 💭✦♥★🔒⚠✓✕✿❖▣☰😊😤 等） */
const UI_GLYPH =
  /[💭✦♥♡★☆🔒⚠✓✕✿❖▣☰😊😤❀☕📱🙋💼🍉🔥📊🌐🔐🍅📳🎁↩🎙🙂🐱🖥️✉❦✎⚐♪▶⏭⏮❚▦⌕♂♀▲▼▴▾▸◆◇◎◉↗🤩😀😂🥰😍😘😎🤔😭😳😅🙈😴😡🥺😉👍🙏👏💪🤝🌹❤️💕✨🎉🍜🍰🌙⭐😌😢]/;

const ALLOW_IDENT = /CHAT_EMOJIS|const MOODS\s*=/;

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (name.endsWith('.tsx')) acc.push(p);
  }
  return acc;
}

function isCommentLine(s) {
  const t = s.trim();
  return t.startsWith('//') || t.startsWith('/*') || t.startsWith('*') || t.startsWith('*/');
}

test('Romance_components_不应再把Emoji或装饰字符当UI图标', () => {
  const hits = [];
  for (const file of walk(DIR)) {
    const rel = relative(root, file);
    const lines = readFileSync(file, 'utf8').split('\n');
    let inBlock = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (trimmed.includes('/*') && !trimmed.includes('*/')) inBlock = true;
      if (inBlock) {
        if (trimmed.includes('*/')) inBlock = false;
        continue;
      }
      if (isCommentLine(line)) continue;
      if (ALLOW_IDENT.test(line)) continue;
      if (UI_GLYPH.test(line)) {
        hits.push(`${rel}:${i + 1}: ${trimmed.slice(0, 140)}`);
      }
    }
  }
  assert.equal(hits.length, 0, `仍有 UI 装饰字符：\n${hits.join('\n')}`);
});
