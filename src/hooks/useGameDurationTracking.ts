import { useEffect, useRef } from 'react';
import { HOST_ADDRESS } from '../config';
import { useAuthStore } from '../store/useAuthStore';
import { useGameStore } from '../store/gameStore';
import { useDailyTaskStore } from '../store/dailyTaskStore';
import { trackingApi } from '../api/statistics/trackingApi';
import { acquireGameDurationTracking } from '../lib/durationTrackingGate';

const REPORT_INTERVAL_SECONDS = 60;
const MAX_TASK_SECONDS = 1800; // 30分钟

const postGameDurationWithKeepalive = async (
    durationSeconds: number,
    gameFileId: string,
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
            gameFileId,
        }),
        keepalive: true,
    });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
};

export const useGameDurationTracking = (gameFileId?: string) => {
    const { user } = useAuthStore();
    const pendingSecondsRef = useRef(0);
    const isVisibleRef = useRef(!document.hidden);
    const isReportingRef = useRef(false);
    const tickTimerRef = useRef<number | null>(null);
    const gameFileIdRef = useRef(gameFileId);

    useEffect(() => {
        gameFileIdRef.current = gameFileId;
    }, [gameFileId]);

    // 有有效 gameFileId 时占用门闩，让平台心跳暂停
    useEffect(() => {
        const gameId = String(gameFileId || useGameStore.getState().fileId || '').trim();
        if (!gameId) return undefined;
        return acquireGameDurationTracking();
    }, [gameFileId]);

    const resolveGameFileId = (): string | null => {
        const explicit = String(gameFileIdRef.current || '').trim();
        if (explicit) return explicit;
        const fromStore = String(useGameStore.getState().fileId || '').trim();
        return fromStore || null;
    };

    const syncPending = (nextValue: number) => {
        pendingSecondsRef.current = Math.max(0, Math.floor(nextValue));
        useDailyTaskStore.getState().setPendingSeconds('game', pendingSecondsRef.current);
    };

    const addPending = (deltaSeconds: number) => {
        const safeDelta = Math.max(0, Math.floor(deltaSeconds));
        if (!safeDelta) return;
        syncPending(pendingSecondsRef.current + safeDelta);
    };

    const flush = async (isPageUnload = false) => {
        if (isReportingRef.current) return;
        const gameId = resolveGameFileId();
        const secondsToReport = pendingSecondsRef.current;
        if (!gameId || secondsToReport < 1) return;
        if (secondsToReport > MAX_TASK_SECONDS) return;

        isReportingRef.current = true;
        useDailyTaskStore.getState().markFlushStarted();
        syncPending(0);

        try {
            if (isPageUnload) {
                await postGameDurationWithKeepalive(secondsToReport, gameId, user?.token);
            } else {
                const response = await trackingApi.analyticsEnd({
                    durationSeconds: secondsToReport,
                    gameFileId: gameId,
                });
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
            if (!resolveGameFileId()) return;

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
