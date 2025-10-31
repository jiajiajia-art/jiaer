import React, { useState, useEffect, useRef } from "react";
import styles from './Home.module.css';
import { useGameStore } from '../store/gameStore';
import { useNavigate } from 'react-router-dom';
import { HOST_ADDRESS } from '../config';
// import { Link } from "react-router-dom"; // 不再需要


const Home: React.FC = () => {
    // 状态管理
    const [showGameModal, setShowGameModal] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [selectedIcon, setSelectedIcon] = useState<string>('');
    const [isDragover, setIsDragover] = useState(false);
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
        {
            id:'c2f99389e5fd5f43b42a0a45cfcfeed2',
            img:`${HOST_ADDRESS}/api/backend/saves/c2f99389e5fd5f43b42a0a45cfcfeed2/scenes/school_campus_c2f99389e5fd5f43b42a0a45cfcfeed2.png`
        }
    ];

    // 存储当前选中的游戏元数据
    const [selectedGameMeta, setSelectedGameMeta] = useState<any | null>(null);

    /**
     * 显示游戏详情（从后端数据）
     */
    const showGameDetail = (meta: any) => {
        setSelectedGameMeta(meta);
        setShowGameModal(true);
    };

    /**
     * 从详情弹窗创建游戏
     */
    const handleCreateGameFromDetail = async () => {
        if (!selectedGameMeta?.id) {
            alert('游戏信息错误，请重试');
            return;
        }
        setPdfFileId(selectedGameMeta.id);
        const sessionId = await createSession();
        setSessionId(sessionId);
        if (sessionId) {
            navigator('/newmain');
        } else {
            alert('创建游戏失败，请重试');
        }
    };

    /**
     * 关闭弹窗
     */
    const closeModal = () => {
        setShowGameModal(false);
        setSelectedGameMeta(null);
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
                                    showGameDetail(meta);
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
            {showGameModal && selectedGameMeta && (
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
                        {selectedGameMeta.img && (
                            <img
                                className={styles.detailCover}
                                src={selectedGameMeta.img}
                                alt="游戏封面"
                            />
                        )}
                        <div className={styles.detailContent}>
                            <div className={styles.detailHeader}>
                                <h2 className={styles.detailTitle}>
                                    <span>{selectedGameMeta.icon || '🎮'}</span>
                                    <span>{selectedGameMeta.lore?.worldBackground?.title || '未命名游戏'}</span>
                                </h2>
                                <p className={styles.detailSubtitle}>
                                    {selectedGameMeta.subtitle || ''}
                                </p>
                                {Array.isArray(selectedGameMeta.tags) && selectedGameMeta.tags.length > 0 && (
                                    <div className={styles.detailTags}>
                                        {selectedGameMeta.tags.map((tag: string, index: number) => (
                                            <span key={index} className={styles.detailTag}>{tag}</span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* 游戏简介 */}
                            {selectedGameMeta.lore?.worldBackground?.content && (
                                <div className={styles.detailSection}>
                                    <h3>📖 游戏简介</h3>
                                    {Array.isArray(selectedGameMeta.lore.worldBackground.content) ? (
                                        selectedGameMeta.lore.worldBackground.content.map((para: string, idx: number) => (
                                            <p key={idx}>{para}</p>
                                        ))
                                    ) : (
                                        <p>{selectedGameMeta.lore.worldBackground.content}</p>
                                    )}
                                </div>
                            )}

                            {/* 玩家故事 */}
                            {selectedGameMeta.lore?.playerStory && (
                                <div className={styles.detailSection}>
                                    <h3>👤 玩家故事</h3>
                                    <p><strong>{selectedGameMeta.lore.playerStory.title}</strong></p>
                                    {Array.isArray(selectedGameMeta.lore.playerStory.content) && (
                                        selectedGameMeta.lore.playerStory.content.map((para: string, idx: number) => (
                                            <p key={idx}>{para}</p>
                                        ))
                                    )}
                                </div>
                            )}

                            {/* 关键事件 */}
                            {Array.isArray(selectedGameMeta.lore?.keyEvents) && selectedGameMeta.lore.keyEvents.length > 0 && (
                                <div className={styles.detailSection}>
                                    <h3>⚡ 关键事件</h3>
                                    <div className={styles.detailFeatures}>
                                        {selectedGameMeta.lore.keyEvents.map((event: any, index: number) => (
                                            <div key={index} className={styles.featureItem}>
                                                <strong>{event.title} ({event.year})</strong>
                                                <span>{event.description}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* 游戏统计 */}
                            <div className={styles.detailSection}>
                                <h3>📊 游戏统计</h3>
                                <div className={styles.gameStats}>
                                    {(() => {
                                        const scenesCount = selectedGameMeta.scenes ? Object.keys(selectedGameMeta.scenes).length : 0;
                                        const itemsCount = selectedGameMeta.items ? Object.keys(selectedGameMeta.items).length : 0;
                                        const npcsCount = selectedGameMeta.scenes
                                            ? Object.values<any>(selectedGameMeta.scenes).reduce((sum: number, sc: any) => sum + (Array.isArray(sc.npcs) ? sc.npcs.length : 0), 0)
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

                            <div className={styles.actionButtons}>
                                <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={closeModal}>
                                    取消
                                </button>
                                <button
                                    className={`${styles.btn} ${styles.btnPrimary}`}
                                    onClick={handleCreateGameFromDetail}
                                >
                                    🚀 开始游戏
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Home;