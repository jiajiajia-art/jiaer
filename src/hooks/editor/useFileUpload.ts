import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import EditorApi from '../../api/galgame/EditorData';
import worldEditor from '../../api/worldInteraction/worldEditor';
import { useGameStore } from '../../store/gameStore';
import { useUploadStore } from '../../store/uploadStore';
import { useEditorStore } from '../../store/editorStore';
import { useAuthStore } from '../../store/useAuthStore';
import { formatIdeaJobStage } from '../../utils/ideaJobStage';
import { refreshAuthUserPoints } from '../../lib/auth/refreshUserPoints';
import { TXT_IDEA_GENERATE_COST } from '../../utils/constants';
import {
    DEFAULT_TEXT_GENERATE_OPTIONS,
    shouldGenerateAssetsAfterIdea,
    type IdeaGenerateOptions,
} from '../../lib/galgame/ideaFullWorkEstimate';
import {
    clearAssetGapBannerDismissed,
    markAssetGapBannerPending,
    rememberIdeaFullWorkAssets,
    peekIdeaFullWorkAssets,
    clearIdeaFullWorkAssets,
    setIdeaAssetGenStatus,
} from '../../lib/galgame/ideaFullWorkSession';
import { runIdeaFullWorkAssets } from '../../lib/galgame/runIdeaFullWorkAssets';
import { createInitialIdeaAssetProgress, publishIdeaAssetProgress } from '../../lib/galgame/ideaFullWorkProgress';

type JobStage =
    | 'uploaded'
    | 'parsing'
    | 'generating'
    | 'validating'
    | 'writing'
    | 'done'
    | 'generating_world'
    | 'generating_npcs'
    | 'generating_scenes'
    | 'generating_more_prompts'
    | 'generating_functional_npcs'
    | 'generating_attributes'
    | string;

interface JobStatusResponseRunning {
    success?: boolean;
    jobId: string;
    fileId?: string;
    status: 'running' | 'queued' | 'pending';
    stage?: JobStage;
    progress?: number;
    error?: string;
    elapsedSeconds?: number;
    estimatedRemainingSeconds?: number;
    estimatedTotalSeconds?: number;
    estimateSource?: string;
}

interface JobStatusResponseCompleted {
    success?: boolean;
    jobId: string;
    fileId: string;
    status: 'completed';
    elapsedSeconds?: number;
    estimatedRemainingSeconds?: number;
    estimatedTotalSeconds?: number;
    estimateSource?: string;
    pointsDeducted?: number;
    pointsRemaining?: number;
}

interface JobStatusResponseFailed {
    success?: boolean;
    status: 'failed';
    error?: string;
    errorCode?: string | null;
    requiredPoints?: number;
    currentPoints?: number;
    billingReconciliationRequired?: boolean;
    elapsedSeconds?: number;
    estimatedRemainingSeconds?: number;
    estimatedTotalSeconds?: number;
    estimateSource?: string;
}

interface UseFileUploadOptions {
    mode: string | null;
    onUploadComplete: (fileId: string, dataMode: string) => Promise<void>;
}

export interface UploadResult {
    success: boolean;
    error?: string;
    completedImmediately?: boolean;
}

interface UseFileUploadReturn {
    handleFileUpload: (file: File) => Promise<UploadResult>;
    handleGenerateFromIdea: (idea: string, options?: IdeaGenerateOptions) => Promise<boolean>;
}

/**
 * 提取后端错误信息
 */
const getBackendErrorMessage = (error: unknown, fallback: string): string => {
    const anyError = error as {
        message?: string;
        response?: {
            data?: {
                error?: string;
                message?: string;
            };
        };
    };

    return (
        anyError?.response?.data?.error ||
        anyError?.response?.data?.message ||
        anyError?.message ||
        fallback
    );
};

/**
 * 提取非异常响应中的错误文案
 */
const getResponseErrorMessage = (payload: unknown, fallback = 'Upload failed, please try again'): string => {
    const responseData = payload as {
        error?: string;
        message?: string;
    };

    return responseData?.error || responseData?.message || fallback;
};

/**
 * 功能注释：TXT 文档导入 / 一句话生成前本地预检积分（后端仍会再校验）。
 */
