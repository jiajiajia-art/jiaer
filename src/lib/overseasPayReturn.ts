/**
 * 功能注释：海外支付同步回站后解析 URL、查询订单并给出成功/失败提示（不依赖弹窗）。
 */

export type OverseasPayReturnStatus = 'paid' | 'failed' | 'pending';

export type OverseasPayReturnParse =
  | { handled: false }
  | { handled: true; outTradeNo: string; nextSearch: string };

/** 功能注释：识别收银台回站查询串；清掉一次性参数以免刷新重复提示 */
export function parseOverseasPayReturnSearch(search: string): OverseasPayReturnParse {
  const raw = String(search || '');
  const params = new URLSearchParams(raw.startsWith('?') ? raw.slice(1) : raw);
  if (params.get('overseasPay') !== '1') {
    return { handled: false };
  }
  const outTradeNo = String(params.get('outTradeNo') || '').trim();
  params.delete('overseasPay');
  params.delete('outTradeNo');
  return {
    handled: true,
    outTradeNo,
    nextSearch: params.toString(),
  };
}

export function interpretOverseasPayStatus(raw: unknown): OverseasPayReturnStatus {
  const status = String(raw || '').trim().toLowerCase();
  if (status === 'paid' || status === 'success') return 'paid';
  if (status === 'failed' || status === 'closed' || status === 'cancelled' || status === 'canceled') {
    return 'failed';
  }
  return 'pending';
}

type QueryPayStatus = (outTradeNo: string) => Promise<unknown>;

/**
 * 功能注释：return 可能早于异步 notify，短轮询几次避免成功单仍提示「确认中」。
 */
export async function resolveOverseasPayReturnStatus(
  outTradeNo: string,
  query: QueryPayStatus,
  options?: {
    retries?: number;
    delayMs?: number;
    sleep?: (ms: number) => Promise<void>;
  },
): Promise<OverseasPayReturnStatus> {
  const id = String(outTradeNo || '').trim();
  if (!id) return 'pending';
  const retries = options?.retries ?? 4;
  const delayMs = options?.delayMs ?? 800;
  const sleep = options?.sleep ?? ((ms: number) => new Promise((resolve) => {
    setTimeout(resolve, ms);
  }));

  let last: OverseasPayReturnStatus = 'pending';
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      last = interpretOverseasPayStatus(await query(id));
      if (last !== 'pending') return last;
    } catch {
      last = 'pending';
    }
    if (attempt < retries - 1) {
      await sleep(delayMs);
    }
  }
  return last;
}
