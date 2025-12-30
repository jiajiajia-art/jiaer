import { useCallback } from 'react';
import { toast } from 'react-hot-toast';
import EditorApi from '../../api/galgame/EditorData';
import worldEditor from '../../api/worldInteraction/worldEditor';
import { useGameStore } from '../../store/gameStore';
import { useUploadStore } from '../../store/uploadStore';
import { useEditorStore } from '../../store/editorStore';

type JobStage = 'uploaded' | 'parsing' | 'generating' | 'validating' | 'writing' | 'done';

interface JobStatusResponseRunning {
    success?: boolean;
    jobId: string;
    fileId?: string;
    status: 'running' | 'queued';
    stage?: JobStage;
    progress?: number;
    error?: string;
}

interface JobStatusResponseCompleted {
    success?: boolean;
    jobId: string;
    fileId: string;
    status: 'completed';
}

interface JobStatusResponseFailed {
    success?: boolean;
    status: 'failed';
    error?: string;
}

interface UseFileUploadOptions {
    mode: string | null;
    onUploadComplete: (fileId: string, dataMode: string) => Promise<void>;
}

interface UseFileUploadReturn {
    handleFileUpload: (file: File) => Promise<boolean>;
}

export const useFileUpload = ({ mode, onUploadComplete }: UseFileUploadOptions): UseFileUploadReturn => {
    const { setFileId, setIsPreset } = useGameStore();
    const { setIsParsed } = useEditorStore();
    const { addJob, updateJob, removeJob } = useUploadStore();

    const startPollingUploadStatus = useCallback((
        jobId: string,
        fileName: string,
        dataMode: string
    ) => {
        addJob(jobId, fileName);
        
        let delay = 1000;
        const maxDelay = 5000;
        const timeoutMs = 30 * 60 * 1000; // 30分钟超时
        const started = Date.now();
        
        const pollStatus = async () => {
            try {
                if (Date.now() - started > timeoutMs) {
                    updateJob(jobId, {
                        status: 'failed',
                        error: '上传超时，请重试',
                    });
                    setTimeout(() => {
                        removeJob(jobId);
                    }, 3000);
                    toast.error('上传超时，请重试');
                    return;
                }
                
                const statusResponse = mode === 'worldInteraction' 
                    ? worldEditor.checkUploadStatus(jobId) 
                    : EditorApi.checkUploadStatus(jobId);
                const statusData = (await statusResponse).data;
                
                if (statusData.status === 'running' || statusData.status === 'queued') {
                    const runningData = statusData as JobStatusResponseRunning;
                    updateJob(jobId, {
                        fileId: runningData.fileId || null,
                        status: runningData.status === 'queued' ? 'uploading' : 'processing',
                        progress: runningData.progress || 0,
                        stage: runningData.stage || (runningData.status === 'queued' ? '上传中' : '处理中'),
                        error: null,
                    });
                    
                    setTimeout(() => {
                        pollStatus();
                    }, delay);
                    delay = Math.min(Math.round(delay * 1.3), maxDelay);
                    
                } else if (statusData.status === 'completed') {
                    const completedData = statusData as JobStatusResponseCompleted;
                    if (completedData.fileId) {
                        setFileId(completedData.fileId);
                        setIsParsed(false);
                        setIsPreset(false);
                        
                        updateJob(jobId, {
                            fileId: completedData.fileId,
                            status: 'completed',
                            progress: 100,
                            stage: '完成',
                        });
                        
                        onUploadComplete(completedData.fileId, dataMode).catch((error) => {
                            console.error('Error fetching editor data after upload:', error);
                            toast.error('文件解析完成，但加载数据失败，请刷新页面');
                        });
                        
                        setTimeout(() => {
                            removeJob(jobId);
                        }, 2000);
                    } else {
                        updateJob(jobId, {
                            status: 'failed',
                            error: '完成但缺少 fileId',
                        });
                        setTimeout(() => {
                            removeJob(jobId);
                        }, 3000);
                    }
                    
                } else if (statusData.status === 'failed') {
                    const failedData = statusData as JobStatusResponseFailed;
                    const errMsg = failedData.error || '解析失败，请重试';
                    updateJob(jobId, {
                        status: 'failed',
                        error: errMsg,
                    });
                    toast.error(errMsg);
                    setTimeout(() => {
                        removeJob(jobId);
                    }, 3000);
                    
                } else if (statusData.status === 'unknown') {
                    updateJob(jobId, {
                        status: 'failed',
                        error: '任务不存在或已回收',
                    });
                    toast.error('任务不存在或已回收，请重试上传');
                    setTimeout(() => {
                        removeJob(jobId);
                    }, 3000);
                }
                
            } catch (error) {
                console.error('Error polling upload status:', error);
                updateJob(jobId, {
                    status: 'failed',
                    error: error instanceof Error ? error.message : '轮询状态失败',
                });
                toast.error('轮询状态失败，请重试');
                setTimeout(() => {
                    removeJob(jobId);
                }, 3000);
            }
        };
        
        pollStatus();
    }, [mode, addJob, updateJob, removeJob, setFileId, setIsParsed, setIsPreset, onUploadComplete]);

    const handleFileUpload = useCallback(async (file: File): Promise<boolean> => {
        try {
            let uploadResponse;
            
            if (mode === 'worldInteraction') {
                uploadResponse = await worldEditor.uploadWorldFile(file);
            } else {
                uploadResponse = await EditorApi.uploadGameFile(file);
            }
            
            // 容错：若后端临时返回 200 + fileId，也尝试兼容
            if (uploadResponse.status === 200) {
                const legacy = uploadResponse.data;
                if (legacy.success && legacy.fileId) {
                    setFileId(legacy.fileId);
                    setIsParsed(false);
                    setIsPreset(false);
                    return true;
                } else {
                    console.error('Unexpected upload response: 200 but no fileId in body');
                    return false;
                }
            }
            
            if (uploadResponse.status !== 202) {
                console.error('Unexpected upload response status:', uploadResponse.status);
                toast.error('上传失败，请重试');
                return false;
            }
            
            const accepted = uploadResponse.data;
            if (!accepted.success || !accepted.jobId) {
                console.error('Invalid 202 Accepted payload', accepted);
                toast.error('上传失败，请重试');
                return false;
            }
            
            const { jobId, fileId: initialFileId } = accepted;
            
            if (initialFileId) {
                updateJob(jobId, {
                    fileId: initialFileId,
                });
            }
            
            startPollingUploadStatus(jobId, file.name, mode || 'visual');
            
            return true;
        } catch (error) {
            console.error('Error uploading file:', error);
            return false;
        }
    }, [mode, setFileId, setIsParsed, setIsPreset, updateJob, startPollingUploadStatus]);

    return {
        handleFileUpload,
    };
};

