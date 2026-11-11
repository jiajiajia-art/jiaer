import { useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import EditorApi from '../../api/galgame/EditorData';
import MapWorldData from '../../api/worldInteraction/mapWorldData';
import type { AllGameData } from '../../api/galgame/EditorData.type';
import type { WorldInteractionGameData } from '../../api/worldInteraction/worldInteractionApi.type';

interface UseEditorDataOptions {
    fileId: string | null;
    mode: string | null;
}

interface UseEditorDataReturn {
    gameData: AllGameData | WorldInteractionGameData | null;
    isLoadingData: boolean;
    fetchEditorData: (id: string, dataMode?: string) => Promise<void>;
}

export const useEditorData = ({ fileId, mode }: UseEditorDataOptions): UseEditorDataReturn => {
    const { t } = useTranslation();
    const [gameData, setGameData] = useState<AllGameData | WorldInteractionGameData | null>(null);
    const [isLoadingData, setIsLoadingData] = useState<boolean>(false);
    const hasFetchedRef = useRef<string | null>(null);
    const initialLoadDoneRef = useRef<boolean>(false);
    // 功能注释：并发刷新用序号丢弃过期响应，禁止再用 isLoadingData 直接 return（会丢掉生图后的刷新）
    const fetchSeqRef = useRef(0);
    const modeRef = useRef(mode);
    modeRef.current = mode;

    const fetchEditorData = useCallback(async (id: string, dataMode?: string) => {
        if (!id) return;

        const seq = ++fetchSeqRef.current;
        const shouldShowGlobalLoading = !initialLoadDoneRef.current;
        if (shouldShowGlobalLoading) {
            setIsLoadingData(true);
        }

        try {
            const currentMode = dataMode || modeRef.current;
            let response;

            if (currentMode === 'worldInteraction') {
                response = await MapWorldData.getMapWorldData(id);
            } else {
                response = await EditorApi.getEditorData(id);
            }

            if (seq !== fetchSeqRef.current) {
                return;
            }

            if (response.data?.success && response.data) {
                const rawData = response.data as any;
                if (rawData.worldSetting) {
                    if (rawData.worldSetting.Player && !rawData.worldSetting.player) {
                        rawData.worldSetting.player = rawData.worldSetting.Player;
                    }
                }

                const unifiedData = rawData as AllGameData | WorldInteractionGameData;
                setGameData(unifiedData);
                initialLoadDoneRef.current = true;
                console.log('Editor data fetched successfully:', unifiedData);
            } else {
                console.error('Failed to fetch editor data');
                toast.error(t('editorData.loadFailed'));
                if (hasFetchedRef.current === id) {
                    hasFetchedRef.current = null;
                }
            }
        } catch (error) {
            if (seq !== fetchSeqRef.current) {
                return;
            }
            console.error('Error fetching editor data:', error);
            toast.error(t('editorData.loadFailed'));
            if (hasFetchedRef.current === id) {
                hasFetchedRef.current = null;
            }
        } finally {
            if (shouldShowGlobalLoading && seq === fetchSeqRef.current) {
                setIsLoadingData(false);
            }
        }
    }, [t]);

    // 初始化：如果有保存的 fileId，自动加载数据
    useEffect(() => {
        if (fileId && fileId !== hasFetchedRef.current) {
            hasFetchedRef.current = fileId;
            void fetchEditorData(fileId);
        }
    }, [fileId, fetchEditorData]);

    return {
        gameData,
        isLoadingData,
        fetchEditorData,
    };
};
