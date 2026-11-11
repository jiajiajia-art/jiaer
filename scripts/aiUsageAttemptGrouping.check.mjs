import assert from 'node:assert/strict';
import { groupTxtDocParseAttempts } from '../src/lib/groupTxtDocParseAttempts.ts';

const base = {
  sessionId: 'file-1',
  userId: 'user-1',
  userNickname: 'Neo',
  userCode: 'neo',
  fileId: 'file-1',
  gameTitle: 'Test game',
  platformSource: 'txt_doc_parse',
  attemptNo: 1,
  status: 'succeeded',
  gatewayRoute: 'doubao',
  modelId: 'doubao-seed',
  billingVersionId: 1,
  billingModelRateId: 2,
  inputPriceX10000: 45,
  outputPriceX10000: 135,
  cachedInputPriceX10000: 2,
  imageUpstreamCostYuanX10000: null,
  imageUserBasePriceKkX10000: null,
  inputTokens: 100,
  outputTokens: 20,
  cachedInputTokens: 0,
  imageCount: 0,
  imageAspectRatio: null,
  platformCostMicroYuan: 10000,
  currencyType: 'points',
  userChargeMicroUnits: 0,
  settlementStatus: 'unallocated',
  allocatedUnits: 0,
  billedToUser: false,
  failureCode: null,
  failureMessage: null,
  startedAt: '2026-11-04T10:00:00.000Z',
  finishedAt: '2026-11-04T10:00:01.000Z',
  createdAt: '2026-11-04T10:00:00.000Z',
};

const rows = [
  { ...base, id: 'req-1:1', requestId: 'req-1', attemptNo: 1, inputTokens: 100, outputTokens: 20, platformCostMicroYuan: 10000 },
  { ...base, id: 'req-1:2', requestId: 'req-1', attemptNo: 2, inputTokens: 200, outputTokens: 30, platformCostMicroYuan: 20000 },
  { ...base, id: 'req-1:3', requestId: 'req-1', attemptNo: 3, inputTokens: 300, outputTokens: 40, platformCostMicroYuan: 30000 },
  { ...base, id: 'req-1:4:charge', requestId: 'req-1', attemptNo: 4, inputTokens: 600, outputTokens: 90, platformCostMicroYuan: 0, userChargeMicroUnits: 5_600_000, settlementStatus: 'captured', allocatedUnits: 6, billedToUser: true },
  { ...base, id: 'other:1', requestId: 'other', platformSource: 'platform', allocatedUnits: 2, billedToUser: true },
];

const grouped = groupTxtDocParseAttempts(rows);
assert.equal(grouped.length, 2);
const document = grouped.find((row) => row.requestId === 'req-1');
assert.equal(document.isTxtDocParseSummary, true);
assert.equal(document.attemptCount, 3);
assert.equal(document.inputTokens, 600);
assert.equal(document.outputTokens, 90);
assert.equal(document.platformCostMicroYuan, 60000);
assert.equal(document.allocatedUnits, 6);
assert.equal(document.userChargeMicroUnits, 5_600_000);
assert.equal(grouped.find((row) => row.requestId === 'other').id, 'other:1');

console.log('Passed TXT document attempt aggregation checks');
