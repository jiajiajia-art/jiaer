// 全局音乐播放器管理器，确保所有组件共享同一个音频实例

class MapMusicManager {
    private audio: HTMLAudioElement | null = null;
    private currentMusicUrl: string | null = null;
    private currentMusicId: string | null = null;
    private isLoading: boolean = false;
    private failedMusicIds: Set<string> = new Set();

    getAudio(): HTMLAudioElement | null {
        return this.audio;
    }

    setAudio(audio: HTMLAudioElement | null): void {
        this.audio = audio;
    }

    getCurrentMusicUrl(): string | null {
        return this.currentMusicUrl;
    }

    setCurrentMusicUrl(url: string | null): void {
        this.currentMusicUrl = url;
    }

    getCurrentMusicId(): string | null {
        return this.currentMusicId;
    }

    setCurrentMusicId(id: string | null): void {
        this.currentMusicId = id;
    }

    getIsLoading(): boolean {
        return this.isLoading;
    }

    setIsLoading(loading: boolean): void {
        this.isLoading = loading;
    }

    hasFailedMusicId(id: string): boolean {
        return this.failedMusicIds.has(id);
    }

    addFailedMusicId(id: string): void {
        this.failedMusicIds.add(id);
    }

    deleteFailedMusicId(id: string): void {
        this.failedMusicIds.delete(id);
    }

    clearFailedMusicIds(): void {
        this.failedMusicIds.clear();
    }

    cleanup(): void {
        if (this.audio) {
            this.audio.pause();
            this.audio.src = '';
            this.audio = null;
        }
        if (this.currentMusicUrl && this.currentMusicUrl.startsWith('blob:')) {
            URL.revokeObjectURL(this.currentMusicUrl);
        }
        this.currentMusicUrl = null;
        this.currentMusicId = null;
        this.isLoading = false;
    }
}

// 导出单例
export const mapMusicManager = new MapMusicManager();

