import { useState, useEffect, useCallback, useRef } from 'react';
import getGalgamePresetApi from '../../api/galgame/getGalgamePreset';
import type { GetGalgamePresetResponse } from '../../api/galgame/getGalgamePreset.type';

interface UseMusicPlayerOptions {
    presetId: string | null;
    currentScene: GetGalgamePresetResponse['scenes']['scenes'][0] | null;
    gameStarted: boolean;
    isLoading: boolean;
}

export const useMusicPlayer = ({
    presetId,
    currentScene,
    gameStarted,
    isLoading,
}: UseMusicPlayerOptions) => {
    const [isMusicPlaying, setIsMusicPlaying] = useState<boolean>(false);
    const [currentMusicUrl, setCurrentMusicUrl] = useState<string | null>(null);
    const [volume, setVolume] = useState<number>(0.5);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const currentSceneIdRef = useRef<string | null>(null);
    const isLoadingMusicRef = useRef<boolean>(false);

    const loadAndPlaySceneMusic = useCallback(
        async (scene?: GetGalgamePresetResponse['scenes']['scenes'][0] | null, autoPlay: boolean = true) => {
            if (!presetId) return;

            const targetScene = scene ?? currentScene;
            const sceneId = targetScene?.id;
            const soundtrack = targetScene?.soundtrack;

            if (!sceneId || !soundtrack) {
                if (audioRef.current) {
                    audioRef.current.pause();
                    audioRef.current.src = '';
                }
                setCurrentMusicUrl(null);
                setIsMusicPlaying(false);
                isLoadingMusicRef.current = false;
                currentSceneIdRef.current = null;
                return;
            }

            if (currentSceneIdRef.current === sceneId && currentMusicUrl) {
                if (autoPlay && isMusicPlaying && audioRef.current) {
                    try {
                        await audioRef.current.play();
                    } catch (error) {
                        console.log('播放音乐失败:', error);
                    }
                }
                return;
            }

            if (isLoadingMusicRef.current) {
                return;
            }

            isLoadingMusicRef.current = true;
            currentSceneIdRef.current = sceneId;

            try {
                const response = await getGalgamePresetApi.getGalgameMusic(presetId, soundtrack);

                if (!response.data || !(response.data instanceof Blob)) {
                    isLoadingMusicRef.current = false;
                    currentSceneIdRef.current = null;
                    if (!autoPlay) {
                        setIsMusicPlaying(false);
                    }
                    return;
                }

                const musicUrl = URL.createObjectURL(response.data);

                // 清理之前的音频
                if (audioRef.current) {
                    audioRef.current.pause();
                    audioRef.current.src = '';
                }
                if (currentMusicUrl && currentMusicUrl.startsWith('blob:')) {
                    URL.revokeObjectURL(currentMusicUrl);
                }

                const audio = new Audio(musicUrl);
                audio.loop = true;
                audio.volume = volume;

                audioRef.current = audio;
                setCurrentMusicUrl(musicUrl);

                // 等待音频可以播放
                await new Promise<void>((resolve, reject) => {
                    const handleCanPlay = () => {
                        resolve();
                    };
                    const handleError = () => {
                        reject(new Error('音乐加载失败'));
                    };
                    audio.addEventListener('canplay', handleCanPlay, { once: true });
                    audio.addEventListener('error', handleError, { once: true });
                    audio.load();
                });

                // 如果需要自动播放，则播放音乐并更新状态
                if (autoPlay && audioRef.current === audio) {
                    try {
                        await audio.play();
                        setIsMusicPlaying(true);
                    } catch (error) {
                        setIsMusicPlaying(false);
                    }
                } else if (!autoPlay) {
                    setIsMusicPlaying(false);
                }

                isLoadingMusicRef.current = false;
            } catch (error) {
                // 只在真正失败时处理
                if (audioRef.current) {
                    audioRef.current.pause();
                    audioRef.current.src = '';
                }
                if (currentMusicUrl && currentMusicUrl.startsWith('blob:')) {
                    URL.revokeObjectURL(currentMusicUrl);
                }
                setCurrentMusicUrl(null);
                setIsMusicPlaying(false);
                isLoadingMusicRef.current = false;
                currentSceneIdRef.current = null;
                audioRef.current = null;
            }
        },
        [presetId, currentScene, isMusicPlaying, currentMusicUrl]
    );

    const handleMusicToggle = useCallback(async () => {
        if (isMusicPlaying) {
            if (audioRef.current) {
                audioRef.current.pause();
            }
            setIsMusicPlaying(false);
        } else {
            setIsMusicPlaying(true);
            if (audioRef.current && currentMusicUrl) {
                try {
                    await audioRef.current.play();
                } catch (error) {
                    console.warn('播放音乐:', error);
                }
            } else if (currentScene) {
                await loadAndPlaySceneMusic(currentScene, true);
            }
        }
    }, [isMusicPlaying, currentMusicUrl, currentScene, loadAndPlaySceneMusic]);

    const setVolumeLevel = useCallback((newVolume: number) => {
        const clamped = Math.max(0, Math.min(1, newVolume));
        setVolume(clamped);
        if (audioRef.current) {
            audioRef.current.volume = clamped;
        }
    }, []);

    // 同步音量到音频实例
    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = volume;
        }
    }, [volume]);

    // 进入页面时，如果有场景音乐，默认播放
    useEffect(() => {
        if (!isLoading && currentScene?.id && currentScene?.soundtrack && !gameStarted) {
            loadAndPlaySceneMusic(currentScene, true);
        }
    }, [isLoading, currentScene?.id, currentScene?.soundtrack, gameStarted, loadAndPlaySceneMusic]);

    // 游戏开始后，场景切换时自动播放音乐
    useEffect(() => {
        if (!gameStarted || !currentScene?.id || !currentScene?.soundtrack) {
            return;
        }

        loadAndPlaySceneMusic(currentScene, true);
    }, [currentScene?.id, currentScene?.soundtrack, gameStarted, loadAndPlaySceneMusic]);

    // 同步音乐播放状态
    useEffect(() => {
        if (!audioRef.current || !currentMusicUrl) return;

        if (isMusicPlaying) {
            audioRef.current.play().catch(() => {
                // 静默处理自动播放策略限制等非关键错误
            });
        } else {
            audioRef.current.pause();
        }
    }, [isMusicPlaying, currentMusicUrl]);

    // 清理资源
    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.src = '';
            }
        };
    }, []);

    return {
        isMusicPlaying,
        handleMusicToggle,
        volume,
        setVolume: setVolumeLevel,
    };
};

