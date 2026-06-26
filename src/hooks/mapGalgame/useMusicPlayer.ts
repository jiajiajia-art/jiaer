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
    const hasResetMusicForCurrentGameRef = useRef<boolean>(false);

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
                audioRef.current = null;
            }
        },
        [presetId, currentScene, currentMusicUrl, volume]
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
        if (!isLoading && currentScene?.id && currentScene?.soundtrack && !gameStarted) {
            loadAndPlaySceneMusic(currentScene, true);
        }
    }, [isLoading, currentScene?.id, currentScene?.soundtrack, gameStarted, loadAndPlaySceneMusic]);

    useEffect(() => {
        if (!gameStarted || !currentScene?.id || !currentScene?.soundtrack) {
            return;
        }

        loadAndPlaySceneMusic(currentScene, true);
    }, [currentScene?.id, currentScene?.soundtrack, gameStarted, loadAndPlaySceneMusic]);

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
