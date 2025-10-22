import React, { useState, useEffect, useRef } from "react";
import styles from './Home.module.css';
import { Link } from "react-router-dom";

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

    // 使用ref来引用DOM元素
    const fileInputRef = useRef<HTMLInputElement>(null);

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
            if (file.type !== 'application/pdf') {
                alert('请上传PDF格式的文件！');
                return;
            }
            if (file.size > 10 * 1024 * 1024) {
                alert('文件大小不能超过10MB！');
                return;
            }
            setUploadedFile(file);
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
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
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
            if (file.type !== 'application/pdf') {
                alert('请上传PDF格式的文件！');
                return;
            }
            if (file.size > 10 * 1024 * 1024) {
                alert('文件大小不能超过10MB！');
                return;
            }
            setUploadedFile(file);
            // 手动设置file input
            if (fileInputRef.current) {
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(file);
                fileInputRef.current.files = dataTransfer.files;
            }
        }
    };

    /**
     * 处理表单提交
     */
    const handleCreateGameSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const form = e.target as HTMLFormElement;
        const formData = {
            name: (form.gameName as HTMLInputElement).value.trim(),
            subtitle: (form.gameSubtitle as HTMLInputElement).value.trim() || '新游戏',
            description: (form.gameDescription as HTMLTextAreaElement).value.trim(),
            icon: (form.gameIcon as HTMLInputElement).value.trim() || '🎮',
            pdfFile: uploadedFile
        };

        if (!formData.pdfFile) {
            alert('请上传游戏内容PDF文件！');
            return;
        }

        console.log('创建游戏数据:', {
            name: formData.name,
            subtitle: formData.subtitle,
            description: formData.description,
            icon: formData.icon,
            pdfFileName: formData.pdfFile.name,
            pdfSize: formatFileSize(formData.pdfFile.size)
        });

        alert(`游戏 "${formData.name}" 创建成功！\n\nPDF文件: ${formData.pdfFile.name}\n大小: ${formatFileSize(formData.pdfFile.size)}\n\n注意：由于浏览器安全限制，PDF文件仅在本地会话中可用。要永久保存，需要后端服务器支持。`);

        closeCreateModal();
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

    return (
        <div className={styles.bodyContainer}>
            <div className={styles.container}>
                {/* 页头 */}
                <div className={styles.header}>
                    <h1>🎮 游戏中心</h1>
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
                    {loading ? (
                        <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '50px', color: 'white' }}>
                            <h2 style={{ fontSize: '24px', marginBottom: '10px' }}>⏳ 加载中...</h2>
                            <p style={{ fontSize: '16px', opacity: 0.9 }}>正在加载游戏数据</p>
                        </div>
                    ) : games.length === 0 ? (
                        <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '50px', color: 'white' }}>
                            <h2 style={{ fontSize: '24px', marginBottom: '10px' }}>📂 暂无游戏</h2>
                            <p style={{ fontSize: '16px', opacity: 0.9 }}>没有找到游戏数据</p>
                        </div>
                    ) : (
                        games.map((game, index) => (
                            <div
                                key={index}
                                className={styles.gameCard}
                                onClick={() => showGameDetail(game)}
                            >
                                <img
                                    src={game.cover}
                                    alt={game.title}
                                    className={styles.gameCover}
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).src = 'data/icons/empty.png';
                                    }}
                                />
                                <div className={styles.gameInfo}>
                                    <div className={styles.gameTitle}>
                                        <span className={styles.gameIcon}>{game.icon}</span>
                                        <span>{game.title}</span>
                                    </div>
                                    <div className={styles.gameSubtitle}>{game.subtitle}</div>
                                    <div className={styles.gameTags}>
                                        {game.tags.map((tag, tagIndex) => (
                                            <span key={tagIndex} className={styles.tag}>{tag}</span>
                                        ))}
                                    </div>
                                    <div className={styles.gameDescription}>{game.description}</div>
                                    <div className={styles.gameStats}>
                                        <span className={styles.statItem}>📊 {game.stats.difficulty}</span>
                                        <span className={styles.statItem}>⏱️ {game.stats.playtime}</span>
                                        <span className={styles.statItem}>🎯 {game.stats.status}</span>
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
                                <label htmlFor="gamePDF">游戏内容文档 (PDF) *</label>
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
                                        accept=".pdf"
                                        required
                                        hidden
                                        onChange={handleFileSelect}
                                    />
                                    {!uploadedFile ? (
                                        <div className={styles.uploadPlaceholder}>
                                            <span className={styles.uploadIcon}>📄</span>
                                            <p className={styles.uploadText}>点击或拖拽PDF文件到此处</p>
                                            <p className={styles.uploadHint}>支持 PDF 格式，最大 10MB</p>
                                        </div>
                                    ) : (
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
                                <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>
                                    🚀 创建游戏
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
                                <Link
                                    to="/main"
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
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Home;