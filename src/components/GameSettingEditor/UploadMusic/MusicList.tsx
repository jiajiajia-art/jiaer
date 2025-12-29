import React, { useState, useRef, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import styles from './MusicList.module.css';
import type { SceneApiHelpers } from '../ScenesPanel/apiHelpers';
import { IoPauseCircleOutline, IoPlaySkipForwardCircleOutline } from 'react-icons/io5';
import { MdDeleteOutline } from 'react-icons/md';
import DeletModal from '../../goodsModal/DeletModal';

export interface MusicItem {
    id: string;
    name: string;
    description: string;
    filename: string;
    musicPath?: string;
}

interface MusicListProps {
    musicList: MusicItem[];
    onUploadClick: () => void;
    fileId?: string | null;
    mode?: string;
    sceneApi?: SceneApiHelpers;
    onMusicDeleted?: () => void; // 删除成功后的回调，用于刷新列表
}

const MusicList: React.FC<MusicListProps> = ({ musicList, onUploadClick, fileId, mode, sceneApi, onMusicDeleted }) => {
    const [playingId, setPlayingId] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [deleteModalOpen, setDeleteModalOpen] = useState<boolean>(false);
    const [musicToDelete, setMusicToDelete] = useState<MusicItem | null>(null);
    const audioRefs = useRef<{ [key: string]: HTMLAudioElement | null }>({});
    const [musicUrls, setMusicUrls] = useState<{ [key: string]: string }>({});
    const [loadingMusic, setLoadingMusic] = useState<{ [key: string]: boolean }>({});
    const [progress, setProgress] = useState<{ [key: string]: number }>({});
    const [duration, setDuration] = useState<{ [key: string]: number }>({});
    const [currentTime, setCurrentTime] = useState<{ [key: string]: number }>({});
    const [isDraggingProgress, setIsDraggingProgress] = useState<{ [key: string]: boolean }>({});

    // 当切换播放时，停止其他音频（但不清空进度，保持当前播放位置）
    useEffect(() => {
        Object.keys(audioRefs.current).forEach((id) => {
            if (id !== playingId && audioRefs.current[id]) {
                audioRefs.current[id]?.pause();
                // 不清空进度，保持当前播放位置
            }
        });
    }, [playingId]);

    // 清理 Object URL
    useEffect(() => {
        return () => {
            Object.values(musicUrls).forEach(url => {
                if (url.startsWith('blob:')) {
                    URL.revokeObjectURL(url);
                }
            });
        };
    }, [musicUrls]);

    // 从 filename 中提取真正的文件名（去除路径）
    const extractFilename = (filename: string): string => {
        // 如果包含路径分隔符，提取最后一部分
        if (filename.includes('/') || filename.includes('\\')) {
            return filename.split(/[/\\]/).pop() || filename;
        }
        return filename;
    };

    // 获取音乐 URL（通过 API 或直接 URL）
    const getMusicUrl = async (music: MusicItem): Promise<string> => {
        // 如果已有缓存的 URL，直接返回
        if (musicUrls[music.id]) {
            return musicUrls[music.id];
        }

        // 如果有 musicPath，缓存并直接使用
        if (music.musicPath) {
            setMusicUrls(prev => ({ ...prev, [music.id]: music.musicPath! }));
            return music.musicPath;
        }

        const actualFilename = extractFilename(music.filename);

        if (fileId && sceneApi && mode) {
            try {
                setLoadingMusic(prev => ({ ...prev, [music.id]: true }));
                // 使用提取后的文件名调用 API（对 visual 和 worldInteraction 模式都适用）
                const response = await sceneApi.getMusic(fileId, actualFilename);
                
                if (response.data instanceof Blob) {
                    const blobUrl = URL.createObjectURL(response.data);
                    setMusicUrls(prev => ({ ...prev, [music.id]: blobUrl }));
                    setLoadingMusic(prev => ({ ...prev, [music.id]: false }));
                    return blobUrl;
                }
            } catch (error) {
                console.error('获取音频文件失败:', error);
                setLoadingMusic(prev => ({ ...prev, [music.id]: false }));
            }
        }

        // 降级方案：使用直接 URL（支持两种模式）
        if (fileId) {
            let fallbackUrl = '';
            if (mode === 'worldInteraction') {
                fallbackUrl = `/world-interaction/${fileId}/music/${encodeURIComponent(actualFilename)}`;
            } else if (mode === 'visual') {
                fallbackUrl = `/visual/${fileId}/music/${encodeURIComponent(actualFilename)}`;
            }
            
            if (fallbackUrl) {
                setMusicUrls(prev => ({ ...prev, [music.id]: fallbackUrl }));
                return fallbackUrl;
            }
        }

        return '';
    };

    const handlePlayPause = async (music: MusicItem) => {
        const audio = audioRefs.current[music.id];
        if (!audio) return;

        if (playingId === music.id) {
            // 当前正在播放，暂停
            audio.pause();
            setPlayingId(null);
        } else {
            // 确保音频 URL 已加载
            let urlToUse = musicUrls[music.id];
            
            if (!urlToUse) {
                urlToUse = await getMusicUrl(music);
                if (!urlToUse) {
                    console.error('无法获取音频 URL');
                    return;
                }
            }

            // 如果 URL 发生变化，需要重新加载
            if (audio.src !== urlToUse && audio.currentSrc !== urlToUse) {
                console.log('设置音频 URL:', urlToUse);
                audio.src = urlToUse;
                // 等待音频加载完成
                try {
                    await new Promise<void>((resolve, reject) => {
                        const timeout = setTimeout(() => {
                            audio.removeEventListener('canplay', onCanPlay);
                            audio.removeEventListener('error', onError);
                            reject(new Error('音频加载超时'));
                        }, 10000); // 10秒超时

                        const onCanPlay = () => {
                            clearTimeout(timeout);
                            audio.removeEventListener('canplay', onCanPlay);
                            audio.removeEventListener('error', onError);
                            console.log('音频加载完成，可以播放');
                            resolve();
                        };
                        const onError = () => {
                            clearTimeout(timeout);
                            audio.removeEventListener('canplay', onCanPlay);
                            audio.removeEventListener('error', onError);
                            reject(new Error('音频加载失败'));
                        };
                        audio.addEventListener('canplay', onCanPlay);
                        audio.addEventListener('error', onError);
                        if (audio.readyState >= 2) {
                            clearTimeout(timeout);
                            audio.removeEventListener('canplay', onCanPlay);
                            audio.removeEventListener('error', onError);
                            resolve();
                        } else {
                            console.log('开始加载音频，readyState:', audio.readyState);
                            audio.load();
                        }
                    });
                } catch (error) {
                    console.error('等待音频加载失败:', error);
                    return;
                }
            }

            // 播放新的音乐
            try {
                await audio.play();
                console.log('音频播放成功');
                setPlayingId(music.id);
            } catch (error) {
                console.error('播放音频失败:', error);
                setPlayingId(null);
            }
        }
    };

    const handleEnded = () => {
        setPlayingId(null);
    };

    // 处理卡片点击展开/收起
    const handleCardClick = (musicId: string, e: React.MouseEvent) => {
        // 如果点击的是播放控件区域，不触发展开/收起
        const target = e.target as HTMLElement;
        if (target.closest(`.${styles.musicControls}`)) {
            return;
        }
        
        if (expandedId === musicId) {
            setExpandedId(null);
        } else {
            setExpandedId(musicId);
        }
    };

    // 处理进度条拖拽
    const handleProgressMouseDown = useCallback((e: React.MouseEvent, musicId: string) => {
        e.stopPropagation();
        const audio = audioRefs.current[musicId];
        if (!audio || !audio.duration) return;

        setIsDraggingProgress(prev => ({ ...prev, [musicId]: true }));
        
        const progressContainer = e.currentTarget as HTMLElement;
        const progressBar = progressContainer.querySelector(`.${styles.progressBar}`) as HTMLElement;
        if (!progressBar) return;
        
        const rect = progressBar.getBoundingClientRect();
        const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        
        audio.currentTime = percent * audio.duration;
        setCurrentTime(prev => ({ ...prev, [musicId]: audio.currentTime }));
        setProgress(prev => ({ ...prev, [musicId]: percent * 100 }));
    }, []);

    // 监听进度条拖拽
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            Object.keys(isDraggingProgress).forEach(musicId => {
                if (!isDraggingProgress[musicId]) return;
                
                const audio = audioRefs.current[musicId];
                if (!audio || !audio.duration) return;

                const progressBar = document.querySelector(`[data-music-id="${musicId}"] .${styles.progressBar}`) as HTMLElement;
                if (!progressBar) return;

                const rect = progressBar.getBoundingClientRect();
                const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                
                audio.currentTime = percent * audio.duration;
                setCurrentTime(prev => ({ ...prev, [musicId]: audio.currentTime }));
                setProgress(prev => ({ ...prev, [musicId]: percent * 100 }));
            });
        };

        const handleMouseUp = () => {
            setIsDraggingProgress({});
        };

        const hasDragging = Object.values(isDraggingProgress).some(v => v);
        if (hasDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDraggingProgress]);

    // 重听功能
    const handleRestart = (musicId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const audio = audioRefs.current[musicId];
        if (audio) {
            audio.currentTime = 0;
            setCurrentTime(prev => ({ ...prev, [musicId]: 0 }));
            setProgress(prev => ({ ...prev, [musicId]: 0 }));
            if (playingId === musicId) {
                audio.play();
            }
        }
    };

    // 处理删除按钮点击
    const handleDeleteClick = (music: MusicItem, e: React.MouseEvent) => {
        e.stopPropagation();
        setMusicToDelete(music);
        setDeleteModalOpen(true);
    };

    // 确认删除
    const handleConfirmDelete = async () => {
        if (!musicToDelete || !fileId || !sceneApi) {
            setDeleteModalOpen(false);
            setMusicToDelete(null);
            return;
        }

        try {
            // 如果正在播放要删除的音乐，先停止
            if (playingId === musicToDelete.id) {
                const audio = audioRefs.current[musicToDelete.id];
                if (audio) {
                    audio.pause();
                    setPlayingId(null);
                }
            }

            // 提取文件名用于删除
            const actualFilename = extractFilename(musicToDelete.filename);
            await sceneApi.deleteMusic(fileId, actualFilename);
            
            toast.success('音乐删除成功');
            
            // 清理相关状态
            if (musicUrls[musicToDelete.id]?.startsWith('blob:')) {
                URL.revokeObjectURL(musicUrls[musicToDelete.id]);
            }
            setMusicUrls(prev => {
                const newUrls = { ...prev };
                delete newUrls[musicToDelete.id];
                return newUrls;
            });
            
            // 通知父组件刷新列表
            if (onMusicDeleted) {
                onMusicDeleted();
            }
            
            setDeleteModalOpen(false);
            setMusicToDelete(null);
        } catch (error) {
            console.error('删除音乐失败:', error);
            toast.error('删除音乐失败，请稍后重试');
        }
    };

    // 取消删除
    const handleCancelDelete = () => {
        setDeleteModalOpen(false);
        setMusicToDelete(null);
    };

    // 格式化时间
    const formatTime = (seconds: number): string => {
        if (isNaN(seconds) || !isFinite(seconds)) return '--:--';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // 监听音频进度（拖拽时不更新，避免冲突）
    useEffect(() => {
        const updateProgress = () => {
            Object.keys(audioRefs.current).forEach((id) => {
                // 如果正在拖拽该音频的进度条，不更新进度
                if (isDraggingProgress[id]) return;
                
                const audio = audioRefs.current[id];
                if (audio) {
                    if (audio.duration) {
                        setDuration(prev => ({ ...prev, [id]: audio.duration }));
                    }
                    setCurrentTime(prev => ({ ...prev, [id]: audio.currentTime }));
                    if (audio.duration) {
                        setProgress(prev => ({ ...prev, [id]: (audio.currentTime / audio.duration) * 100 }));
                    }
                }
            });
        };

        const interval = setInterval(updateProgress, 100);

        return () => clearInterval(interval);
    }, [playingId, isDraggingProgress]);

    // 监听音频元数据加载
    useEffect(() => {
        const handlers: { [key: string]: () => void } = {};

        Object.keys(audioRefs.current).forEach((id) => {
            const audio = audioRefs.current[id];
            if (audio) {
                const handler = () => {
                    if (audio.duration) {
                        setDuration(prev => ({ ...prev, [id]: audio.duration }));
                    }
                };
                handlers[id] = handler;
                audio.addEventListener('loadedmetadata', handler);
            }
        });

        return () => {
            Object.keys(audioRefs.current).forEach((id) => {
                const audio = audioRefs.current[id];
                if (audio && handlers[id]) {
                    audio.removeEventListener('loadedmetadata', handlers[id]);
                }
            });
        };
    }, [musicList]);

    return (
        <div className={styles.musicListContainer}>
            <div className={styles.musicListHeader}>
                <h4>BGM 音乐库</h4>
                <button className={styles.ghostSmall} onClick={onUploadClick}>
                    + 上传音乐
                </button>
            </div>
            {musicList.length === 0 ? (
                <div className={styles.emptyState}>
                    <div className={styles.emptyIcon}>🎵</div>
                    <p className={styles.emptyTitle}>暂无音乐</p>
                    <p className={styles.emptyDescription}>点击"上传音乐"添加 BGM 文件</p>
                </div>
            ) : (
                <div className={styles.musicList}>
                    {musicList.map((music) => {
                        const isPlaying = playingId === music.id;
                        const isLoading = loadingMusic[music.id] || false;
                        const musicUrl = musicUrls[music.id] || music.musicPath || null;

                        const musicProgress = progress[music.id] || 0;
                        const musicDuration = duration[music.id] || 0;
                        const musicCurrentTime = currentTime[music.id] || 0;

                        const isExpanded = expandedId === music.id;

                        return (
                            <div 
                                key={music.id} 
                                className={`${styles.musicItem} ${isExpanded ? styles.musicItemExpanded : ''}`}
                                onClick={(e) => handleCardClick(music.id, e)}
                                data-music-id={music.id}
                            >
                                <audio
                                    ref={(el) => {
                                        audioRefs.current[music.id] = el;
                                    }}
                                    src={musicUrl || undefined}
                                    onEnded={handleEnded}
                                    preload="none"
                                />
                                <div className={styles.musicInfo}>
                                    <div className={styles.musicInfoContent}>
                                        <strong className={styles.musicName}>{music.name}</strong>
                                        <p className={styles.musicDescription}>{music.description}</p>
                                    </div>
                                    <button
                                        className={styles.deleteButton}
                                        onClick={(e) => handleDeleteClick(music, e)}
                                        aria-label="删除音乐"
                                        title="删除音乐"
                                    >
                                        <MdDeleteOutline size={18} />
                                    </button>
                                </div>
                                {/* 只有展开时才显示播放控件 */}
                                {isExpanded && (
                                    <div className={styles.musicControls}>
                                        <button
                                            className={styles.playButton}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handlePlayPause(music);
                                            }}
                                            aria-label={isPlaying ? '暂停' : '播放'}
                                            disabled={isLoading}
                                        >
                                            {isPlaying ? (
                                                <IoPauseCircleOutline size={24} color='#E03D4B'/>
                                            ) : (
                                                <IoPlaySkipForwardCircleOutline size={24} color='#E03D4B'/>
                                            )}
                                        </button>
                                        <div 
                                            className={styles.progressContainer}
                                            onMouseDown={(e) => handleProgressMouseDown(e, music.id)}
                                        >
                                            <div className={styles.progressBar}>
                                                <div
                                                    className={`${styles.progressFill} ${isPlaying ? styles.progressActive : ''}`}
                                                    style={{ width: `${musicProgress}%` }}
                                                />
                                                <div 
                                                    className={styles.progressThumb}
                                                    style={{ left: `${musicProgress}%` }}
                                                />
                                            </div>
                                        </div>
                                        <span className={styles.musicDuration}>
                                            {musicCurrentTime > 0 || musicDuration > 0
                                                ? `${formatTime(musicCurrentTime)} / ${formatTime(musicDuration)}`
                                                : '--:-- / --:--'}
                                        </span>
                                        <button
                                            className={styles.restartButton}
                                            onClick={(e) => handleRestart(music.id, e)}
                                            aria-label="重听"
                                            title="重听"
                                        >
                                            ↻
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* 删除确认弹窗 */}
            <DeletModal
                isOpen={deleteModalOpen}
                onDelete={handleConfirmDelete}
                onCancel={handleCancelDelete}
                title="删除音乐"
                message={`确定要删除音乐"${musicToDelete?.name || ''}"吗？删除后不可恢复。`}
                confirmButtonText="确认删除"
                cancelButtonText="取消"
            />
        </div>
    );
};

export default MusicList;

