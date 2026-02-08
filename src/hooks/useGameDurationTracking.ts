import { useEffect, useRef } from 'react';
import { useTrackingStore } from '../store/trackingStore';
import { useGameStore } from '../store/gameStore';
import { trackingApi } from '../api/statistics/trackingApi';
import { HOST_ADDRESS } from '../config';
import { useAuthStore } from '../store/useAuthStore';

/**
 * 自动追踪游戏时长并上报
 * 监听页面可见性变化和页面卸载事件，自动计算并上报游戏时长
 * 
 * @param gameFileId 当前游戏的 fileId（可选，如果不传则从 gameStore 读取）
 */
export const useGameDurationTracking = (gameFileId?: string) => {
    const { user } = useAuthStore();
    const isReportingRef = useRef(false); // 防止并发上报
    const gameFileIdRef = useRef(gameFileId); // 使用 ref 存储最新的 gameFileId
    const lastReportAtRef = useRef<number>(0); // 防止同一次离开触发多次上报（pagehide + unmount 等）

    // 更新 gameFileId ref
    useEffect(() => {
        gameFileIdRef.current = gameFileId;
    }, [gameFileId]);

    // 计算并上报时长（分段模型：离开就提交；回来重新开始计时）
    // 使用 getState 获取最新状态，避免闭包问题
    const reportDuration = async (isPageUnload = false) => {
        const trackingState = useTrackingStore.getState();
        const { started_at, setStartedAt } = trackingState;

        if (isReportingRef.current || !started_at) {
            return;
        }

        const effectiveGameFileId = gameFileIdRef.current || useGameStore.getState().fileId;
        if (!effectiveGameFileId) {
            return;
        }

        // 防抖：避免短时间内重复上报（常见于 pagehide + unmount 双触发）
        const now = Date.now();
        if (now - lastReportAtRef.current < 800) {
            return;
        }

        const startTime = new Date(started_at).getTime();
        const durationSeconds = Math.floor((now - startTime) / 1000);

        // 如果时长小于 1 秒，可能是误触发，不上报
        if (durationSeconds < 1) {
            return;
        }

        isReportingRef.current = true;
        lastReportAtRef.current = now;

        const payload = {
            durationSeconds,
            gameFileId: effectiveGameFileId,
        };

        try {
            // 如果是页面卸载，使用 fetch with keepalive（支持自定义 headers，浏览器保证发送）
            if (isPageUnload) {
                const url = `${HOST_ADDRESS}/api/analytics/session/duration`;
                const token = user?.token;
                
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    },
                    body: JSON.stringify(payload),
                    keepalive: true, // 关键：确保在页面卸载时也能发送，浏览器会保证请求完成
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
            } else {
                // 正常情况使用 trackingApi
                await trackingApi.analyticsEnd(payload);
            }

            // 成功上报后：清掉 started_at，防止同一次离开重复上报同一段
            setStartedAt(null);
        } catch (error) {
            // 失败时不清 started_at，允许后续再次尝试上报
        } finally {
            isReportingRef.current = false;
        }
    };

    // 监听页面可见性变化
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden) {
                // 离开：立即提交本段时长
                reportDuration(false);
            } else {
                // 回来：如果当前还没开始计时，则开始新一段
                const trackingState = useTrackingStore.getState();
                if (!trackingState.started_at) {
                    trackingState.setStartedAt(new Date().toISOString());
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []); 
    
    // 监听页面卸载事件（关闭标签页、关闭浏览器、刷新页面等）
    useEffect(() => {
        const handleBeforeUnload = () => {
            // 在页面卸载前上报（使用 fetch keepalive 确保发送）
            reportDuration(true);
        };

        const handlePageHide = () => {
            reportDuration(true);
        };

        // 使用 beforeunload 和 pagehide 两个事件，确保覆盖所有场景
        window.addEventListener('beforeunload', handleBeforeUnload);
        window.addEventListener('pagehide', handlePageHide);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            window.removeEventListener('pagehide', handlePageHide);
        };
    }, []); // 空依赖数组，因为 reportDuration 内部使用 getState 获取最新状态

    useEffect(() => {
        return () => {
            // 组件卸载时，如果还没上报，尝试上报
            const trackingState = useTrackingStore.getState();
            if (trackingState.started_at) {
                reportDuration(false);
            }
        };
    }, []); 
};

