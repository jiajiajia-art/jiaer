/**
 * Create 页：更多服务在邀请卡下方，且为图标网格布局。
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

  // 功能注释：精简后邀请卡直接接下「更多服务」网格
  assert.match(
    create,
    /<InviteCampaignCard\s*\/>\s*<ProfileFunctionPanel\s*\/>/,
  );
  assert.doesNotMatch(create, /className=\{styles\.worksSection\}[\s\S]*<ProfileFunctionPanel/);
  assert.match(panel, /functionGrid/);
  assert.match(panel, /functionGridItem/);
  assert.match(panel, /MdOutlinePlayCircle/);
  // 功能注释：7.1 去掉「消费记录」入口；文案键可仍留在 i18n，面板不得再挂入口
  assert.doesNotMatch(panel, /profile\.purchaseRecords|\/asset\/details|MdOutlineReceiptLong/);
  assert.doesNotMatch(panel, /personalAsset\(/);
  assert.match(css, /\.functionGrid\s*\{[^}]*grid-template-columns:\s*repeat\(4/);
  assert.match(css, /\.functionGridItem\s*\{[^}]*flex-direction:\s*column/);
  assert.match(css, /\.functionGridIcon\s+svg\s*\{[^}]*width:\s*30px/);
});
