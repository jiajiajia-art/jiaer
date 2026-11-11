import { normalizeRechargeReceipt } from './rechargeReceipt';
import type { RechargeReceipt } from './rechargeReceipt';

export interface AlipayCheckout {
    outTradeNo: string;
    payUrl: string;
}

export interface SavedAlipayCheckout extends AlipayCheckout {
    createdAt: number;
    cancelRequested?: boolean;
    receipt?: RechargeReceipt;
}

export function validateAlipayCheckout(value: AlipayCheckout): AlipayCheckout {
    const url = new URL(value.payUrl);
    if (!value.outTradeNo?.trim() || url.protocol !== 'https:' || url.username || url.password
        || (url.port && url.port !== '443')
        || !['openapi.alipay.com', 'openapi-sandbox.dl.alipaydev.com'].includes(url.hostname)) {
        throw new Error('Invalid Alipay checkout');
    }
    return { outTradeNo: value.outTradeNo, payUrl: url.toString() };
}

export function readAlipayCheckout(raw: string | null, now = Date.now()): SavedAlipayCheckout | null {
    try {
        const value = JSON.parse(raw || 'null') as SavedAlipayCheckout | null;
        if (!value || !Number.isFinite(value.createdAt) || value.createdAt <= 0
            || value.createdAt > now || now - value.createdAt > 24 * 60 * 60 * 1000) return null;
        const receipt = value.receipt ? normalizeRechargeReceipt(value.receipt) : undefined;
        if (value.receipt && !receipt) return null;
        return {
            ...validateAlipayCheckout(value),
            createdAt: value.createdAt,
            cancelRequested: value.cancelRequested === true,
            receipt: receipt ?? undefined,
        };
    } catch {
        return null;
    }
}

type CheckoutTab = Pick<Window, 'closed' | 'opener' | 'close' | 'location'>;

export async function createAlipayCheckout(options: {
    openWindow: () => CheckoutTab | null;
    createOrder: () => Promise<AlipayCheckout>;
    isActive: () => boolean;
    onCreated: (checkout: AlipayCheckout) => void;
}): Promise<{ opened: boolean }> {
    // Reserve during the click, before the asynchronous order request.
    const tab = options.openWindow();
    if (!tab) throw new Error('popupBlocked');
    try {
        tab.opener = null;
        const checkout = validateAlipayCheckout(await options.createOrder());
        options.onCreated(checkout);
        if (!options.isActive() || tab.closed) {
            if (!tab.closed) tab.close();
            return { opened: false };
        }
        tab.location.replace(checkout.payUrl);
        return { opened: true };
    } catch (error) {
        if (!tab.closed) tab.close();
        throw error;
    }
}

export function watchAlipayOrder(orderId: string, options: {
    query: (orderId: string) => Promise<unknown>;
    onStatus: (status: 'paid' | 'failed' | 'pending') => void;
    onError: () => void;
    intervalMs?: number;
    timeoutMs?: number;
}) {
    let stopped = false;
    let querying = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();
    const stop = () => {
        stopped = true;
        clearTimeout(timer);
    };
    const check = async () => {
        if (stopped || querying) return;
        clearTimeout(timer);
        querying = true;
        try {
            const status = await options.query(orderId);
            if (stopped) return;
            if (status === 'paid' || ['failed', 'closed', 'cancelled', 'canceled', 'expired'].includes(String(status))) {
                stop();
                options.onStatus(status === 'paid' ? 'paid' : 'failed');
                return;
            }
        } catch {
            if (!stopped) options.onError();
        } finally {
            querying = false;
        }
        if (stopped) return;
        if (Date.now() - startedAt >= (options.timeoutMs ?? 2 * 60 * 1000)) {
            stop();
            options.onStatus('pending');
            return;
        }
        timer = setTimeout(() => void check(), options.intervalMs ?? 3000);
    };
    void check();
    return { stop, check };
}
