import { decimalToX10000 } from './aiBillingCenter.ts';

const MICRO_CURRENCY_SCALE = 1_000_000n;
const PRICE_SCALE = 10_000n;
const TOKEN_PRICE_UNIT = 1_000_000n;
const USER_TOKEN_PRICE_UNIT = 1_000n;
const MAX_SAFE_INTEGER = BigInt(Number.MAX_SAFE_INTEGER);

export interface TextPricingPreviewContext {
  textUserBasePricePer1kX10000: number;
  memberChargePercent: number;
  kkPerYuan: number;
  kkMinorScale: number;
}

export interface TextPricingPreviewInput {
  inputTokens: string;
  outputTokens: string;
  cachedInputTokens: string;
  inputPrice: string;
  outputPrice: string;
  cachedInputPrice: string;
  multiplier: string;
  context: TextPricingPreviewContext;
}

export interface TextPricingPreviewView {
  userChargeKkMinor: bigint;
  revenueMicroYuan: bigint;
  profitMicroYuan: bigint;
  marginTenths: bigint | null;
}

export interface TextPricingPreviewResult {
  realCostMicroYuan: bigint;
  regular: TextPricingPreviewView;
  member: TextPricingPreviewView;
}

function roundDivide(numerator: bigint, denominator: bigint): bigint {
  if (numerator < 0n || denominator <= 0n) throw new Error('核价参数无效');
  return (numerator + (denominator / 2n)) / denominator;
}

function roundSignedDivide(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new Error('核价参数无效');
  return numerator < 0n
    ? -roundDivide(-numerator, denominator)
    : roundDivide(numerator, denominator);
}

function parseToken(value: string, label: string): bigint {
  const text = String(value ?? '').trim();
  if (!/^\d+$/.test(text)) throw new Error(`${label} 必须是非负整数`);
  const parsed = BigInt(text);
  if (parsed > MAX_SAFE_INTEGER) throw new Error(`${label} 数值过大`);
  return parsed;
}

function safeContextInteger(value: number, label: string, options: { allowZero?: boolean } = {}): bigint {
  if (!Number.isSafeInteger(value) || value < 0 || (!options.allowZero && value === 0)) {
    throw new Error(`${label} 无效`);
  }
  return BigInt(value);
}

function toView(
  userChargeMicroKk: bigint,
  realCostMicroYuan: bigint,
  context: TextPricingPreviewContext,
): TextPricingPreviewView {
  const kkMinorScale = safeContextInteger(context.kkMinorScale, 'KK币最小结算单位');
  const kkPerYuan = safeContextInteger(context.kkPerYuan, 'KK币人民币换算率');
  if (MICRO_CURRENCY_SCALE % kkMinorScale !== 0n) throw new Error('KK币最小结算单位无效');
  const minorUnitMicroKk = MICRO_CURRENCY_SCALE / kkMinorScale;
  const userChargeKkMinor = userChargeMicroKk === 0n
    ? 0n
    : (userChargeMicroKk + minorUnitMicroKk - 1n) / minorUnitMicroKk;
  const revenueMicroYuan = roundDivide(
    userChargeKkMinor * MICRO_CURRENCY_SCALE,
    kkMinorScale * kkPerYuan,
  );
  const profitMicroYuan = revenueMicroYuan - realCostMicroYuan;
  const marginTenths = revenueMicroYuan === 0n
    ? null
    : roundSignedDivide(profitMicroYuan * 1_000n, revenueMicroYuan);
  return { userChargeKkMinor, revenueMicroYuan, profitMicroYuan, marginTenths };
}

export function calculateTextPricingPreview(input: TextPricingPreviewInput): TextPricingPreviewResult {
  const inputTokens = parseToken(input.inputTokens, '输入 tokens');
  const outputTokens = parseToken(input.outputTokens, '输出 tokens');
  const cachedInputTokens = parseToken(input.cachedInputTokens, '缓存命中 tokens');
  if (inputTokens + outputTokens + cachedInputTokens > MAX_SAFE_INTEGER) {
    throw new Error('tokens 总量数值过大');
  }

  const inputPrice = BigInt(decimalToX10000(input.inputPrice));
  const outputPrice = BigInt(decimalToX10000(input.outputPrice));
  const cachedInputPrice = BigInt(decimalToX10000(input.cachedInputPrice));
  const multiplier = BigInt(decimalToX10000(input.multiplier));
  const userBasePrice = safeContextInteger(
    input.context.textUserBasePricePer1kX10000,
    '文本基础售价',
  );
  const memberChargePercent = safeContextInteger(
    input.context.memberChargePercent,
    '会员实付比例',
    { allowZero: true },
  );
  if (memberChargePercent > 100n) throw new Error('会员实付比例无效');

  const weightedTokenCost = (inputTokens * inputPrice)
    + (outputTokens * outputPrice)
    + (cachedInputTokens * cachedInputPrice);
  const realCostMicroYuan = roundDivide(
    weightedTokenCost * MICRO_CURRENCY_SCALE,
    TOKEN_PRICE_UNIT * PRICE_SCALE,
  );
  const billableTokens = inputTokens + outputTokens + cachedInputTokens;
  const regularChargeMicroKk = roundDivide(
    billableTokens * userBasePrice * multiplier * MICRO_CURRENCY_SCALE,
    USER_TOKEN_PRICE_UNIT * PRICE_SCALE * PRICE_SCALE,
  );
  const memberChargeMicroKk = roundDivide(regularChargeMicroKk * memberChargePercent, 100n);

  return {
    realCostMicroYuan,
    regular: toView(regularChargeMicroKk, realCostMicroYuan, input.context),
    member: toView(memberChargeMicroKk, realCostMicroYuan, input.context),
  };
}

function formatFixed(value: bigint, scale: bigint, decimals: number): string {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const displayScale = 10n ** BigInt(decimals);
  const rounded = roundDivide(absolute * displayScale, scale);
  const whole = rounded / displayScale;
  const fraction = String(rounded % displayScale).padStart(decimals, '0');
  return `${negative ? '-' : ''}${whole}.${fraction}`;
}

export function formatKkMinor(value: bigint, kkMinorScale: number): string {
  return formatFixed(value, safeContextInteger(kkMinorScale, 'KK币最小结算单位'), 2);
}

export function formatMicroYuan(value: bigint): string {
  return formatFixed(value, MICRO_CURRENCY_SCALE, 2);
}

export function formatMarginTenths(value: bigint | null): string {
  if (value === null) return '—';
  return `${formatFixed(value, 10n, 1)}%`;
}
