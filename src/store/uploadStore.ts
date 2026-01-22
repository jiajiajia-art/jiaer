import { create } from 'zustand';

export interface UploadJob {
    jobId: string;
    fileId: string | null;
    fileName: string;
    status: 'uploading' | 'processing' | 'completed' | 'failed';
    progress: number;
    stage: string;
    error: string | null;
    startTime: number;
    updatedAt: string | null;
}

interface UploadState {
    // 当前上传任务列表（支持多个任务）
    jobs: Record<string, UploadJob>;
    
    // 是否显示进度弹窗
    showProgressModal: boolean;
    
    // 是否最小化
    isMinimized: boolean;
    
    // Actions
    addJob: (jobId: string, fileName: string, startTime?: number) => void;
    updateJob: (jobId: string, updates: Partial<UploadJob>) => void;
    removeJob: (jobId: string) => void;
    setShowProgressModal: (show: boolean) => void;
    setIsMinimized: (minimized: boolean) => void;
    clearAllJobs: () => void;
    
    // 获取所有进行中的任务
    getActiveJobs: () => UploadJob[];
}

export const useUploadStore = create<UploadState>((set, get) => ({
    jobs: {},
    showProgressModal: false,
    isMinimized: false,
    
    addJob: (jobId: string, fileName: string, startTime?: number) => {
        set((state) => ({
            jobs: {
                ...state.jobs,
                [jobId]: {
                    jobId,
                    fileId: null,
                    fileName,
                    status: 'uploading',
                    progress: 0,
                    stage: '上传中',
                    error: null,
                    startTime: startTime || Date.now(), // 使用传入的开始时间，如果没有则使用当前时间
                    updatedAt: null,
                },
            },
            showProgressModal: true, // 自动显示弹窗
        }));
    },
    
    updateJob: (jobId: string, updates: Partial<UploadJob>) => {
        set((state) => {
            const job = state.jobs[jobId];
            if (!job) return state;
            
            const updatedJob: UploadJob = {
                ...job,
                ...updates,
                updatedAt: updates.updatedAt || job.updatedAt || new Date().toISOString(),
            };
            
            // 如果任务完成或失败，延迟移除（可选，也可以保留显示）
            return {
                jobs: {
                    ...state.jobs,
                    [jobId]: updatedJob,
                },
            };
        });
    },
    
    removeJob: (jobId: string) => {
        set((state) => {
            const newJobs = { ...state.jobs };
            delete newJobs[jobId];
            
            // 如果没有任务了，自动关闭弹窗
            if (Object.keys(newJobs).length === 0) {
                return {
                    jobs: newJobs,
                    showProgressModal: false,
                };
            }
            
            return {
                jobs: newJobs,
            };
        });
    },
    
    setShowProgressModal: (show: boolean) => {
        set({ showProgressModal: show });
    },
    
    setIsMinimized: (minimized: boolean) => {
        set({ isMinimized: minimized });
    },
    
    clearAllJobs: () => {
        set({ jobs: {}, showProgressModal: false, isMinimized: false });
    },
    
    getActiveJobs: () => {
        return Object.values(get().jobs).filter(
            job => job.status === 'uploading' || job.status === 'processing'
        );
    },
}));

