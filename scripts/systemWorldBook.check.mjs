/**
 * 系统面板世界书：创作台 → 局内条目转换契约
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { morePromptFormsToWorldBookEntries } from '../src/lib/galgame/systemWorldBook.ts';

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
