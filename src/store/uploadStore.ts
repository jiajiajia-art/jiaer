import { create } from 'zustand';

/** 功能注释：document=文档导入；idea=一句话生成——进度文案需分流 */
export type UploadJobKind = 'document' | 'idea';

export interface UploadJob {
    jobId: string;
    fileId: string | null;
    fileName: string;
    kind: UploadJobKind;
    status: 'uploading' | 'processing' | 'completed' | 'failed';
    progress: number;
    stage: string;
    error: string | null;
    startTime: number;
    updatedAt: string | null;
    elapsedSeconds: number | null;
    estimatedRemainingSeconds: number | null;
    estimatedTotalSeconds: number | null;
    estimateSource: string | null;
}

interface UploadState {
    jobs: Record<string, UploadJob>;
    showProgressModal: boolean;
    isMinimized: boolean;
    addJob: (jobId: string, fileName: string, startTime?: number, kind?: UploadJobKind) => void;
    updateJob: (jobId: string, updates: Partial<UploadJob>) => void;
    removeJob: (jobId: string) => void;
    setShowProgressModal: (show: boolean) => void;
    setIsMinimized: (minimized: boolean) => void;
    clearAllJobs: () => void;
    getActiveJobs: () => UploadJob[];
}

export const useUploadStore = create<UploadState>((set, get) => ({
    jobs: {},
    showProgressModal: false,
    isMinimized: false,

    addJob: (jobId: string, fileName: string, startTime?: number, kind: UploadJobKind = 'document') => {
        set((state) => ({
            jobs: {
                ...state.jobs,
                [jobId]: {
                    jobId,
                    fileId: null,
                    fileName,
                    kind,
                    status: 'uploading',
                    progress: 0,
                    // 功能注释：一句话任务初始不是「上传中」
                    stage: kind === 'idea' ? '排队中' : '上传中',
                    error: null,
                    startTime: startTime || Date.now(),
                    updatedAt: null,
                    elapsedSeconds: null,
                    estimatedRemainingSeconds: null,
                    estimatedTotalSeconds: null,
                    estimateSource: null,
                },
            },
            showProgressModal: true,
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
            (job) => job.status === 'uploading' || job.status === 'processing',
        );
    },
}));
