import React, { useState, useEffect, useRef } from "react";
import styles from './Home.module.css';
import { useGameStore } from '../store/gameStore';
import { useNavigate } from 'react-router-dom';
import { HOST_ADDRESS } from '../config';
// import { Link } from "react-router-dom"; // 不再需要

// 定义游戏数据接口
interface GameStats {
    difficulty: string;
    playtime: string;
    status: string;
}

interface GameFeature {
    title: string;
    desc: string;
}

interface Game {
    cover: string;
    icon: string;
    title: string;
    subtitle: string;
    tags: string[];
    description: string;
    fullDescription: string;
    features: GameFeature[];
    stats: GameStats;
}

const Home: React.FC = () => {
    // 状态管理
    const [games, setGames] = useState<Game[]>([]);
    const [selectedGame, setSelectedGame] = useState<Game | null>(null);
    const [showGameModal, setShowGameModal] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [selectedIcon, setSelectedIcon] = useState<string>('');
    const [isDragover, setIsDragover] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isUploadingPdf, setIsUploadingPdf] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadSuccess, setUploadSuccess] = useState(false);
    const [fileMetas, setFileMetas] = useState<any[]>([]);

    const { pdfFileId,setPdfFileId, setSessionId } = useGameStore();
    const navigator = useNavigate();

    // 使用ref来引用DOM元素
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 修复为有效的数组声明
    const fileId = [
        {
            id: '0fed0643f24e7c7b3b68e74af04cb0aa',
            img: `${HOST_ADDRESS}/api/backend/saves/0fed0643f24e7c7b3b68e74af04cb0aa/scenes/red_rock_territory_0fed0643f24e7c7b3b68e74af04cb0aa.png`
        },
        {
            id: '7b7e7d128c686dc57bd23996118e8c0a',
            img: `${HOST_ADDRESS}/api/backend/saves/7b7e7d128c686dc57bd23996118e8c0a/scenes/village_outskirts_7b7e7d128c686dc57bd23996118e8c0a.png`
        },
        {
            id:'83089b271543d3e2a7cb8b1a4cee3f41',
            img: `${HOST_ADDRESS}/api/backend/saves/83089b271543d3e2a7cb8b1a4cee3f41/avatars/npc_store_clerk_83089b271543d3e2a7cb8b1a4cee3f41.png`
        },
    ];

    /**
     * 加载游戏数据
     */
    const loadGamesData = async () => {
        try {
            setLoading(true);
            const response = await fetch('/StoryData/games.json');
            if (response.ok) {
                const gamesData = await response.json();
                setGames(gamesData);
                console.log('游戏数据加载成功:', gamesData.length + ' 个游戏');
            } else {
                console.error('无法加载游戏数据文件');
                showErrorMessage('无法加载游戏列表，请检查数据文件是否存在');
            }
        } catch (error) {
            console.error('加载游戏数据失败:', error);
            showErrorMessage('加载游戏数据时发生错误');
        } finally {
            setLoading(false);
        }
    };

    /**
     * 显示错误消息
     */
    const showErrorMessage = (message: string) => {
        // 在React中，我们可以通过状态来显示错误信息
        // 这里保持原有逻辑，但实际应该用状态管理
        const gameListContainer = document.getElementById('gameList');
        if (gameListContainer) {
            gameListContainer.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 50px; color: white;">
                    <h2 style="font-size: 24px; margin-bottom: 10px;">😔 加载失败</h2>
                    <p style="font-size: 16px; opacity: 0.9;">${message}</p>
                </div>
            `;
        }
    };

    /**
     * 显示游戏详情
     */
    const showGameDetail = (game: Game) => {
        setSelectedGame(game);
        setShowGameModal(true);
    };

    /**
     * 关闭弹窗
     */
    const closeModal = () => {
        setShowGameModal(false);
        setSelectedGame(null);
    };

    const closeCreateModal = () => {
        setShowCreateModal(false);
        setUploadedFile(null);
        setSelectedIcon('');
        setIsDragover(false);
        setPdfFileId(null);
        setUploadProgress(0);
        setUploadSuccess(false);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    /**
     * 处理文件选择
     */
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // 检查文件类型：支持PDF和DOCX
            const allowedTypes = [
                'application/pdf',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            ];

            if (!allowedTypes.includes(file.type)) {
                alert('请上传PDF或DOCX格式的文件！');
                return;
            }
            if (file.size > 10 * 1024 * 1024) {
                alert('文件大小不能超过10MB！');
                return;
            }
            console.log('file', file);
            setUploadedFile(file);
            uploadDocument(file);
        }
    };

    /**
     * 格式化文件大小
     */
    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    };

    /**
     * 移除文件
     */
    const removeFile = () => {
        setUploadedFile(null);
        setPdfFileId(null);
        setUploadProgress(0);
        setUploadSuccess(false);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    /**
     * 上传文档文件到后端（支持PDF和DOCX）
     */
    const uploadDocument = async (file: File) => {
        setIsUploadingPdf(true);
        setUploadProgress(0);
        setUploadSuccess(false);
        setPdfFileId(null); // 上传新文件时清除旧ID

        // 启动假进度条
        const progressInterval = setInterval(() => {
            setUploadProgress(prev => {
                if (prev >= 96) return 96; // 卡在96%
                return prev + 1.6; // 1分钟到96%，匀速增长
            });
        }, 1000); // 每秒更新一次

        const formData = new FormData();
        // 统一使用pdf字段名，后端可以处理PDF和DOCX
        formData.append('pdf', file);

        try {
            const response = await fetch(`${HOST_ADDRESS}/api/backend/pdf/upload-and-process`, {
                method: 'POST',
                body: formData
            });
            console.log('response', response);

            // 清除进度条定时器
            clearInterval(progressInterval);

            if (response.ok) {
                const data = await response.json();
                setPdfFileId(data.fileId); // 后端返回fileId
                setUploadProgress(100); // 直接跳到100%
                setUploadSuccess(true);
            } else {
                const errorData = await response.json();
                const fileType = file.type === 'application/pdf' ? 'PDF' : 'DOCX';
                alert(`${fileType} 文件上传失败: ${errorData.message || response.statusText}`);
                // 上传失败时清除文件
                removeFile();
            }
        } catch (error) {
            console.error('文档文件上传失败:', error);
            const fileType = file.type === 'application/pdf' ? 'PDF' : 'DOCX';
            alert(`${fileType} 文件上传时发生网络错误`);
            // 网络错误时也清除文件
            removeFile();
        } finally {
            setIsUploadingPdf(false);
        }
    };

    /**
     * 处理拖拽上传
     */
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragover(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragover(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragover(false);

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];
            // 检查文件类型：支持PDF和DOCX
            const allowedTypes = [
                'application/pdf',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            ];

            if (!allowedTypes.includes(file.type)) {
                alert('请上传PDF或DOCX格式的文件！');
                return;
            }
            if (file.size > 10 * 1024 * 1024) {
                alert('文件大小不能超过10MB！');
                return;
            }
            setUploadedFile(file);
            uploadDocument(file);
            // 移除手动设置file input，因为现在文件会直接上传
        }
    };

    /**
     * 处理表单提交
     */
    const handleCreateGameSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // 验证文件是否已选择
        if (!uploadedFile) {
            alert('请先选择文档文件');
            return;
        }

        // 验证文档文件ID是否存在
        const pdfFileId = useGameStore.getState().pdfFileId;
        if (!pdfFileId) {
            alert('文档文件正在处理中，请稍后再试');
            return;
        }

        navigator('/newmain');
    };

    // 图标选择处理
    const handleIconSelect = (icon: string) => {
        setSelectedIcon(icon);
        const iconInput = document.getElementById('gameIcon') as HTMLInputElement;
        if (iconInput) {
            iconInput.value = icon;
        }
    };

    // ESC键关闭弹窗
    useEffect(() => {
        const handleEscKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (showGameModal) setShowGameModal(false);
                if (showCreateModal) setShowCreateModal(false);
            }
        };

        document.addEventListener('keydown', handleEscKey);
        return () => {
            document.removeEventListener('keydown', handleEscKey);
        };
    }, [showGameModal, showCreateModal]);

    // 组件挂载时加载数据
    useEffect(() => {
        loadGamesData();
    }, []);

    // 首页加载每个 fileId 后端元信息
    useEffect(() => {
        Promise.all(
            fileId.map(async f => {
                try {
                    const res = await fetch(`${HOST_ADDRESS}/api/backend/saves/${f.id}/files`);
                    if (res.ok) {
                        console.log('f.img',f.img);
                        
                        const data = await res.json();
                        return { id: f.id,img: f.img, ...data.files };
                    }
                    console.log('f',f.img);
                    
                } catch { }
                return { id: f.id };
            })
        ).then(data => {
            console.log('fileMetas', data);
            setFileMetas(data);
        });
    }, []);

    const createSession = async (): Promise<string | null> => {
            if (!pdfFileId) {
            console.error('没有 pdfFileId，无法创建 session');
            return null;
        }

        try {
            const response = await fetch(`${HOST_ADDRESS}/api/backend/game/session/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fileId: pdfFileId,
                    playerName: '玩家'
                })
            });

            if (response.ok) {
                const data = await response.json();
                console.log('✅ Session 创建成功:', data);
                return data.sessionId || data.id;
            } else {
                console.error('❌ Session 创建失败:', response.statusText);
                return null;
            }
        } catch (error) {
            console.error('❌ Session 创建错误:', error);
            return null;
        }
    };

    const handleCreateGame = async () => {
        const sessionId = await createSession();
        setSessionId(sessionId);
        if (sessionId) {
            navigator('/newmain');
        } else {
            alert('创建游戏失败，请重试');
        }
    };

    return (
        <div className={styles.bodyContainer}>
            <div className={styles.container}>
                {/* 页头 */}
                <div className={styles.header}>
                    <h1 className={styles.headerTitle}>Funloom AI</h1>
                    <p>选择你喜欢的冒险世界，开始精彩的旅程</p>
                    <button
                        className={styles.createGameBtn}
                        onClick={() => setShowCreateModal(true)}
                    >
                        + 创建新游戏
                    </button>
                </div>

                {/* 游戏列表 */}
                <div className={styles.gameList} id="gameList">
                    {fileMetas.length === 0 ? (
                        <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '50px', color: 'white' }}>
                            <h2 style={{ fontSize: '24px', marginBottom: '10px' }}>⏳ 加载中...</h2>
                            <p style={{ fontSize: '16px', opacity: 0.9 }}>正在加载剧情文件信息</p>
                        </div>
                    ) : (
                        fileMetas.map((meta, idx) => (
                            <div
                                key={meta.id}
                                className={styles.gameCard}

                                onClick={() => {
                                    setPdfFileId(meta.id);
                                    handleCreateGame();
                                }}
                            >
                                
                                <img
                                    src={meta.img}
                                    alt={meta.title}
                                    className={styles.gameCover}
                                    
                                />
                                <div className={styles.gameInfo}>
                                    <div className={styles.gameTitle}>
                                        <span className={styles.gameIcon}>{meta.icon || ''}</span>
                                        <span>{meta.lore.worldBackground.title || `剧情${idx + 1}`}</span>
                                    </div>
                                    <div className={styles.gameSubtitle}>{meta.subtitle || ''}</div>
                                    <div className={styles.gameTags}>
                                        {Array.isArray(meta.tags) && meta.tags.map((tag: string, tagIndex: number) => (
                                            <span key={tagIndex} className={styles.tag}>{tag}</span>
                                        ))}
                                    </div>
                                    <div className={styles.gameDescription}>{meta.lore.worldBackground.content || ''}</div>
                                    <div className={styles.gameStats}>
                                    {(() => {
                                            const scenesCount = meta.scenes ? Object.keys(meta.scenes).length : 0;
                                            const itemsCount = meta.items ? Object.keys(meta.items).length : 0;
                                            const npcsCount = meta.scenes
                                                ? Object.values<any>(meta.scenes).reduce((sum, sc: any) => sum + (Array.isArray(sc.npcs) ? sc.npcs.length : 0), 0)
                                                : 0;
                                            return (
                                                <>
                                                    <span className={styles.statItem}>🗺️ 场景: {scenesCount}</span>
                                                    <span className={styles.statItem}>🎒 物品: {itemsCount}</span>
                                                    <span className={styles.statItem}>🧍 NPC: {npcsCount}</span>
                                                </>
                                            );
                                        })()}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* 创建游戏弹窗 */}
            {showCreateModal && (
                <div
                    className={`${styles.modal} ${styles.modalShow}`}
                    onClick={(e) => {
                        if (e.target === e.currentTarget) closeCreateModal();
                    }}
                >
                    <div className={`${styles.modalContent} ${styles.createGameModalContent}`}>
                        <button className={styles.modalClose} onClick={closeCreateModal}>
                            ×
                        </button>
                        <div className={styles.createGameHeader}>
                            <h2>✨ 创建新游戏</h2>
                            <p>填写游戏信息，开始创作你的故事</p>
                        </div>

                        <form className={styles.createGameForm} onSubmit={handleCreateGameSubmit}>
                            <div className={styles.formGroup}>
                                <label htmlFor="gameName">游戏名称 *</label>
                                <input
                                    type="text"
                                    id="gameName"
                                    name="gameName"
                                    placeholder="输入游戏名称"
                                    required
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label htmlFor="gameSubtitle">游戏副标题</label>
                                <input
                                    type="text"
                                    id="gameSubtitle"
                                    name="gameSubtitle"
                                    placeholder="例如：经典奇幻冒险RPG"
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label htmlFor="gameDescription">游戏简介 *</label>
                                <textarea
                                    id="gameDescription"
                                    name="gameDescription"
                                    rows={4}
                                    placeholder="简单介绍你的游戏世界..."
                                    required
                                ></textarea>
                            </div>

                            <div className={styles.formGroup}>
                                <label htmlFor="gameIcon">游戏图标</label>
                                <input
                                    type="text"
                                    id="gameIcon"
                                    name="gameIcon"
                                    placeholder="选择一个emoji表情，如：🎮"
                                    maxLength={2}
                                />
                                <div className={styles.iconSuggestions}>
                                    {['⚔️', '🏰', '🗡️', '🎮', '🌟', '🔮', '🐉', '🎭'].map((icon) => (
                                        <span
                                            key={icon}
                                            className={`${styles.iconBtn} ${selectedIcon === icon ? styles.iconBtnSelected : ''}`}
                                            onClick={() => handleIconSelect(icon)}
                                        >
                                            {icon}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <div className={styles.formGroup}>
                                <label htmlFor="gamePDF">游戏内容文档 (PDF/DOCX) *</label>
                                <div
                                    className={`${styles.fileUploadArea} ${isDragover ? styles.fileUploadAreaDragover : ''}`}
                                    onClick={() => fileInputRef.current?.click()}
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                >
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        id="gamePDF"
                                        name="gamePDF"
                                        accept=".pdf,.docx"
                                        hidden
                                        onChange={handleFileSelect}
                                    />
                                    {!uploadedFile ? (
                                        <div className={styles.uploadPlaceholder}>
                                            <span className={styles.uploadIcon}>📄</span>
                                            <p className={styles.uploadText}>点击或拖拽文档文件到此处</p>
                                            <p className={styles.uploadHint}>支持 PDF 和 DOCX 格式，最大 10MB</p>
                                        </div>
                                    ) : (
                                        <>
                                            <div className={styles.uploadInfo}>
                                                <span className={styles.fileIcon}>📄</span>
                                                <span className={styles.fileName}>{uploadedFile.name}</span>
                                                <span className={styles.fileSize}>{formatFileSize(uploadedFile.size)}</span>
                                                <button
                                                    type="button"
                                                    className={styles.removeFileBtn}
                                                    onClick={removeFile}
                                                >
                                                    ×
                                                </button>

                                            </div>
                                            {/* {isUploadingPdf && ( */}
                                            <div className={styles.progressContainer}>
                                                {
                                                    isUploadingPdf &&
                                                    <div className={styles.progressBar}>
                                                        <div
                                                            className={`${styles.progressFill} ${uploadSuccess ? styles.progressSuccess : ''}`}
                                                            style={{ width: `${uploadProgress}%` }}
                                                        ></div>
                                                    </div>
                                                }
                                                <div className={styles.progressText}>
                                                    {uploadSuccess ? '✅ 上传完成' : `⏳ 上传中... ${Math.round(uploadProgress)}%`}
                                                </div>
                                            </div>
                                            {/* )} */}
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className={styles.formActions}>
                                <button
                                    type="button"
                                    className={`${styles.btn} ${styles.btnSecondary}`}
                                    onClick={closeCreateModal}
                                >
                                    取消
                                </button>
                                <button
                                    type="submit"
                                    className={`${styles.btn} ${styles.btnPrimary}`}
                                    disabled={isUploadingPdf}
                                    onClick={handleCreateGame}
                                >
                                    {isUploadingPdf ? '⏳ 正在上传...' : '🚀 创建游戏'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* 游戏详情弹窗 */}
            {showGameModal && selectedGame && (
                <div
                    className={`${styles.modal} ${styles.modalShow}`}
                    onClick={(e) => {
                        if (e.target === e.currentTarget) closeModal();
                    }}
                >
                    <div className={styles.modalContent}>
                        <button className={styles.modalClose} onClick={closeModal}>
                            ×
                        </button>
                        <img
                            className={styles.detailCover}
                            src={selectedGame.cover}
                            alt="游戏封面"
                        />
                        <div className={styles.detailContent}>
                            <div className={styles.detailHeader}>
                                <h2 className={styles.detailTitle}>
                                    <span>{selectedGame.icon}</span>
                                    <span>{selectedGame.title}</span>
                                </h2>
                                <p className={styles.detailSubtitle}>
                                    {selectedGame.subtitle}
                                </p>
                                <div className={styles.detailTags}>
                                    {selectedGame.tags.map((tag, index) => (
                                        <span key={index} className={styles.detailTag}>{tag}</span>
                                    ))}
                                </div>
                            </div>

                            <div className={styles.detailSection}>
                                <h3>📖 游戏简介</h3>
                                <p>{selectedGame.fullDescription}</p>
                            </div>

                            <div className={styles.detailSection}>
                                <h3>✨ 游戏特色</h3>
                                <div className={styles.detailFeatures}>
                                    {selectedGame.features.map((feature, index) => (
                                        <div key={index} className={styles.featureItem}>
                                            <strong>{feature.title}</strong>
                                            <span>{feature.desc}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className={styles.actionButtons}>
                                <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={closeModal}>
                                    取消
                                </button>
                                <a
                                    href="/createCharacter"
                                    className={`${styles.btn} ${styles.btnPrimary} ${['开发中', '即将推出'].includes(selectedGame.stats.status) ? styles.disabled : ''
                                        }`}
                                    style={{
                                        pointerEvents: ['开发中', '即将推出'].includes(selectedGame.stats.status) ? 'none' : 'auto',
                                        textDecoration: 'none',
                                        display: 'inline-block'
                                    }}
                                >
                                    {['开发中', '即将推出'].includes(selectedGame.stats.status)
                                        ? `⏳ ${selectedGame.stats.status}，敬请期待`
                                        : '🚀 开始游戏'
                                    }
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Home;