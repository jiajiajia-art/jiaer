import { useState, useCallback } from 'react';
import MissionApi from '../api/game/missionApi';
import type { MissionData } from '../api/game/missionApi.type';

export const useStoryMissions = (sessionId: string | null) => {
    const [missionData, setMissionData] = useState<MissionData | null>(null);
    const [loadingMissions, setLoadingMissions] = useState(false);
    const [showMissionAlert, setShowMissionAlert] = useState(false);

    const loadMissions = useCallback(async () => {
        if (!sessionId) {
            return;
        }

        try {
            setLoadingMissions(true);
            const response = await MissionApi.getMissions(sessionId);
            if (response.data.success && response.data.data) {
                const data = response.data.data;
                setMissionData(data);

                if (data.activeMissions && data.activeMissions.length > 0) {
                    console.log('✅ 检测到 activeMissions，自动显示任务提示弹窗，数量:', data.activeMissions.length);
                    setShowMissionAlert(true);
                } else {
                    console.log('ℹ️ 没有 activeMissions，关闭任务提示弹窗');
                    setShowMissionAlert(false);
                }
            }
        } catch (error) {
            console.error('获取任务列表失败:', error);
        } finally {
            setLoadingMissions(false);
        }
    }, [sessionId]);

    return {
        missionData,
        loadingMissions,
        showMissionAlert,
        setShowMissionAlert,
        loadMissions
    };
};