const ensureEnoughPointsForVisualDoc = async (
    required: number,
    t: (key: string, options?: Record<string, unknown>) => string,
): Promise<boolean> => {
    const latestPoints = await refreshAuthUserPoints();
    const current = typeof latestPoints === 'number'
        ? latestPoints
        : (useAuthStore.getState().user?.user?.points ?? 0);
    if (current < required) {
        toast.error(t('createGame.insufficientPointsForDoc', {
            required,
            current,
        }));
        return false;
    }
    return true;
};

/**
 * 功能注释：任务成功后根据 status 回写积分并 toast；缺字段时刷新服务端余额兜底。
 */
const applyVisualDocPointsSuccess = async (
    completedData: JobStatusResponseCompleted,
    kind: 'document' | 'idea',
    t: (key: string, options?: Record<string, unknown>) => string,
) => {
    const fallbackCost = kind === 'idea' ? TXT_IDEA_GENERATE_COST : 0;
    // 功能注释：仅在后端明确返回扣分时 toast；未扣则刷新余额但不假装已扣
    const hasDeductedField = typeof completedData.pointsDeducted === 'number';
    const deducted = hasDeductedField
        ? Math.max(0, completedData.pointsDeducted as number)
        : 0;

    if (typeof completedData.pointsRemaining === 'number') {
        useAuthStore.getState().updateUser({ points: completedData.pointsRemaining });
    } else {
        await refreshAuthUserPoints();
    }

    if (deducted > 0) {
        toast.success(
            kind === 'idea'
                ? t('createGame.ideaGenerateSuccessDeducted', { points: deducted })
                : t('createGame.docParseSuccessDeducted', { points: deducted }),
        );
    } else if (!hasDeductedField) {
        console.warn('[useFileUpload] completed without pointsDeducted, expected', fallbackCost);
    }
};

