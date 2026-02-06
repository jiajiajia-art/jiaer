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
    const hiddenAtRef = useRef<number | null>(null); // 记录页面隐藏的开始时间
    const VISIBILITY_TIMEOUT = 5 * 60 * 1000; // 5分钟：如果页面隐藏超过5分钟，认为用户已离开

    // 更新 gameFileId ref
    useEffect(() => {
        gameFileIdRef.current = gameFileId;
    }, [gameFileId]);

    // 计算并上报时长的函数（使用 getState 获取最新状态，避免闭包问题）
    const reportDuration = async (isPageUnload = false) => {
        const trackingState = useTrackingStore.getState();
        const { started_at, pausedDuration, hasReported, setHasReported } = trackingState;

        if (hasReported || isReportingRef.current || !started_at) {
            return;
        }

        const effectiveGameFileId = gameFileIdRef.current || useGameStore.getState().fileId;
        if (!effectiveGameFileId) {
            return;
        }

        const startTime = new Date(started_at).getTime();
        const now = Date.now();
        
        let currentPausedDuration = pausedDuration;
        if (hiddenAtRef.current) {
            currentPausedDuration += (now - hiddenAtRef.current);
        }
        
        // 计算有效游戏时长：总时长 - 暂停时长（只在页面可见时计时）
        const effectiveDuration = (now - startTime) - currentPausedDuration;
        const durationSeconds = Math.floor(effectiveDuration / 1000);

        // 如果时长小于 1 秒，可能是误触发，不上报
        if (durationSeconds < 1) {
            return;
        }

        isReportingRef.current = true;
        setHasReported(true);

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
        } catch (error) {
            if (!isPageUnload) {
                setHasReported(false);
            }
        } finally {
            isReportingRef.current = false;
        }
    };

    // 监听页面可见性变化
    useEffect(() => {
        let timeoutId: ReturnType<typeof setTimeout> | null = null;
        const handleVisibilityChange = () => {
            const trackingState = useTrackingStore.getState();
            
            if (document.hidden) {
                // 页面隐藏：记录隐藏开始时间，暂停计时
                hiddenAtRef.current = Date.now();                
                // 设置超时：如果页面隐藏超过5分钟，认为用户已离开，上报时长
                timeoutId = setTimeout(() => {
                    const currentState = useTrackingStore.getState();
                    if (!currentState.hasReported && currentState.started_at) {
                        reportDuration(false);
                    }
                }, VISIBILITY_TIMEOUT);
            } else {
                // 页面重新可见：累加暂停时长，恢复计时
                if (hiddenAtRef.current) {
                    const hiddenDuration = Date.now() - hiddenAtRef.current;
                    // 累加暂停时长（只在页面可见时计时，隐藏的时间不计入）
                    trackingState.addPausedDuration(hiddenDuration);
                    console.log('[时长统计] 页面重新可见，恢复计时。隐藏时长:', Math.floor(hiddenDuration / 1000), '秒（不计入游戏时长）');
                    hiddenAtRef.current = null;
                }
                
                // 清除超时
                if (timeoutId) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
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
            if (!trackingState.hasReported && trackingState.started_at) {
                reportDuration(false);
            }
        };
    }, []); 
};

