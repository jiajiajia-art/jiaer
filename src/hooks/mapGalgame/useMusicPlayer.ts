import { useState, useEffect, useCallback, useRef } from 'react';
import getGalgamePresetApi from '../../api/galgame/getGalgamePreset';
import type { GetGalgamePresetResponse } from '../../api/galgame/getGalgamePreset.type';

const MUSIC_LOADING_TIMEOUT_MS = 10_000;

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
    const [isMusicLoading, setIsMusicLoading] = useState<boolean>(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const currentSceneIdRef = useRef<string | null>(null);
    const isLoadingMusicRef = useRef<boolean>(false);
    const hasResetMusicForCurrentGameRef = useRef<boolean>(false);
    const musicLoadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearMusicLoadingTimer = useCallback(() => {
        if (musicLoadingTimerRef.current) {
            clearTimeout(musicLoadingTimerRef.current);
            musicLoadingTimerRef.current = null;
        }
    }, []);

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
                clearMusicLoadingTimer();
                return;
            }

            if (currentSceneIdRef.current === sceneId && currentMusicUrl) {
                if (autoPlay && audioRef.current) {
                    try {
                        await audioRef.current.play();
                        setIsMusicPlaying(true);
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
            setIsMusicLoading(true);

            clearMusicLoadingTimer();
            musicLoadingTimerRef.current = setTimeout(() => {
                if (isLoadingMusicRef.current) {
                    setIsMusicLoading(false);
                    isLoadingMusicRef.current = false;
                }
                musicLoadingTimerRef.current = null;
            }, MUSIC_LOADING_TIMEOUT_MS);

            try {
                const response = await getGalgamePresetApi.getGalgameMusic(presetId, soundtrack);

                if (!response.data || !(response.data instanceof Blob)) {
                    isLoadingMusicRef.current = false;
                    currentSceneIdRef.current = null;
                    setIsMusicLoading(false);
                    clearMusicLoadingTimer();
                    if (!autoPlay) {
                        setIsMusicPlaying(false);
                    }
                    return;
                }

                const musicUrl = URL.createObjectURL(response.data);

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

                await new Promise<void>((resolve, reject) => {
                    const handleCanPlay = () => resolve();
                    const handleError = () => reject(new Error('音乐加载失败'));
                    audio.addEventListener('canplay', handleCanPlay, { once: true });
                    audio.addEventListener('error', handleError, { once: true });
                    audio.load();
                });

                clearMusicLoadingTimer();
                setIsMusicLoading(false);

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
                setIsMusicLoading(false);
                clearMusicLoadingTimer();
                audioRef.current = null;
            }
        },
        [presetId, currentScene, currentMusicUrl, volume, clearMusicLoadingTimer]
    );

    const handleMusicToggle = useCallback(async () => {
        if (!currentScene?.soundtrack) {
            setIsMusicPlaying(false);
            return;
        }
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
                    console.warn('播放音乐失败:', error);
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

    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = volume;
        }
    }, [volume]);

    useEffect(() => {
        if (!gameStarted) {
            hasResetMusicForCurrentGameRef.current = false;
            return;
        }

        if (hasResetMusicForCurrentGameRef.current || !currentScene?.id || !currentScene?.soundtrack) {
            return;
        }

        hasResetMusicForCurrentGameRef.current = true;
        currentSceneIdRef.current = null;
        isLoadingMusicRef.current = false;
        setIsMusicPlaying(true);
    }, [gameStarted, currentScene?.id, currentScene?.soundtrack]);

    useEffect(() => {
        if (!isLoading && currentScene?.id) {
            if (!currentScene?.soundtrack) {
                if (audioRef.current) {
                    audioRef.current.pause();
                    audioRef.current.src = '';
                }
                setCurrentMusicUrl(null);
                setIsMusicPlaying(false);
                isLoadingMusicRef.current = false;
                currentSceneIdRef.current = null;
                clearMusicLoadingTimer();
                return;
            }

            if (!gameStarted) {
                void loadAndPlaySceneMusic(currentScene, true);
            }
        }
    }, [isLoading, currentScene?.id, currentScene?.soundtrack, gameStarted, loadAndPlaySceneMusic, clearMusicLoadingTimer]);

    useEffect(() => {
        if (!gameStarted || !currentScene?.id) {
            return;
        }

        if (!currentScene?.soundtrack) {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.src = '';
            }
            setCurrentMusicUrl(null);
            setIsMusicPlaying(false);
            isLoadingMusicRef.current = false;
            currentSceneIdRef.current = null;
            clearMusicLoadingTimer();
            return;
        }

        void loadAndPlaySceneMusic(currentScene, true);
    }, [currentScene?.id, currentScene?.soundtrack, gameStarted, loadAndPlaySceneMusic, clearMusicLoadingTimer]);

    useEffect(() => {
        if (!audioRef.current || !currentMusicUrl) return;

        if (isMusicPlaying) {
            audioRef.current.play().catch(() => {
                // Ignore autoplay policy failures.
            });
        } else {
            audioRef.current.pause();
        }
    }, [isMusicPlaying, currentMusicUrl]);

    useEffect(() => {
        return () => {
            clearMusicLoadingTimer();
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.src = '';
            }
        };
    }, [clearMusicLoadingTimer]);

    const hasMusic = !!currentScene?.soundtrack;

    return {
        isMusicPlaying,
        handleMusicToggle,
        volume,
        setVolume: setVolumeLevel,
        hasMusic,
        isMusicLoading,
    };
};