export const useFileUpload = ({ mode, onUploadComplete }: UseFileUploadOptions): UseFileUploadReturn => {
    const { t } = useTranslation();
    const { setFileId, setIsPreset } = useGameStore();
    const { setIsParsed } = useEditorStore();
    const { addJob, updateJob, removeJob } = useUploadStore();

    const startPollingUploadStatus = useCallback((
        jobId: string,
        fileName: string,
        dataMode: string,
        startTime?: number,
        pointsKind?: 'document' | 'idea',
    ) => {
        addJob(jobId, fileName, startTime, pointsKind === 'idea' ? 'idea' : 'document');

        let delay = 1000;
        const maxDelay = 5000;
        const timeoutMs = 30 * 60 * 1000;
        const started = Date.now();

        const pollStatus = async () => {
            try {
                if (Date.now() - started > timeoutMs) {
                    updateJob(jobId, {
                        status: 'failed',
                        error: t('createGame.uploadTimeout'),
                    });
                    setTimeout(() => {
                        removeJob(jobId);
                    }, 3000);
                    toast.error(t('createGame.uploadTimeout'));
                    return;
                }

                const statusResponse = mode === 'worldInteraction'
                    ? worldEditor.checkUploadStatus(jobId)
                    : EditorApi.checkUploadStatus(jobId);
                const statusData = (await statusResponse).data;

                console.log('[轮询状态] jobId:', jobId, 'status:', statusData.status, 'progress:', statusData.progress, 'stage:', statusData.stage);

                if (statusData.status === 'running' || statusData.status === 'queued' || statusData.status === 'pending') {
                    const runningData = statusData as JobStatusResponseRunning;
                    const isQueuedOrPending = runningData.status === 'queued' || runningData.status === 'pending';
                    updateJob(jobId, {
                        fileId: runningData.fileId || null,
                        status: isQueuedOrPending ? 'uploading' : 'processing',
                        progress: runningData.progress || 0,
                        stage: isQueuedOrPending && !runningData.stage
                            ? t('createGame.inQueue')
                            : formatIdeaJobStage(runningData.stage, t),
                        error: null,
                        elapsedSeconds: runningData.elapsedSeconds ?? null,
                        estimatedRemainingSeconds: runningData.estimatedRemainingSeconds ?? null,
                        estimatedTotalSeconds: runningData.estimatedTotalSeconds ?? null,
                        estimateSource: runningData.estimateSource ?? null,
                    });

                    setTimeout(() => {
                        pollStatus();
                    }, delay);
                    delay = Math.min(Math.round(delay * 1.3), maxDelay);
                } else if (statusData.status === 'completed') {
                    let completedData = statusData as JobStatusResponseCompleted;

                    // 功能注释：完成后若尚未带回扣分结果，再拉一次 status 触发 API 侧幂等补扣
                    if (
                        pointsKind
                        && mode !== 'worldInteraction'
                        && !(typeof completedData.pointsDeducted === 'number' && completedData.pointsDeducted > 0)
                    ) {
                        try {
                            const settleRes = await EditorApi.checkUploadStatus(jobId);
                            const settled = settleRes.data as JobStatusResponseCompleted;
                            if (settled?.status === 'completed') {
                                completedData = {
                                    ...completedData,
                                    ...settled,
                                };
                            }
                        } catch (settleErr) {
                            console.warn('[useFileUpload] settle re-fetch failed:', settleErr);
                        }
                    }

                    if (completedData.fileId) {
                        setFileId(completedData.fileId);
                        setIsParsed(false);
                        setIsPreset(false);

                        // 功能注释：必须在 updateJob(completed) / await 积分之前标 generating+running，
                        // 否则 DocumentsPanel onParsingSuccess 会先触发续跑，与此处双开；旧逻辑会把
                        // 「已在进行中」误判失败并打成「素材待补齐」。
                        const pendingAssets =
                            peekIdeaFullWorkAssets(jobId)
                            || peekIdeaFullWorkAssets(completedData.fileId);
                        if (pointsKind === 'idea') {
                            clearAssetGapBannerDismissed(completedData.fileId);
                            if (pendingAssets) {
                                rememberIdeaFullWorkAssets(completedData.fileId, {
                                    mode: 'full',
                                    assets: pendingAssets,
                                });
                                setIdeaAssetGenStatus(completedData.fileId, 'running');
                                markAssetGapBannerPending(completedData.fileId, 'generating');
                                publishIdeaAssetProgress(
                                    createInitialIdeaAssetProgress(completedData.fileId, pendingAssets),
                                );
                            } else {
                                markAssetGapBannerPending(completedData.fileId, 'text');
                            }
                        }

                        updateJob(jobId, {
                            fileId: completedData.fileId,
                            status: 'completed',
                            progress: 100,
                            stage: t('createGame.statusComplete'),
                            elapsedSeconds: completedData.elapsedSeconds ?? null,
                            estimatedRemainingSeconds: completedData.estimatedRemainingSeconds ?? 0,
                            estimatedTotalSeconds: completedData.estimatedTotalSeconds ?? completedData.elapsedSeconds ?? null,
                            estimateSource: completedData.estimateSource ?? null,
                        });

                        if (pointsKind) {
                            await applyVisualDocPointsSuccess(completedData, pointsKind, t);
                        }

                        const finishAfterIdea = async () => {
                            await onUploadComplete(completedData.fileId, dataMode);
                            if (!pendingAssets) return;
                            try {
                                const assetResult = await runIdeaFullWorkAssets(
                                    completedData.fileId,
                                    pendingAssets,
                                );
                                // 续跑已接管同一任务：勿重复 toast / 改横幅
                                if (assetResult.joinedExisting) {
                                    return;
                                }
                                const anyFail = !assetResult.portraitsOk
                                    || !assetResult.scenesOk
                                    || !assetResult.coverOk;
                                if (anyFail) {
                                    setIdeaAssetGenStatus(completedData.fileId, 'failed');
                                    markAssetGapBannerPending(completedData.fileId, 'full');
                                    const detail = assetResult.errors[0];
                                    toast.error(
                                        detail
                                            ? `${t('createGame.fullWorkAssetsPartialFail')}：${detail}`
                                            : t('createGame.fullWorkAssetsPartialFail'),
                                    );
                                } else {
                                    setIdeaAssetGenStatus(completedData.fileId, 'done');
                                    clearIdeaFullWorkAssets(jobId);
                                    clearIdeaFullWorkAssets(completedData.fileId);
                                    toast.success(t('createGame.fullWorkAssetsDone'));
                                }
                                await onUploadComplete(completedData.fileId, dataMode);
                            } catch (assetErr) {
                                console.error('[useFileUpload] full-work assets failed:', assetErr);
                                setIdeaAssetGenStatus(completedData.fileId, 'failed');
                                markAssetGapBannerPending(completedData.fileId, 'full');
                                toast.error(t('createGame.fullWorkAssetsPartialFail'));
                            }
                        };

                        if (pendingAssets) {
                            toast(t('createGame.fullWorkAssetsGenerating'));
                        }
                        finishAfterIdea().catch((error) => {
                            console.error('Error fetching editor data after upload:', error);
                            toast.error(t('createGame.parsingCompleteLoadFailed'));
                        });

                        setTimeout(() => {
                            removeJob(jobId);
                        }, 2000);
                    } else {
                        updateJob(jobId, {
                            status: 'failed',
                            error: t('createGame.parsingCompleteMissingFileId'),
                        });
                        setTimeout(() => {
                            removeJob(jobId);
                        }, 3000);
                    }
                } else if (statusData.status === 'failed') {
                    const failedData = statusData as JobStatusResponseFailed;
                    const errMsg = failedData.errorCode === 'INSUFFICIENT_POINTS'
                        ? `${failedData.error || '织梦豆不足'}（需要 ${failedData.requiredPoints ?? '-'}，当前 ${failedData.currentPoints ?? '-'}）`
                        : failedData.error || t('createGame.parsingFailed');
                    updateJob(jobId, {
                        status: 'failed',
                        error: errMsg,
                        elapsedSeconds: failedData.elapsedSeconds ?? null,
                        estimatedRemainingSeconds: failedData.estimatedRemainingSeconds ?? null,
                        estimatedTotalSeconds: failedData.estimatedTotalSeconds ?? null,
                        estimateSource: failedData.estimateSource ?? null,
                    });
                    toast.error(errMsg);
                    setTimeout(() => {
                        removeJob(jobId);
                    }, 3000);
                } else if (statusData.status === 'unknown') {
                    updateJob(jobId, {
                        status: 'failed',
                        error: t('createGame.jobNotFound'),
                    });
                    toast.error(t('createGame.jobNotFoundRetry'));
                    setTimeout(() => {
                        removeJob(jobId);
                    }, 3000);
                }
            } catch (error) {
                const errMsg = getBackendErrorMessage(error, t('createGame.pollingFailed'));
                console.error('Error polling upload status:', error);
                updateJob(jobId, {
                    status: 'failed',
                    error: errMsg,
                });
                toast.error(errMsg);
                setTimeout(() => {
                    removeJob(jobId);
                }, 3000);
            }
        };

        pollStatus();
    }, [mode, addJob, updateJob, removeJob, setFileId, setIsParsed, setIsPreset, onUploadComplete, t]);

    const handleFileUpload = useCallback(async (file: File): Promise<UploadResult> => {
        const uploadStartTime = Date.now();
        try {
            // 记录上传入口信息
            console.log('[useFileUpload] Upload started:', {
                mode: mode || 'visual',
                fileName: file.name,
                fileSize: file.size,
                fileType: file.type,
            });


            const uploadResponse = mode === 'worldInteraction'
                ? await worldEditor.uploadWorldFile(file)
                : await EditorApi.uploadGameFile(file);

            console.log('[useFileUpload] Upload request finished:', {
                status: uploadResponse.status,
                mode: mode || 'visual',
                fileName: file.name,
            });

            if (uploadResponse.status === 200) {
                const legacy = uploadResponse.data;
                if (legacy.success && legacy.fileId) {
                    setFileId(legacy.fileId);
                    setIsParsed(false);
                    setIsPreset(false);
                    await onUploadComplete(legacy.fileId, mode || 'visual');
                    return {
                        success: true,
                        completedImmediately: true,
                    };
                }

                console.error('Unexpected upload response: 200 but no fileId in body');
                return {
                    success: false,
                    error: getResponseErrorMessage(legacy, t('createGame.uploadFailed')),
                };
            }

            if (uploadResponse.status !== 202) {
                console.error('Unexpected upload response status:', uploadResponse.status);
                const errorMessage = getResponseErrorMessage(uploadResponse.data, t('createGame.uploadFailed'));
                toast.error(errorMessage);
                return {
                    success: false,
                    error: errorMessage,
                };
            }

            const accepted = uploadResponse.data;
            if (!accepted.success || !accepted.jobId) {
                console.error('Invalid 202 Accepted payload', accepted);
                const errorMessage = getResponseErrorMessage(accepted, t('createGame.uploadFailed'));
                toast.error(errorMessage);
                return {
                    success: false,
                    error: errorMessage,
                };
            }

            const { jobId, fileId: initialFileId } = accepted;
            console.log('[useFileUpload] Upload accepted:', {
                jobId,
                initialFileId: initialFileId || null,
                mode: mode || 'visual',
            });

            startPollingUploadStatus(
                jobId,
                file.name,
                mode || 'visual',
                uploadStartTime,
                mode === 'worldInteraction' ? undefined : 'document',
            );

            if (initialFileId) {
                updateJob(jobId, {
                    fileId: initialFileId,
                });
            }

            return {
                success: true,
            };
        } catch (error) {
            const errorMessage = getBackendErrorMessage(error, t('createGame.uploadFailed'));
            console.error('[useFileUpload] Upload failed:', {
                mode: mode || 'visual',
                fileName: file.name,
                error: errorMessage,
                raw: error,
            });

            toast.error(errorMessage);
            return {
                success: false,
                error: errorMessage,
            };
        }
    }, [mode, t, onUploadComplete, setFileId, setIsParsed, setIsPreset, startPollingUploadStatus, updateJob]);

    const handleGenerateFromIdea = useCallback(async (
        idea: string,
        options: IdeaGenerateOptions = DEFAULT_TEXT_GENERATE_OPTIONS,
    ): Promise<boolean> => {
        if (mode === 'worldInteraction') {
            toast.error(t('createGame.ideaGenerationOnlyVisual'));
            return false;
        }
        try {
            // 功能注释：一句话生成需 10 积分，本地先预检（图片按张另计）
            const enough = await ensureEnoughPointsForVisualDoc(TXT_IDEA_GENERATE_COST, t);
            if (!enough) {
                return false;
            }

            const generateAssets = shouldGenerateAssetsAfterIdea(options);
            const response = await EditorApi.generateGameFromIdea(idea, {
                generateAssets,
                assetFlags: generateAssets ? options.assets : undefined,
            });
            if (response.status === 200) {
                const legacy = response.data;
                if (legacy.success && legacy.fileId) {
                    setFileId(legacy.fileId);
                    setIsParsed(false);
                    setIsPreset(false);
                    rememberIdeaFullWorkAssets(legacy.fileId, options);
                    clearAssetGapBannerDismissed(legacy.fileId);
                    markAssetGapBannerPending(legacy.fileId, generateAssets ? 'generating' : 'text');
                    if (generateAssets) {
                        setIdeaAssetGenStatus(legacy.fileId, 'pending');
                        publishIdeaAssetProgress(
                            createInitialIdeaAssetProgress(legacy.fileId, options.assets),
                        );
                    }
                    return true;
                } else {
                    console.error('Unexpected generate response: 200 but no fileId in body');
                    return false;
                }
            }

            if (response.status !== 202) {
                console.error('Unexpected generate response status:', response.status);
                toast.error(t('createGame.generateFailedRetry'));
                return false;
            }

            const accepted = response.data;
            if (!accepted.success || !accepted.jobId) {
                console.error('Invalid 202 Accepted payload', accepted);
                toast.error(t('createGame.generateFailedRetry'));
                return false;
            }

            const { jobId, fileId: initialFileId } = accepted;

            rememberIdeaFullWorkAssets(jobId, options);
            if (initialFileId) {
                rememberIdeaFullWorkAssets(initialFileId, options);
                updateJob(jobId, {
                    fileId: initialFileId,
                });
            }

            const generateStartTime = Date.now();
            console.log('[一句话生成] 开始轮询, jobId:', jobId, 'generateAssets:', generateAssets);
            startPollingUploadStatus(
                jobId,
                `${t('createGame.generatingGame')}：${idea.substring(0, 20)}...`,
                'visual',
                generateStartTime,
                'idea',
            );

            return true;
        } catch (error) {
            console.error('Error generating from idea:', error);
            toast.error(getBackendErrorMessage(error, t('createGame.generateFailedRetry')));
            return false;
        }
    }, [mode, t, setFileId, setIsParsed, setIsPreset, updateJob, startPollingUploadStatus]);

    return {
        handleFileUpload,
        handleGenerateFromIdea,
    };
};
