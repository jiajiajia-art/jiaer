import { useCallback, useEffect, useRef, useState } from 'react';
import payApi from '../api/pay/payApi';
import type { PayOrderRequest } from '../api/pay/pay.type';
import { createAlipayCheckout, readAlipayCheckout, validateAlipayCheckout, watchAlipayOrder } from '../lib/alipayCheckout';
import type { SavedAlipayCheckout } from '../lib/alipayCheckout';
import type { RechargeReceipt } from '../lib/rechargeReceipt';

type Status = 'idle' | 'creating' | 'polling' | 'cancelling' | 'pending' | 'paid' | 'failed';
type CheckoutState = { ownerId: string; checkout: SavedAlipayCheckout };

const storageKey = (userId: string) => `funloom:alipay-checkout:${userId}`;
const saveCheckout = (userId: string, checkout: SavedAlipayCheckout | null) => {
    try {
        if (checkout) sessionStorage.setItem(storageKey(userId), JSON.stringify(checkout));
        else sessionStorage.removeItem(storageKey(userId));
    } catch { /* Storage restrictions must not prevent payment. */ }
};

export function useAlipayCheckout(isOpen: boolean, userId: string | undefined, onPaid: () => Promise<void>) {
    const [saved, setSaved] = useState<CheckoutState | null>(null);
    const [showCheckout, setShowCheckout] = useState(false);
    const [status, setStatus] = useState<Status>('idle');
    const [error, setError] = useState('');
    const [attempt, setAttempt] = useState(0);
    const statusRef = useRef(status);
    statusRef.current = status;
    const busy = useRef(false);
    const mounted = useRef(false);
    const current = useRef({ isOpen, userId });
    current.current = { isOpen, userId };
    const generation = useRef(0);
    const blankTab = useRef<Window | null>(null);
    const checkoutTab = useRef<Window | null>(null);
    const poller = useRef<ReturnType<typeof watchAlipayOrder> | null>(null);
    const cancelBusy = useRef(false);
    const order = saved && saved.ownerId === userId ? saved.checkout : null;

    useEffect(() => {
        mounted.current = true;
        return () => { mounted.current = false; };
    }, []);

    useEffect(() => {
        setSaved(null);
        setShowCheckout(false);
        setStatus('idle');
        setError('');
    }, [userId]);

    useEffect(() => {
        if (!isOpen && (status === 'paid' || status === 'failed')) {
            setSaved(null);
            setStatus('idle');
        }
    }, [isOpen, status]);

    useEffect(() => {
        if (isOpen && userId) {
            let restored: SavedAlipayCheckout | null = null;
            try { restored = readAlipayCheckout(sessionStorage.getItem(storageKey(userId))); } catch { /* Optional recovery. */ }
            setSaved(previous => restored ? { ownerId: userId, checkout: restored }
                : previous?.ownerId === userId ? previous : null);
            setShowCheckout(Boolean(restored && !restored.cancelRequested));
            setError('');
        }
        return () => {
            generation.current += 1;
            blankTab.current?.close();
            blankTab.current = null;
        };
    }, [isOpen, userId]);

    useEffect(() => {
        if (!isOpen || !userId || !order) return;
        setStatus('polling');
        const watcher = watchAlipayOrder(order.outTradeNo, {
            query: async (id) => (await payApi.checkPayStatus(id)).data?.data,
            onStatus: (next) => {
                setStatus(next);
                setError('');
                if (next === 'paid') {
                    saveCheckout(userId, null);
                    setShowCheckout(true);
                    void onPaid();
                } else if (next === 'failed') {
                    saveCheckout(userId, null);
                    setSaved(null);
                    setShowCheckout(false);
                }
            },
            onError: () => setError('queryFailed'),
        });
        poller.current = watcher;
        const checkOnReturn = () => {
            if (document.visibilityState === 'hidden') return;
            if (statusRef.current === 'pending') {
                statusRef.current = 'polling';
                setAttempt(value => value + 1);
            } else {
                void watcher.check();
            }
        };
        window.addEventListener('focus', checkOnReturn);
        document.addEventListener('visibilitychange', checkOnReturn);
        return () => {
            watcher.stop();
            poller.current = null;
            window.removeEventListener('focus', checkOnReturn);
            document.removeEventListener('visibilitychange', checkOnReturn);
        };
    }, [isOpen, userId, order, attempt, onPaid]);

    const start = async (orderData: PayOrderRequest, receipt: RechargeReceipt) => {
        if (busy.current || order || !userId) return;
        busy.current = true;
        setStatus('creating');
        setError('');
        const ownerId = userId;
        const openedGeneration = generation.current;
        const canUpdate = () => mounted.current && current.current.userId === ownerId;
        let created = false;
        try {
            const result = await createAlipayCheckout({
                openWindow: () => {
                    const tab = window.open('about:blank', '_blank');
                    blankTab.current = tab;
                    checkoutTab.current = tab;
                    return tab;
                },
                createOrder: async () => {
                    const response = await payApi.createAlipayOrder(orderData);
                    if (response.data.code !== 200 || !response.data.data) throw new Error('requestFailed');
                    return response.data.data;
                },
                isActive: () => canUpdate() && current.current.isOpen && openedGeneration === generation.current,
                onCreated: (checkout) => {
                    created = true;
                    const record = { ...checkout, createdAt: Date.now(), receipt };
                    saveCheckout(ownerId, record);
                    if (canUpdate()) {
                        setSaved({ ownerId, checkout: record });
                        setShowCheckout(true);
                    }
                },
            });
            if (!result.opened && canUpdate()) setError('checkoutClosed');
        } catch (failure) {
            if (canUpdate()) {
                setError(failure instanceof Error && failure.message === 'popupBlocked' ? 'popupBlocked' : 'requestFailed');
            }
        } finally {
            blankTab.current = null;
            busy.current = false;
            if (!created && canUpdate()) setStatus('idle');
        }
    };

    const reopen = () => {
        if (!order) return;
        let tab: Window | null = null;
        try {
            const checkout = validateAlipayCheckout(order);
            tab = window.open('about:blank', '_blank');
            if (!tab) { setError('popupBlocked'); return; }
            tab.opener = null;
            tab.location.replace(checkout.payUrl);
            setError('');
        } catch {
            tab?.close();
            setError('requestFailed');
        }
    };

    const retry = () => {
        if (status === 'polling') void poller.current?.check();
        else setAttempt(value => value + 1);
    };

    const dismiss = async () => {
        if (cancelBusy.current || !order || !userId) return;
        cancelBusy.current = true;
        poller.current?.stop();
        if (checkoutTab.current && !checkoutTab.current.closed) checkoutTab.current.close();
        checkoutTab.current = null;
        setStatus('cancelling');
        setError('');
        try {
            const response = await payApi.cancelAlipayOrder(order.outTradeNo);
            const result = response.data?.data?.status;
            if (result === 'closed') {
                saveCheckout(userId, null);
                setSaved(null);
                setShowCheckout(false);
                setStatus('idle');
                setError('');
            } else if (result === 'paid') {
                saveCheckout(userId, null);
                setStatus('paid');
                setShowCheckout(true);
                setError('');
                await onPaid();
            } else {
                const record = { ...order, cancelRequested: true };
                saveCheckout(userId, record);
                setSaved({ ownerId: userId, checkout: record });
                setShowCheckout(false);
                setStatus('pending');
                setError('cancelPending');
                setAttempt(value => value + 1);
            }
        } catch {
            const record = { ...order, cancelRequested: true };
            saveCheckout(userId, record);
            setSaved({ ownerId: userId, checkout: record });
            setShowCheckout(false);
            setStatus('pending');
            setError('cancelPending');
            setAttempt(value => value + 1);
        } finally {
            cancelBusy.current = false;
        }
    };

    const reset = useCallback(() => {
        if (userId) saveCheckout(userId, null);
        setSaved(null);
        setShowCheckout(false);
        setStatus('idle');
        setError('');
    }, [userId]);

    const returnToPlans = useCallback(() => {
        if (userId) saveCheckout(userId, null);
        setSaved(null);
        setShowCheckout(false);
        setStatus('idle');
        setError('');
    }, [userId]);

    const requiresResolution = Boolean(order?.cancelRequested && status !== 'paid' && status !== 'failed');
    return {
        order,
        receipt: order?.receipt,
        showCheckout,
        requiresResolution,
        status,
        error,
        start,
        reopen,
        retry,
        dismiss,
        reset,
        returnToPlans,
        creating: status === 'creating',
    };
}
