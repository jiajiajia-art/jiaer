import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('CustomerService_前台弹窗与API接线', () => {
  const modals = read('src/components/Layout/CustomerServiceModals.tsx');
  const api = read('src/api/customerService/customerServiceApi.ts');
  const footer = read('src/components/Layout/FooterArea.tsx');
  assert.match(modals, /createFeedback/);
  assert.match(modals, /createBusinessCoop/);
  assert.match(modals, /uploadFeedbackScreenshot/);
  assert.match(modals, /MAX_SCREENSHOTS\s*=\s*3/);
  assert.match(api, /\/customer-service\/feedback/);
  assert.match(api, /\/customer-service\/business-cooperation/);
  assert.match(api, /\/operator\/customer-service\/feedback/);
  assert.match(footer, /setFeedbackOpen\(true\)/);
  assert.match(footer, /setBusinessOpen\(true\)/);
});

test('CustomerService_运营后台页与路由', () => {
  const panel = read('src/page/operator/OperatorPanel.tsx');
  const app = read('src/App.tsx');
  const feedback = read('src/components/admin/SiteFeedbackAdminManager.tsx');
  const business = read('src/components/admin/BusinessCoopAdminManager.tsx');
  assert.match(panel, /SiteFeedbackAdminManager/);
  assert.match(panel, /BusinessCoopAdminManager/);
  assert.match(panel, /\/operator\/feedback/);
  assert.match(panel, /\/operator\/business-coop/);
  assert.match(app, /path="\/operator\/feedback"/);
  assert.match(app, /path="\/operator\/business-coop"/);
  assert.match(feedback, /replyFeedback/);
  assert.match(business, /addBusinessCoopNote/);
  assert.match(business, /指定我为跟进人/);
});

test('CustomerService_消息中心应支持feedback_reply', () => {
  const types = read('src/api/message/message.type.ts');
  const messages = read('src/page/Messages.tsx');
  const view = read('src/lib/messageCenterView.ts');
  assert.match(types, /feedback_reply/);
  assert.match(types, /feedbackReplyNotifications/);
  assert.match(messages, /feedback_reply/);
  assert.match(messages, /handleOpenFeedbackReply/);
  assert.match(view, /feedback_reply/);
});
