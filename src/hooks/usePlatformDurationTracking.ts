import { useEffect, useRef } from 'react';
import { HOST_ADDRESS } from '../config';
import { useAuthStore } from '../store/useAuthStore';
import { useDailyTaskStore } from '../store/dailyTaskStore';
import { trackingApi } from '../api/statistics/trackingApi';

const REPORT_INTERVAL_SECONDS = 25;
const MAX_TASK_SECONDS = 1800; // 30分钟

const postPlatformDurationWithKeepalive = async (
    durationSeconds: number,
    token?: string,
): Promise<void> => {
    const response = await fetch(`${HOST_ADDRESS}/api/analytics/session/duration`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
            durationSeconds,
        }),
        keepalive: true,
    });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
};

export const usePlatformDurationTracking = () => {
    const { user } = useAuthStore();
    const isVisibleRef = useRef(!document.hidden);
    const pendingSecondsRef = useRef(0);
    const isReportingRef = useRef(false);
    const tickTimerRef = useRef<number | null>(null);

    const syncPending = (nextValue: number) => {
        pendingSecondsRef.current = Math.max(0, Math.floor(nextValue));
        useDailyTaskStore.getState().setPendingSeconds('platform', pendingSecondsRef.current);
    };

    const addPending = (deltaSeconds: number) => {
        const safeDelta = Math.max(0, Math.floor(deltaSeconds));
        if (!safeDelta) return;
        syncPending(pendingSecondsRef.current + safeDelta);
    };

    const flush = async (isPageUnload = false) => {
        if (isReportingRef.current) return;
        const secondsToReport = pendingSecondsRef.current;
        if (secondsToReport < 1) return;
        if (secondsToReport > MAX_TASK_SECONDS) return;

        isReportingRef.current = true;
        useDailyTaskStore.getState().markFlushStarted();
        syncPending(0);

        try {
            if (isPageUnload) {
                await postPlatformDurationWithKeepalive(secondsToReport, user?.token);
            } else {
                const response = await trackingApi.analyticsEnd({ durationSeconds: secondsToReport });
                useDailyTaskStore.getState().syncFromPayload(response.data.data);
            }
        } catch {
            addPending(secondsToReport);
        } finally {
            useDailyTaskStore.getState().markFlushSettled();
            isReportingRef.current = false;
        }
    };

    useEffect(() => {
        const tick = () => {
            if (!isVisibleRef.current) return;
            addPending(1);
            if (pendingSecondsRef.current >= REPORT_INTERVAL_SECONDS) {
                void flush(false);
            }
        };

        tickTimerRef.current = window.setInterval(tick, 1000);

        return () => {
            if (tickTimerRef.current) {
                window.clearInterval(tickTimerRef.current);
            }
            void flush(false);
        };
    }, []);

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden) {
                isVisibleRef.current = false;
                void flush(false);
                return;
            }
            isVisibleRef.current = true;
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    useEffect(() => {
        const handleBeforeUnload = () => {
            void flush(true);
        };

        const handlePageHide = () => {
            void flush(true);
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        window.addEventListener('pagehide', handlePageHide);
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            window.removeEventListener('pagehide', handlePageHide);
        };
    }, [user?.token]);
};
