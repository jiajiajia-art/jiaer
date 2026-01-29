import { useEffect, useCallback, useRef, useState } from 'react';
import MapWorldData from '../../../api/worldInteraction/mapWorldData';
import type { AllGameData, Scene } from '../../../api/worldInteraction/mapWorldData.type';
import type { MapViewState } from '../../../store/mapGalgameStore';
import type { EventData } from '../../../page/GalgameMap';
import { useMapGalgameStore } from '../../../store/mapGalgameStore';
import { mapMusicManager } from '../../../utils/mapMusicManager';

interface UseMapMusicPlayerOptions {
    fileId: string | null;
    gameData: AllGameData | null;
    currentView: MapViewState;
    selectedScene?: Scene | null;
    selectedSubscene: {
        id: string;
        name: string;
        image: string;
        parentSceneName: string;
    } | null;
    eventData: EventData | null;
}

export const useMapMusicPlayer = ({
    fileId,
    gameData,
    currentView,
    selectedScene = null,
    selectedSubscene,
    eventData,
}: UseMapMusicPlayerOptions) => {
    const { isMusicPlaying, setMusicPlaying } = useMapGalgameStore();
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const lastSceneIdRef = useRef<string | null>(null); // 记录上次的场景 ID，用于检测场景变化
    const [volume, setVolume] = useState<number>(0.5); // 0..1
    
    // 同步本地 ref 和全局管理器
    useEffect(() => {
        audioRef.current = mapMusicManager.getAudio();
    }, []);

    // 自动播放解锁器（处理浏览器策略）
    const autoplayUnlockCleanupRef = useRef<(() => void) | null>(null);

    // 尝试播放音频；若被策略阻止则挂一次性用户手势解锁
    const tryPlayAudio = useCallback(async () => {
        const audio = mapMusicManager.getAudio();
        if (!audio) return;
        try {
            await audio.play();
            if (autoplayUnlockCleanupRef.current) {
                autoplayUnlockCleanupRef.current();
                autoplayUnlockCleanupRef.current = null;
            }
        } catch (error: any) {
            if (error?.name === 'NotAllowedError') {
                if (!autoplayUnlockCleanupRef.current) {
                    const unlock = () => {
                        audio.play().finally(() => {
                            document.removeEventListener('pointerdown', unlock);
                            document.removeEventListener('touchstart', unlock);
                            document.removeEventListener('click', unlock);
                            autoplayUnlockCleanupRef.current = null;
                        });
                    };
                    const cleanup = () => {
                        document.removeEventListener('pointerdown', unlock);
                        document.removeEventListener('touchstart', unlock);
                        document.removeEventListener('click', unlock);
                    };
                    autoplayUnlockCleanupRef.current = cleanup;
                    document.addEventListener('pointerdown', unlock, { once: true });
                    document.addEventListener('touchstart', unlock, { once: true });
                    document.addEventListener('click', unlock, { once: true });
                }
            } else {
                console.warn('播放音乐失败:', error);
            }
        }
    }, []);

    // 获取当前应该播放的音乐场景
    const getCurrentMusicScene = useCallback(() => {
        if (!gameData) return null;

    // 场景视图：直接使用当前选中的场景音乐
    if (currentView === 'scene_view' && selectedScene) {
      return selectedScene;
    }

    // 场景模态框视图：使用选中子场景的父场景音乐
        if (currentView === 'subScene_modal' && selectedSubscene) {
            const parentScene = gameData.sceneSetting.scenes.find(
                scene => scene.name === selectedSubscene.parentSceneName
            );
            return parentScene || null;
        }

        // 如果是在 NPC 交互视图，使用事件中子场景的父场景音乐
        if ((currentView === 'interact_npc_normal' || currentView === 'interact_npc_ability') && eventData?.subscene) {
            // 从 eventData.subscene 中找到对应的场景
            const parentScene = gameData.sceneSetting.scenes.find(
                scene => scene.subscenes.some(sub => sub.id === eventData.subscene.id)
            );
            return parentScene || null;
        }

        // 如果是在世界地图视图，使用第一个场景的音乐
        if (currentView === 'world_map') {
            const firstScene = gameData.sceneSetting.scenes[0];
            return firstScene || null;
        }

        return null;
    }, [gameData, currentView, selectedSubscene, eventData]);

    const loadAndPlayMusic = useCallback(
        async (scene: AllGameData['sceneSetting']['scenes'][0] | null, autoPlay: boolean = true) => {
            if (!fileId || !scene) {
                const audio = mapMusicManager.getAudio();
                if (audio) {
                    audio.pause();
                    audio.src = '';
                }
                mapMusicManager.setCurrentMusicUrl(null);
                setMusicPlaying(false);
                mapMusicManager.setIsLoading(false);
                mapMusicManager.setCurrentMusicId(null);
                audioRef.current = null;
                mapMusicManager.setAudio(null);
                return;
            }

            const soundtrack = scene.soundtrack;
            if (!soundtrack) {
                const audio = mapMusicManager.getAudio();
                if (audio) {
                    audio.pause();
                    audio.src = '';
                }
                mapMusicManager.setCurrentMusicUrl(null);
                setMusicPlaying(false);
                mapMusicManager.setIsLoading(false);
                mapMusicManager.setCurrentMusicId(null);
                audioRef.current = null;
                mapMusicManager.setAudio(null);
                return;
            }

            // 如果音乐 ID 相同且已有 URL，直接播放
            const currentMusicId = mapMusicManager.getCurrentMusicId();
            const currentMusicUrl = mapMusicManager.getCurrentMusicUrl();
            if (currentMusicId === soundtrack && currentMusicUrl) {
                const audio = mapMusicManager.getAudio();
                if (autoPlay && isMusicPlaying && audio) {
                    await tryPlayAudio();
                }
                audioRef.current = audio;
                return;
            }

            // 如果这个音乐之前加载失败过，不再重复请求
            if (mapMusicManager.hasFailedMusicId(soundtrack)) {
                console.warn(`音乐 ${soundtrack} 之前加载失败，跳过重复请求`);
                return;
            }

            if (mapMusicManager.getIsLoading()) {
                return;
            }

            mapMusicManager.setIsLoading(true);
            mapMusicManager.setCurrentMusicId(soundtrack);

            try {
                const response = await MapWorldData.getMapGalgameMusic(fileId, soundtrack);

                console.log('音乐响应:', {
                    status: response.status,
                    dataType: typeof response.data,
                    isBlob: response.data instanceof Blob,
                    size: response.data instanceof Blob ? response.data.size : 'N/A',
                    type: response.data instanceof Blob ? response.data.type : 'N/A',
                });

                if (!response.data || !(response.data instanceof Blob) || response.data.size === 0) {
                    console.warn('音乐响应数据无效:', {
                        hasData: !!response.data,
                        isBlob: response.data instanceof Blob,
                        size: response.data instanceof Blob ? response.data.size : 'N/A',
                    });
                    mapMusicManager.setIsLoading(false);
                    mapMusicManager.setCurrentMusicId(null);
                    if (!autoPlay) {
                        setMusicPlaying(false);
                    }
                    return;
                }

                const musicUrl = URL.createObjectURL(response.data);
                console.log('创建 blob URL:', musicUrl.substring(0, 50) + '...');

                // 清理之前的音频
                const oldAudio = mapMusicManager.getAudio();
                const oldUrl = mapMusicManager.getCurrentMusicUrl();
                
                if (oldAudio) {
                    oldAudio.pause();
                    oldAudio.src = '';
                }
                if (oldUrl && oldUrl.startsWith('blob:')) {
                    URL.revokeObjectURL(oldUrl);
                }

                const audio = new Audio(musicUrl);
                audio.loop = true;
                audio.volume = volume;

                console.log('创建音频元素:', {
                    src: audio.src.substring(0, 50) + '...',
                    volume: audio.volume,
                    loop: audio.loop,
                });

                mapMusicManager.setAudio(audio);
                mapMusicManager.setCurrentMusicUrl(musicUrl);
                audioRef.current = audio;

                // 等待音频可以播放
                await new Promise<void>((resolve, reject) => {
                    const handleCanPlay = () => {
                        console.log('音频可以播放了');
                        if (isMusicPlaying && audioRef.current === audio) {
                            void tryPlayAudio();
                        }
                        resolve();
                    };
                const handleError = () => {
                    if (!audio.src) {
                        console.warn('音频加载错误: src 为空，忽略（将继续尝试播放）');
                        resolve();
                        return;
                    }
                    console.error('音频加载错误:', {
                        error: audio.error,
                        errorCode: audio.error?.code,
                        errorMessage: audio.error?.message,
                        networkState: audio.networkState,
                        readyState: audio.readyState,
                        src: audio.src,
                    });
                    reject(new Error(`音乐加载失败: ${audio.error?.message || '未知错误'}`));
                    };
                    audio.addEventListener('canplay', handleCanPlay, { once: true });
                    audio.addEventListener('error', handleError, { once: true });
                    audio.load();
                });

                // 如果需要自动播放，则播放音乐并更新状态
                if (autoPlay && mapMusicManager.getAudio() === audio) {
                    console.log('尝试播放音乐');
                    await tryPlayAudio();
                    setMusicPlaying(true);
                } else if (!autoPlay) {
                    setMusicPlaying(false);
                }

                mapMusicManager.setIsLoading(false);
            } catch (error) {
                console.error('加载音乐失败:', error);
                // 记录失败的音乐 ID，避免重复请求
                if (soundtrack) {
                    mapMusicManager.addFailedMusicId(soundtrack);
                }
                const audio = mapMusicManager.getAudio();
                if (audio) {
                    audio.pause();
                    audio.src = '';
                }
                const currentMusicUrl = mapMusicManager.getCurrentMusicUrl();
                if (currentMusicUrl && currentMusicUrl.startsWith('blob:')) {
                    URL.revokeObjectURL(currentMusicUrl);
                }
                mapMusicManager.setCurrentMusicUrl(null);
                setMusicPlaying(false);
                mapMusicManager.setIsLoading(false);
                mapMusicManager.setCurrentMusicId(null);
                mapMusicManager.setAudio(null);
                audioRef.current = null;
            }
        },
        [fileId, isMusicPlaying, setMusicPlaying, volume]
    );

    const handleVolumeChange = useCallback((newVolume: number) => {
        const clamped = Math.max(0, Math.min(1, newVolume));
        setVolume(clamped);
        const audio = mapMusicManager.getAudio();
        if (audio) {
            audio.volume = clamped;
        }
    }, []);

    // 音量变化时同步到当前音频（兜底：外部直接 setVolume 也能生效）
    useEffect(() => {
        const audio = mapMusicManager.getAudio();
        if (audio) {
            audio.volume = Math.max(0, Math.min(1, volume));
        }
    }, [volume]);

    const handleMusicToggle = useCallback(async () => {
        if (isMusicPlaying) {
            const audio = mapMusicManager.getAudio();
            if (audio) {
                audio.pause();
            }
            setMusicPlaying(false);
        } else {
            setMusicPlaying(true);
            const audio = mapMusicManager.getAudio();
            const currentMusicUrl = mapMusicManager.getCurrentMusicUrl();
            if (audio && currentMusicUrl) {
                try {
                    await audio.play();
                } catch (error) {
                    console.warn('播放音乐失败:', error);
                    setMusicPlaying(false);
                }
            } else {
                const currentScene = getCurrentMusicScene();
                if (currentScene) {
                    // 用户手动点击时，清除失败记录，允许重试
                    mapMusicManager.deleteFailedMusicId(currentScene.soundtrack);
                    await loadAndPlayMusic(currentScene, true);
                }
            }
        }
    }, [isMusicPlaying, getCurrentMusicScene, loadAndPlayMusic, setMusicPlaying]);

    // 当视图或场景变化时，自动切换音乐
    useEffect(() => {
        // 如果正在加载音乐，不触发新的加载
        if (mapMusicManager.getIsLoading()) {
            return;
        }
        
        const currentScene = getCurrentMusicScene();
        const currentSceneId = currentScene?.id || null;
        
        // 如果场景变化了，清除失败记录（允许重新尝试）
        if (currentSceneId !== lastSceneIdRef.current) {
            mapMusicManager.clearFailedMusicIds();
            lastSceneIdRef.current = currentSceneId;
        }
        
        if (currentScene) {
            // 根据当前播放状态决定是否自动播放
            const shouldAutoPlay = isMusicPlaying;
            loadAndPlayMusic(currentScene, shouldAutoPlay);
        } else {
            // 如果没有场景（如开场白视图），停止音乐
            const audio = mapMusicManager.getAudio();
            if (audio) {
                audio.pause();
            }
            setMusicPlaying(false);
            lastSceneIdRef.current = null;
        }
    }, [currentView, selectedSubscene?.id, eventData?.subscene?.id, gameData?.sceneSetting?.scenes, getCurrentMusicScene, loadAndPlayMusic, isMusicPlaying, setMusicPlaying, tryPlayAudio]);

    // 同步音乐播放状态
    useEffect(() => {
        const audio = mapMusicManager.getAudio();
        const currentMusicUrl = mapMusicManager.getCurrentMusicUrl();
        if (!audio || !currentMusicUrl) return;

        if (isMusicPlaying) {
            audio.play().catch((error: any) => {
                // 静默处理自动播放策略限制等非关键错误
                if (error?.name !== 'NotAllowedError') {
                    console.warn('同步播放失败:', error);
                }
            });
        } else {
            audio.pause();
        }
        // 同步本地 ref
        audioRef.current = audio;
    }, [isMusicPlaying]);

    // 清理资源（只在组件卸载时清理）
    useEffect(() => {
        return () => {
            // 注意：这里不清理全局音频，因为其他组件可能还在使用
            // 只在最后一个组件卸载时才清理（可以通过引用计数实现，但这里简化处理）
            // 实际清理应该在页面卸载时统一处理
        };
    }, []);

    return {
        isMusicPlaying,
        handleMusicToggle,
        volume,
        setVolume: handleVolumeChange,
    };
};

