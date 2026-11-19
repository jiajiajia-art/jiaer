import fs from 'node:fs';

const en = JSON.parse(fs.readFileSync('src/i18n/locales/en.json', 'utf8'));

function setPath(root, path, value) {
  const parts = path.split('.');
  let cur = root;
  for (let i = 0; i < parts.length - 1; i++) {
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

const fixes = {
  'adminUi.page_AdminPanel.tbf13680e': 'Document title',
  'adminUi.components_admin_AdminPlatformAppsSection.t22b4334f': 'Draft',
  'adminUi.components_PromotionAdminManager.t22b4334f': 'Draft',
  'bookshelfUi.myMods.filterDraft': 'Draft',
  'bookshelfUi.myMods.updatedSuffix': 'Updated',
  'bookshelfUi.myMods.playModStatus.draft': 'Draft',
  'bookshelfUi.myMods.playModGroup.draft': 'Draft',
  'lottery.shippingForm.address': 'Address',
};

for (const [k, v] of Object.entries(fixes)) setPath(en, k, v);

// 损坏的 JSX 串：改成可读短文案，避免管理端露出中文残片
const broken = en?.adminUi?.components_WithdrawAdminManager?.td0d9082e;
if (typeof broken === 'string' && broken.includes('复制申请单号')) {
  en.adminUi.components_WithdrawAdminManager.td0d9082e = 'Copy request ID';
}

fs.writeFileSync('src/i18n/locales/en.json', `${JSON.stringify(en, null, 2)}\n`);
console.log('fixed remaining en chinese');
