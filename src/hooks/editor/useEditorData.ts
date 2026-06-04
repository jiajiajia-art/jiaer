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

    const fetchEditorData = useCallback(async (id: string, dataMode?: string) => {
        if (!id || isLoadingData) return;

        const shouldShowGlobalLoading = !initialLoadDoneRef.current;
        if (shouldShowGlobalLoading) {
            setIsLoadingData(true);
        }
        
        try {
            const currentMode = dataMode || mode;
            let response;
            
            if (currentMode === 'worldInteraction') {
                response = await MapWorldData.getMapWorldData(id);
            } else {
                response = await EditorApi.getEditorData(id);
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
            console.error('Error fetching editor data:', error);
            toast.error(t('editorData.loadFailed'));
            if (hasFetchedRef.current === id) {
                hasFetchedRef.current = null;
            }
        } finally {
            if (shouldShowGlobalLoading) {
                setIsLoadingData(false);
            }
        }
    }, [mode, isLoadingData]);

    // 初始化：如果有保存的 fileId，自动加载数据
    useEffect(() => {
        if (fileId && fileId !== hasFetchedRef.current && !isLoadingData) {
            hasFetchedRef.current = fileId;
            fetchEditorData(fileId);
        }
    }, [fileId]);

    return {
        gameData,
        isLoadingData,
        fetchEditorData,
    };
};

