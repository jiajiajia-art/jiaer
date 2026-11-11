/**
 * 顶栏菜单按钮必须有默认 IconMenu，禁止 DiyIcon 空 children 导致空白圆
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const romance = join(dirname(fileURLToPath(import.meta.url)), '..', 'Romance/src');

test('TopbarView_菜单按钮须带IconMenu兜底', () => {
  const src = readFileSync(join(romance, 'components/TopbarView.tsx'), 'utf8');
  assert.match(src, /slot="top\.menu"[\s\S]*?<IconMenu/);
  assert.doesNotMatch(src, /slot="top\.menu"\s+size=\{\d+\}><\/DiyIcon>/);
});

test('IconDiyPanel_菜单预览须带IconMenu兜底', () => {
  const src = readFileSync(join(romance, 'components/IconDiyPanel.tsx'), 'utf8');
  assert.match(src, /slot="top\.menu"[\s\S]*?<IconMenu/);
});
