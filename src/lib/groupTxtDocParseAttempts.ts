import type { AiBillingUsageAttempt } from '../api/operator/aiModelCenterApi';

export type AiBillingUsageDisplayRow = AiBillingUsageAttempt & {
  isTxtDocParseSummary?: boolean;
  attemptCount?: number;
};

const isChargeAggregate = (row: AiBillingUsageAttempt) => row.id.endsWith(':charge');

function sum(rows: AiBillingUsageAttempt[], field: 'inputTokens' | 'outputTokens' | 'cachedInputTokens' | 'platformCostMicroYuan' | 'userChargeMicroUnits' | 'allocatedUnits') {
  return rows.reduce((total, row) => total + Number(row[field] || 0), 0);
}

function latest(rows: AiBillingUsageAttempt[], field: 'createdAt' | 'finishedAt') {
  return rows.map((row) => row[field]).filter((value): value is string => Boolean(value)).sort().at(-1) || null;
}

export function groupTxtDocParseAttempts(rows: AiBillingUsageAttempt[]): AiBillingUsageDisplayRow[] {
  const groups = new Map<string, AiBillingUsageAttempt[]>();
  for (const row of rows) {
    const key = row.platformSource === 'txt_doc_parse'
      ? `txt:${row.userId || ''}:${row.fileId || ''}:${row.requestId}`
      : `attempt:${row.id}`;
    groups.set(key, [...(groups.get(key) || []), row]);
  }

  return Array.from(groups.values()).map((group) => {
    const first = group[0];
    if (first.platformSource !== 'txt_doc_parse') return first;

    const usageAttempts = group.filter((row) => !isChargeAggregate(row));
    const chargeAggregate = group.find(isChargeAggregate);
    const failedAttempt = usageAttempts.find((row) => row.status === 'failed' || row.status === 'incomplete' || row.status === 'cancelled');
    const status = chargeAggregate?.status || failedAttempt?.status || usageAttempts[0]?.status || first.status;

    return {
      ...first,
      id: `txt-doc-summary:${first.userId || ''}:${first.fileId || ''}:${first.requestId}`,
      isTxtDocParseSummary: true,
      attemptCount: usageAttempts.length,
      attemptNo: usageAttempts.length,
      status,
      inputTokens: sum(usageAttempts, 'inputTokens'),
      outputTokens: sum(usageAttempts, 'outputTokens'),
      cachedInputTokens: sum(usageAttempts, 'cachedInputTokens'),
      platformCostMicroYuan: sum(usageAttempts, 'platformCostMicroYuan'),
      userChargeMicroUnits: sum(group, 'userChargeMicroUnits'),
      allocatedUnits: sum(group, 'allocatedUnits'),
      billedToUser: group.some((row) => row.billedToUser),
      settlementStatus: chargeAggregate?.settlementStatus || status,
      failureCode: failedAttempt?.failureCode || null,
      failureMessage: failedAttempt?.failureMessage || null,
      startedAt: usageAttempts.map((row) => row.startedAt).sort()[0] || first.startedAt,
      finishedAt: latest(group, 'finishedAt'),
      createdAt: latest(group, 'createdAt') || first.createdAt,
    };
  }).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}
