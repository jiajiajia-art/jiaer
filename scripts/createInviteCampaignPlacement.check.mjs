/**
 * Create 页：邀请好友卡片应挂在「我的账户」面板底部，且不再出现在 ProfileFunctionPanel 列表顶部。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

test('Create_邀请卡片应在账户面板底部且离开功能列表', () => {
  const create = read('src/page/Create.tsx');
  const panel = read('src/components/Profile/ProfileFunctionPanel.tsx');
  const card = read('src/components/Profile/InviteCampaignCard.tsx');
  const authApi = read('src/api/account/authApi.ts');
  const authTypes = read('src/api/account/auth.type.ts');

  assert.match(create, /import InviteCampaignCard from '\.\.\/components\/Profile\/InviteCampaignCard'/);
  // 「今日可赚织梦豆」已迁到独立页 /points/earn，账户面板底部只剩邀请卡片 + 功能面板
  assert.match(
    create,
    /<\/div>\s*<InviteCampaignCard\s*\/>\s*<ProfileFunctionPanel\s*\/>\s*<\/div>/,
  );
  assert.doesNotMatch(
    create,
    /accountActionGrid[\s\S]*?<InviteCampaignCard\s*\/>\s*<\/div>/,
  );
  assert.match(card, /useInviteCode|handleSubmitInviteCode|fillFriendInviteCode/);
  assert.match(card, /refreshUserInfo/);
  assert.match(card, /if \(isSubmittingInvite\) return/);
  assert.match(card, /disabled=\{isSubmittingInvite\}/);
  assert.match(card, /inviteCampaignFields/);
  assert.match(card, /inviteCampaignCodeTray|inviteCampaignCodeRow/);
  assert.match(card, /inviteCampaignRedeemRow/);
  // 邀请统计改由用户信息下发（user.inviteStats），不再单独请求 / 领取
  assert.doesNotMatch(card, /InviteRewardModal|getInviteStats|claimPoints/);
  assert.doesNotMatch(card, /inviteCampaignFooterRow|inviteCampaignMeta|inviteCampaignRewardBtn/);
  assert.doesNotMatch(authApi, /getInviteStats|claimInviteReward|\/auth\/invite\/stats|\/auth\/invite\/claim/);
  assert.doesNotMatch(authTypes, /InviteRewardItem|InviteClaimResult/);
  assert.match(authApi, /api\.post<ApiResponse<InviteCodeUseResult>>\('\/auth\/invite\/use-code'/);
  assert.match(authTypes, /interface InviteCodeUseResult[\s\S]*?diamondsAdded:\s*number[\s\S]*?remainingDiamonds:\s*number[\s\S]*?inviterName:\s*string/);
  assert.equal(existsSync(join(root, 'src/components/InviteRewardModal.tsx')), false);
  assert.equal(existsSync(join(root, 'src/components/InviteRewardModal.module.css')), false);

  const cardCss = read('src/components/Profile/InviteCampaignCard.module.css');
  assert.match(cardCss, /\.inviteCampaignFields\s*\{[\s\S]*?width:\s*100%/);
  assert.match(cardCss, /@media \(min-width: 769px\)[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(0,\s*1fr\)/);
  assert.doesNotMatch(cardCss, /inviteCampaignFooterRow|inviteCampaignMeta|inviteCampaignRewardBtn/);

  const en = read('src/i18n/locales/en.json');
  const zh = read('src/i18n/locales/zh.json');
  // 奖励数额改为参数，且为限时 KK 币
  assert.match(en, /"inviteCampaignTitle":\s*"Invite a friend and you both get \{\{amount\}\} limited-time KK Coins!"/);
  assert.match(zh, /"inviteCampaignTitle":\s*"邀请好友，双方各得 \{\{amount\}\} 限时KK币！"/);
  assert.doesNotMatch(en, /"inviteStatsText"|\n  "inviteReward": \{/);
  assert.doesNotMatch(zh, /"inviteStatsText"|\n  "inviteReward": \{/);

  assert.doesNotMatch(card, /inviteCampaignRedeemToggle|showRedeemInvite/);
  assert.doesNotMatch(panel, /inviteCampaignSection/);
  assert.doesNotMatch(panel, /InviteRewardModal/);
  assert.doesNotMatch(panel, /getInviteStats/);
  assert.doesNotMatch(panel, /useInviteCode|redeemInviteCode|showInputInviteCode/);
  // 消费记录并入资产明细页（/asset/details 的「消费」筛选），入口在账户面板
  assert.match(create, /navigate\('\/asset\/details'\)/);
});
