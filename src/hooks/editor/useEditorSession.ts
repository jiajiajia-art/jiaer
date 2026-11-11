import { useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import GameAction from '../../api/rpgGame/gameAction';
import createGalgameSessionApi from '../../api/galgame/createGalgameSession';
import createWorldSessionApi from '../../api/worldInteraction/createWorldSession';
import { useAuthStore } from '../../store/useAuthStore';
import { useGameStore } from '../../store/gameStore';
import { attachPublishErrorData } from '../../utils/gamePublishAppeal';
import { getApiErrorMessage } from '../../utils/error';
import { isPublishPendingReview } from '../../lib/publishReview';

interface UseEditorSessionOptions {
    fileId: string | null;
    mode: string | null;
}

interface UseEditorSessionReturn {
    createGalgameSession: () => Promise<string | null>;
    handlePublishGame: (
        description?: string,
        versionNotes?: string | null,
        notifyFavoritedUsers?: boolean,
        audienceType?: 'male' | 'female' | 'all',
    ) => Promise<void>;
}

export const useEditorSession = ({ fileId, mode }: UseEditorSessionOptions): UseEditorSessionReturn => {
    const { t } = useTranslation();
    const { user } = useAuthStore();
    const { setFileId, setSessionId, setIsPreset } = useGameStore();
    const navigate = useNavigate();

    const createGalgameSession = useCallback(async (): Promise<string | null> => {
        if (!fileId || !user?.user?.id) return null;

        try {
            // 进入游戏前清理旧状态
            useGameStore.getState().clearAll();

            if (mode === 'worldInteraction') {
                const sessionResponse = await createWorldSessionApi.createWorldEditSession({ fileId });
                if (sessionResponse.data.success) {
                    const sessionId = sessionResponse.data.session.sessionId;
                    setFileId(fileId);
                    setSessionId(sessionId);
                    navigate(`/galgameMap`);
                    return sessionId;
                } else {
                    const message = (sessionResponse.data as { message?: string }).message;
                    toast.error(message || '创建世界交互游戏失败，请重试');
                    return null;
                }
            } else {
                const sessionResponse = await createGalgameSessionApi.createGalgameEditSession({ fileId: fileId });
                if (sessionResponse.data.success) {
                    const sessionId = sessionResponse.data.data.session;
                    setFileId(fileId);
                    setSessionId(sessionId);
                    setIsPreset(false);
                    navigate(`/galgame`);
                    return sessionId;
                } else {
                    toast.error(sessionResponse.data.message || '创建游戏失败，请重试');
                    return null;
                }
            }
        } catch (error: unknown) {
            console.error('❌ Session 创建错误:', error);
            const typedError = error as {
                response?: { data?: { message?: string; error?: string } };
                message?: string;
            };
            const errorMessage = typedError.response?.data?.message
                || typedError.response?.data?.error
                || typedError.message
                || '创建游戏失败，请稍后重试';
            toast.error(errorMessage);
            return null;
        }
    }, [user?.user?.id, fileId, navigate, setFileId, setSessionId, setIsPreset, mode]);

    // 发布游戏：当前不设置积分/价格，统一按免费处理（priceAmount 固定为 0）；结算货币固定 KK
    const handlePublishGame = useCallback(async (
        description?: string,
        versionNotes?: string | null,
        notifyFavoritedUsers?: boolean,
        audienceType?: 'male' | 'female' | 'all',
    ): Promise<void> => {
        if (!fileId) return;

        try {
            const response = await GameAction.publishGame({
                fileId: fileId,
                priceAmount: 0,
                description: description ?? '',
                versionNotes,
                notifyFavoritedUsers,
                audienceType,
            });

            if (response.data.success) {
                if (isPublishPendingReview(response.data)) {
                    toast.success(
                        response.data.message?.trim()
                        || t('report.publishPendingReviewSuccess'),
                    );
                } else {
                    toast.success(response.data.message?.trim() || t('createGame.publishSuccess'));
                }
                navigate('/profile');
                return;
            }

            console.error('发布游戏失败:', response.data);
            throw attachPublishErrorData(response.data.message || '发布游戏失败', response.data);
        } catch (error: unknown) {
            console.error('发布游戏失败:', error);
            const errorMessage = getApiErrorMessage(error, '发布游戏失败');
            throw error instanceof Error ? error : attachPublishErrorData(errorMessage);
        }
    }, [fileId, navigate, t]);

    return {
        createGalgameSession,
        handlePublishGame,
    };
};
