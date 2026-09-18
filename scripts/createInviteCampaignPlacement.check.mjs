/**
 * Create 页：邀请好友卡片应挂在「我的账户」面板底部，且不再出现在 ProfileFunctionPanel 列表顶部。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

test('Create_邀请卡片应在账户面板底部且离开功能列表', () => {
  const create = read('src/page/Create.tsx');
  const panel = read('src/components/Profile/ProfileFunctionPanel.tsx');
  const card = read('src/components/Profile/InviteCampaignCard.tsx');

  assert.match(create, /import InviteCampaignCard from '\.\.\/components\/Profile\/InviteCampaignCard'/);
  assert.match(
    create,
    /<\/div>\s*<InviteCampaignCard\s*\/>\s*<TodayEarnPointsPanel\s*\/>\s*<ProfileFunctionPanel\s*\/>\s*<\/div>/,
  );
  assert.doesNotMatch(
    create,
    /accountActionGrid[\s\S]*?<InviteCampaignCard\s*\/>\s*<\/div>/,
  );
  assert.match(card, /InviteRewardModal/);
  assert.match(card, /getInviteStats/);
  assert.match(card, /useInviteCode|handleSubmitInviteCode|fillFriendInviteCode/);
  assert.match(card, /inviteCampaignFields/);
  assert.match(card, /inviteCampaignCodeTray|inviteCampaignCodeRow/);
  assert.match(card, /inviteCampaignRedeemRow/);
  assert.match(card, /inviteCampaignFooterRow/);

  const cardCss = read('src/components/Profile/InviteCampaignCard.module.css');
  assert.match(cardCss, /inviteCampaignFields/);
  assert.match(cardCss, /@media \(min-width: 769px\)[\s\S]*?width:\s*min\(100%,\s*720px\)/);
  assert.match(cardCss, /@media \(min-width: 769px\)[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(0,\s*1fr\)/);
  assert.match(cardCss, /\.inviteCampaignRewardBtn\s*\{[\s\S]*?background:\s*#A8283C/);
  assert.doesNotMatch(cardCss, /\.inviteCampaignRewardBtn\s*\{[\s\S]*?background:\s*#FF3B61/);

  assert.doesNotMatch(card, /inviteCampaignRedeemToggle|showRedeemInvite/);
  assert.doesNotMatch(panel, /inviteCampaignSection/);
  assert.doesNotMatch(panel, /InviteRewardModal/);
  assert.doesNotMatch(panel, /getInviteStats/);
  assert.doesNotMatch(panel, /useInviteCode|redeemInviteCode|showInputInviteCode/);
  assert.match(panel, /profile\.purchaseRecords/);
  assert.match(panel, /\/asset\/details/);
});
