/**
 * 系统面板世界书：创作台 → 局内条目转换契约
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  morePromptFormsToWorldBookEntries,
  warehouseWorldBookToEntries,
} from '../src/lib/galgame/systemWorldBook.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('morePromptFormsToWorldBookEntries_缺constant字段视为常驻', () => {
  const entries = morePromptFormsToWorldBookEntries([
    {
      id: 'legacy',
      title: '史莱姆',
      description: '史莱姆设定',
      content: '史莱姆是木系',
      enabled: true,
      // no constant field — 与后端 migrateLegacy 一致，应为常驻
    },
  ]);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].constant, true);
  assert.deepEqual(entries[0].keywords, ['史莱姆']);
  assert.match(entries[0].content, /木系/);
});

test('morePromptFormsToWorldBookEntries_显式constant=false保持触发型', () => {
  const entries = morePromptFormsToWorldBookEntries([
    {
      id: 'keyed',
      title: '史莱姆,木系',
      description: '属性',
      content: '史莱姆是木系',
      constant: false,
      enabled: true,
    },
  ]);
  assert.equal(entries[0].constant, false);
  assert.deepEqual(entries[0].keywords, ['史莱姆', '木系']);
});

test('warehouseWorldBookToEntries_从仓库payload导入并换新id', () => {
  const parsed = warehouseWorldBookToEntries({
    title: '现代与魔法世界',
    payload: {
      entries: [
        {
          id: 'keep_me',
          title: '元素',
          content: '木火风土',
          keywords: ['魔法'],
          constant: true,
          enabled: true,
        },
      ],
    },
  });
  assert.equal(parsed.ok, true);
  assert.equal(parsed.entries.length, 1);
  assert.equal(parsed.entries[0].title, '元素');
  assert.match(parsed.entries[0].content, /木火风土/);
  assert.notEqual(parsed.entries[0].id, 'keep_me');
  assert.match(parsed.entries[0].id, /^wh_/);
});

test('warehouseWorldBookToEntries_仅标题描述也可导入', () => {
  const parsed = warehouseWorldBookToEntries({
    title: '现代与魔法世界',
    description: '世界上确实存在魔法 并且有木、火、风、水、土。',
    tags: ['奇幻'],
    payload: { entries: [] },
  });
  assert.equal(parsed.ok, true);
  assert.equal(parsed.entries.length, 1);
  assert.equal(parsed.entries[0].title, '现代与魔法世界');
  assert.match(parsed.entries[0].content, /魔法/);
  assert.deepEqual(parsed.entries[0].keywords, ['奇幻']);
  assert.equal(parsed.entries[0].constant, true);
});

test('warehouseWorldBookToEntries_完全空内容失败', () => {
  const empty = warehouseWorldBookToEntries({ title: '', description: '', payload: { entries: [] } });
  assert.equal(empty.ok, false);
  assert.equal(empty.entries.length, 0);
  assert.match(String(empty.message), /没有可导入/);
});

test('SystemsPanel_导入页含我的世界书入口', () => {
  const src = readFileSync(
    join(root, 'src/components/Galgame/panels/SystemsPanel.tsx'),
    'utf8',
  );
  assert.match(src, /id: 'mine'/);
  assert.match(src, /我的世界书/);
  assert.match(src, /warehouseWorldBookToEntries/);
  assert.match(src, /warehouseResourcesApi\.list/);
});
