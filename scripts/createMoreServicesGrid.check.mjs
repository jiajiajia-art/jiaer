/**
 * Create 页：更多服务在今日可赚积分下方，且为图标网格布局。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

test('Create_更多服务应在今日赚积分下方且为网格布局', () => {
  const create = read('src/page/Create.tsx');
  const panel = read('src/components/Profile/ProfileFunctionPanel.tsx');
  const css = read('src/page/Profile.module.css');

  assert.match(
    create,
    /<TodayEarnPointsPanel\s*\/>\s*<ProfileFunctionPanel\s*\/>/,
  );
  assert.doesNotMatch(create, /className=\{styles\.worksSection\}[\s\S]*<ProfileFunctionPanel/);
  assert.match(panel, /functionGrid/);
  assert.match(panel, /functionGridItem/);
  assert.match(panel, /MdOutlineHistory|MdOutlineReceiptLong|MdOutlinePlayCircle/);
  assert.match(panel, /profile\.purchaseRecords/);
  assert.doesNotMatch(panel, /personalAsset\(/);
  assert.match(css, /\.functionGrid\s*\{[^}]*grid-template-columns:\s*repeat\(4/);
  assert.match(css, /\.functionGridItem\s*\{[^}]*flex-direction:\s*column/);
  assert.match(css, /\.functionGridIcon\s+svg\s*\{[^}]*width:\s*30px/);

  const zh = read('src/i18n/locales/zh.json');
  assert.match(zh, /"purchaseRecords":\s*"消费记录"/);
});
