import { useEffect, useRef } from 'react';
import { trackingApi } from '../api/statistics/trackingApi';
import { HOST_ADDRESS } from '../config';
import { useAuthStore } from '../store/useAuthStore';

/**
 * 平台停留时长统计（整个平台的单次停留时长）
 * 监听页面可见性变化和页面卸载事件，统计用户在平台上的停留时长
 * 
 * 特点：
 * - 用户切换标签页就是一次会话结束
 * - 只在页面可见时计时
 * - 页面最小化、切换标签页等都会暂停计时
 */
export const usePlatformDurationTracking = () => {
    const { user } = useAuthStore();
    const isReportingRef = useRef(false); // 防止并发上报
    const platformStartedAtRef = useRef<string | null>(null); // 平台会话开始时间
    const platformPausedDurationRef = useRef<number>(0); // 累计暂停时长
    const hiddenAtRef = useRef<number | null>(null); // 记录页面隐藏的开始时间
    const hasReportedRef = useRef(false); // 是否已上报本次会话

    const reportPlatformDuration = async (isPageUnload = false) => {
        if (hasReportedRef.current || isReportingRef.current || !platformStartedAtRef.current) {
            return;
        }

        const startTime = new Date(platformStartedAtRef.current).getTime();
        const now = Date.now();
        
        // 如果当前页面是隐藏的，需要加上当前隐藏的时长
        let currentPausedDuration = platformPausedDurationRef.current;
        if (hiddenAtRef.current) {
            currentPausedDuration += (now - hiddenAtRef.current);
        }
        
        const effectiveDuration = (now - startTime) - currentPausedDuration;
        const durationSeconds = Math.floor(effectiveDuration / 1000);

        // 如果时长小于 1 秒，可能是误触发，不上报
        if (durationSeconds < 1) {
            return;
        }

        isReportingRef.current = true;
        hasReportedRef.current = true;

        try {
            // 如果是页面卸载，使用 fetch with keepalive
            if (isPageUnload) {
                const url = `${HOST_ADDRESS}/api/analytics/session/duration`;
                const token = user?.token;
                
                // 使用和游戏时长相同的接口，但不传 gameFileId
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    },
                    body: JSON.stringify({
                        durationSeconds,
                        // 不传 gameFileId，表示这是平台停留时长
                    }),
                    keepalive: true,
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
            } else {
                // 正常情况使用 trackingApi（和游戏时长共用同一接口，但不传 gameFileId）
                await trackingApi.analyticsEnd({
                    durationSeconds,
                });
            }
        } catch (error) {
            if (!isPageUnload) {
                hasReportedRef.current = false;
            }
        } finally {
            isReportingRef.current = false;
        }
    };

    // 初始化：页面加载时开始计时
    useEffect(() => {
        // 只在首次加载时初始化
        if (!platformStartedAtRef.current) {
            platformStartedAtRef.current = new Date().toISOString();
            platformPausedDurationRef.current = 0;
            hasReportedRef.current = false;
        }
    }, []);

    // 监听页面可见性变化（切换标签页、最小化等）
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden) {
                // 页面隐藏：记录隐藏开始时间
                hiddenAtRef.current = Date.now();
                
                // 用户切换标签页就是一次会话结束，立即上报本次平台停留时长
                if (platformStartedAtRef.current && !hasReportedRef.current) {
                    // 异步上报，不阻塞页面隐藏
                    reportPlatformDuration(false).then(() => {
                        // 上报成功后，重置，准备下一次会话
                        platformStartedAtRef.current = null;
                        platformPausedDurationRef.current = 0;
                        hiddenAtRef.current = null;
                    });
                }
            } else {
                // 页面重新可见：如果还没有开始新的会话，开始计时
                if (!platformStartedAtRef.current) {
                    platformStartedAtRef.current = new Date().toISOString();
                    platformPausedDurationRef.current = 0;
                    hasReportedRef.current = false;
                } else if (hiddenAtRef.current) {
                    // 如果会话还在继续（比如只是最小化后恢复），累加暂停时长
                    const hiddenDuration = Date.now() - hiddenAtRef.current;
                    platformPausedDurationRef.current += hiddenDuration;
                    hiddenAtRef.current = null;
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
            // 在页面卸载前上报
            reportPlatformDuration(true);
        };

        const handlePageHide = () => {
            // pagehide 事件更可靠
            reportPlatformDuration(true);
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        window.addEventListener('pagehide', handlePageHide);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            window.removeEventListener('pagehide', handlePageHide);
        };
    }, []);

    // 组件卸载时也尝试上报（作为兜底）
    useEffect(() => {
        return () => {
            if (platformStartedAtRef.current && !hasReportedRef.current) {
                reportPlatformDuration(false);
            }
        };
    }, []);
};

