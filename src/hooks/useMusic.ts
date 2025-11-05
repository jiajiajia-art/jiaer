import { useState, useEffect, useRef, useCallback } from 'react';
import { HOST_ADDRESS } from '../config';
import { useGameStore } from '../store/gameStore';

interface MusicTrack {
    id: string;
    name: string;
    url: string;
}

export const useMusic = () => {
    const { pdfFileId, isPlaying, setIsPlaying, volume, setVolume } = useGameStore();
    
    // 音乐状态（本地状态）
    const [tracks, setTracks] = useState<MusicTrack[]>([]);
    const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(0);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    
    // 使用 ref 存储 Audio 对象，避免重复创建
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const tracksLoadedRef = useRef<boolean>(false);

    const loadMusicTracks = useCallback(async () => {
        if (tracksLoadedRef.current || !pdfFileId) return;
        
        setIsLoading(true);
        try {
            const response = await fetch(`${HOST_ADDRESS}/api/backend/music/${pdfFileId}`);
            if (!response.ok) return;
            
            const data = await response.json();
            if (!data.success || !Array.isArray(data.music)) return;
            
            const musicList: MusicTrack[] = data.music.map((track: any, index: number) => ({
                id: track.filename || `track_${index}`,
                name: track.title || track.filename || `音乐 ${index + 1}`,
                url: `${HOST_ADDRESS}${track.url}`
            }));
            
            if (musicList.length > 0) {
                setTracks(musicList);
                tracksLoadedRef.current = true;
            }
        } catch (error) {
            console.error('加载音乐失败:', error);
        } finally {
            setIsLoading(false);
        }
    }, [pdfFileId]);

    // 初始化音乐（首次加载）
    useEffect(() => {
        if (pdfFileId && !tracksLoadedRef.current) {
            loadMusicTracks();
        }
    }, [pdfFileId, loadMusicTracks]);

    useEffect(() => {
        if (tracks.length === 0) return;
        
        const currentTrack = tracks[currentTrackIndex];
        if (!currentTrack?.url) return;

        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.src = '';
        }

        // 创建新的 Audio 对象
        const audio = new Audio(currentTrack.url);
        audio.loop = false; // 不自动循环，手动处理以支持循环播放列表
        audio.volume = volume;
        
        // 播放结束事件：自动播放下一首（循环播放）
        const handleEnded = () => {
            const nextIndex = (currentTrackIndex + 1) % tracks.length;
            setCurrentTrackIndex(nextIndex);
        };
        
        // 错误处理
        const handleError = () => {
            setIsPlaying(false);
            if (tracks.length > 1) {
                const nextIndex = (currentTrackIndex + 1) % tracks.length;
                setTimeout(() => setCurrentTrackIndex(nextIndex), 1000);
            }
        };
        
        // 可以播放事件（音乐已加载）
        const handleCanPlay = () => {
            if (isPlaying) {
                audio.play().catch((error: any) => {
                    if (error.name !== 'NotAllowedError') {
                        setIsPlaying(false);
                    }
                });
            }
        };
        
        audio.addEventListener('ended', handleEnded);
        audio.addEventListener('error', handleError);
        audio.addEventListener('canplay', handleCanPlay);
        
        // 保存到 ref
        audioRef.current = audio;
        
        audio.load();
        
        if (isPlaying) {
            audio.play().catch(() => {
                // 播放失败时保持状态，等待 canplay 事件
            });
        }
        
        return () => {
            audio.removeEventListener('ended', handleEnded);
            audio.removeEventListener('error', handleError);
            audio.removeEventListener('canplay', handleCanPlay);
            audio.pause();
            audio.src = '';
        };
    }, [tracks, currentTrackIndex, isPlaying, volume, setIsPlaying]);

    // 播放
    const play = useCallback(() => {
        if (tracks.length === 0) return;
        setIsPlaying(true);
        audioRef.current?.play().catch(() => {
            // 播放失败时保持状态，等待 canplay 事件
        });
    }, [tracks.length, setIsPlaying]);

    // 暂停
    const pause = useCallback(() => {
        setIsPlaying(false);
        audioRef.current?.pause();
    }, [setIsPlaying]);

    // 播放/暂停切换
    const togglePlay = useCallback(() => {
        if (isPlaying) {
            pause();
        } else {
            play();
        }
    }, [isPlaying, play, pause]);

    // 播放指定音乐
    const playTrack = useCallback((index: number) => {
        if (index < 0 || index >= tracks.length) return;
        setCurrentTrackIndex(index);
        setIsPlaying(true);
    }, [tracks.length, setIsPlaying]);

    // 下一首
    const nextTrack = useCallback(() => {
        const nextIndex = (currentTrackIndex + 1) % tracks.length;
        setCurrentTrackIndex(nextIndex);
    }, [currentTrackIndex, tracks.length]);

    // 上一首
    const prevTrack = useCallback(() => {
        const prevIndex = (currentTrackIndex - 1 + tracks.length) % tracks.length;
        setCurrentTrackIndex(prevIndex);
    }, [currentTrackIndex, tracks.length]);

    // 设置音量
    const setVolumeLevel = useCallback((newVolume: number) => {
        const clampedVolume = Math.max(0, Math.min(1, newVolume));
        setVolume(clampedVolume);
        if (audioRef.current) {
            audioRef.current.volume = clampedVolume;
        }
    }, [setVolume]);

    // 停止播放
    const stop = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
        setIsPlaying(false);
    }, [setIsPlaying]);

    // 组件卸载时清理
    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.src = '';
            }
        };
    }, []);

    return {
        tracks,
        currentTrack: tracks[currentTrackIndex] || null,
        currentTrackIndex,
        isPlaying,
        isLoading,
        volume,
        play,              // 播放
        pause,             // 暂停
        togglePlay,       // 播放/暂停切换
        playTrack,        // 播放指定音乐
        nextTrack,        // 下一首
        prevTrack,        // 上一首
        stop,             // 停止播放
        setVolume: setVolumeLevel,
        loadMusicTracks
    };
};

