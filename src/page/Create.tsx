import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import styles from './Create.module.css';
import { useGameStore } from '../store/gameStore';
import { HOST_ADDRESS } from '../config';

const Create: React.FC = () => {
    const [activeTab, setActiveTab] = useState<string>('创作游戏');
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [coverImage, setCoverImage] = useState<string | null>(null);
    const [isDragover, setIsDragover] = useState(false);
    const [isDragoverCover, setIsDragoverCover] = useState(false);
    const [isUploadingPdf, setIsUploadingPdf] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadSuccess, setUploadSuccess] = useState(false);
    
    const [gameName, setGameName] = useState('');
    const [gameSubtitle, setGameSubtitle] = useState('');
    const [gameDescription, setGameDescription] = useState('');
    
    const { setPdfFileId, setSessionId } = useGameStore();
    const navigate = useNavigate();
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const coverInputRef = useRef<HTMLInputElement>(null);

    // 处理文件选择
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
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
        }
    };

    // 处理封面图片选择
    const handleCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
            if (!allowedTypes.includes(file.type)) {
                alert('请上传图片格式的文件！');
                return;
            }
            const reader = new FileReader();
            reader.onload = (e) => {
                setCoverImage(e.target?.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    // 格式化文件大小
    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    };

    // 移除文件
    const removeFile = () => {
        setUploadedFile(null);
        setPdfFileId(null);
        setUploadProgress(0);
        setUploadSuccess(false);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // 移除封面
    const removeCover = () => {
        setCoverImage(null);
        if (coverInputRef.current) {
            coverInputRef.current.value = '';
        }
    };

    // 上传文档
    const uploadDocument = async (file: File) => {
        setIsUploadingPdf(true);
        setUploadProgress(0);
        setUploadSuccess(false);
        setPdfFileId(null);

        const progressInterval = setInterval(() => {
            setUploadProgress(prev => {
                if (prev >= 96) return 96;
                return prev + 1.6;
            });
        }, 1000);

        const formData = new FormData();
        formData.append('pdf', file);

        try {
            const response = await fetch(`${HOST_ADDRESS}/api/backend/pdf/upload-and-process`, {
                method: 'POST',
                body: formData
            });

            clearInterval(progressInterval);

            if (response.ok) {
                const data = await response.json();
                setPdfFileId(data.fileId);
                setUploadProgress(100);
                setUploadSuccess(true);
            } else {
                const errorData = await response.json();
                const fileType = file.type === 'application/pdf' ? 'PDF' : 'DOCX';
                alert(`${fileType} 文件上传失败: ${errorData.message || response.statusText}`);
                removeFile();
            }
        } catch (error) {
            console.error('文档文件上传失败:', error);
            const fileType = file.type === 'application/pdf' ? 'PDF' : 'DOCX';
            alert(`${fileType} 文件上传时发生网络错误`);
            removeFile();
        } finally {
            setIsUploadingPdf(false);
        }
    };

    // 处理拖拽上传
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
        }
    };

    // 处理封面拖拽
    const handleCoverDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragoverCover(true);
    };

    const handleCoverDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragoverCover(false);
    };

    const handleCoverDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragoverCover(false);

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];
            const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
            if (!allowedTypes.includes(file.type)) {
                alert('请上传图片格式的文件！');
                return;
            }
            const reader = new FileReader();
            reader.onload = (e) => {
                setCoverImage(e.target?.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    // 验证必填字段
    const isFormValid = () => {
        return (
            gameName.trim() !== '' &&
            gameSubtitle.trim() !== '' &&
            gameDescription.trim() !== '' &&
            uploadedFile !== null &&
            uploadSuccess &&
            useGameStore.getState().pdfFileId !== null
        );
    };

    // 创建游戏
    const handleCreateGame = async () => {
        if (!gameName.trim()) {
            alert('请填写游戏名称');
            return;
        }
        if (!gameSubtitle.trim()) {
            alert('请填写游戏副标题');
            return;
        }
        if (!gameDescription.trim()) {
            alert('请填写游戏简介');
            return;
        }
        if (!uploadedFile) {
            alert('请上传游戏内容文档');
            return;
        }

        const pdfFileId = useGameStore.getState().pdfFileId;
        if (!pdfFileId) {
            alert('文档文件正在处理中，请稍后再试');
            return;
        }

        // 创建session
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
                setSessionId(data.sessionId || data.id);
                navigate('/newmain');
            } else {
                alert('创建游戏失败，请重试');
            }
        } catch (error) {
            console.error('创建游戏错误:', error);
            alert('创建游戏时发生错误');
        }
    };

    return (
        <div className={styles.pageRoot}>
            <Navbar />
            
            <div className={styles.mainContent}>
                {/* 左侧侧边栏 */}
                <div className={styles.sidebar}>
                    <div 
                        className={`${styles.sidebarItem} ${activeTab === '创作游戏' ? styles.sidebarItemActive : ''}`}
                        onClick={() => setActiveTab('创作游戏')}
                    >
                        <img src="data/asset/创作页面/文件图标.png" alt="" />
                        <span>创作游戏</span>
                    </div>
                    <div 
                        className={`${styles.sidebarItem} ${activeTab === '我的游戏' ? styles.sidebarItemActive : ''}`}
                        onClick={() => setActiveTab('我的游戏')}
                    >
                        <img src="data/asset/创作页面/文件夹图标.png" alt="" />
                        <span>我的游戏</span>
                    </div>
                </div>

                {/* 右侧内容区域 */}
                <div className={styles.main}>
                    {activeTab === '创作游戏' && (
                        <div className={styles.createGameContainer}>
                            {/* 左侧60% - 表单 */}
                            <div className={styles.formSection}>                                
                                <div className={styles.formGroup}>
                                    <label htmlFor="gameName">游戏名称</label>
                                    <input
                                        type="text"
                                        id="gameName"
                                        value={gameName}
                                        onChange={(e) => setGameName(e.target.value)}
                                        placeholder="输入游戏名称"
                                        required
                                        autoComplete="off"
                                    />
                                </div>

                                <div className={styles.formGroup}>
                                    <label htmlFor="gameSubtitle">游戏副标题</label>
                                    <input
                                        type="text"
                                        id="gameSubtitle"
                                        value={gameSubtitle}
                                        onChange={(e) => setGameSubtitle(e.target.value)}
                                        placeholder="例如：经典奇幻冒险RPG"
                                        required
                                        autoComplete="off"
                                    />
                                </div>

                                <div className={styles.formGroup}>
                                    <label htmlFor="gameDescription">游戏简介</label>
                                    <textarea
                                        id="gameDescription"
                                        value={gameDescription}
                                        onChange={(e) => setGameDescription(e.target.value)}
                                        rows={4}
                                        placeholder="简单介绍你的游戏世界..."
                                        required
                                        autoComplete="off"
                                    />
                                </div>


                                <div className={`${styles.formGroup} ${styles.requiredField}`}>
                                    <label htmlFor="gamePDF">游戏内容文档 (PDF/DOCX)</label>
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
                                            accept=".pdf,.docx"
                                            hidden
                                            onChange={handleFileSelect}
                                            autoComplete="off"
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
                                                {isUploadingPdf && (
                                                    <div className={styles.progressContainer}>
                                                        <div className={styles.progressBar}>
                                                            <div
                                                                className={`${styles.progressFill} ${uploadSuccess ? styles.progressSuccess : ''}`}
                                                                style={{ width: `${uploadProgress}%` }}
                                                            />
                                                        </div>
                                                        <div className={styles.progressText}>
                                                            {uploadSuccess ? '✅ 上传完成' : `⏳ 上传中... ${Math.round(uploadProgress)}%`}
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* 右侧40% - 封面展示 */}
                            <div className={styles.coverSection}>
                                <h3 className={styles.coverTitle}>封面预览</h3>
                                <div 
                                    className={`${styles.coverPreview} ${isDragoverCover ? styles.coverPreviewDragover : ''}`}
                                    onDragOver={handleCoverDragOver}
                                    onDragLeave={handleCoverDragLeave}
                                    onDrop={handleCoverDrop}
                                    onClick={() => coverInputRef.current?.click()}
                                >
                                    {coverImage ? (
                                        <>
                                            <img src={coverImage} alt="封面预览" />
                                            <button 
                                                className={styles.removeCoverBtn}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    removeCover();
                                                }}
                                            >
                                                ×
                                            </button>
                                        </>
                                    ) : (
                                        <div className={styles.coverPlaceholder}>
                                            <span className={styles.coverIcon}>🖼️</span>
                                            <p>点击或拖拽图片到此处</p>
                                            <p className={styles.coverHint}>支持 JPG、PNG 格式</p>
                                        </div>
                                    )}
                                    <input
                                        ref={coverInputRef}
                                        type="file"
                                        accept="image/jpeg,image/png,image/jpg"
                                        hidden
                                        onChange={handleCoverSelect}
                                        autoComplete="off"
                                    />
                                </div>
                                
                                <div className={styles.coverActions}>
                                    <button 
                                        className={styles.uploadCoverBtn}
                                        onClick={() => coverInputRef.current?.click()}
                                    >
                                    </button>
                                    <button 
                                        className={styles.createGameBtn}
                                        onClick={handleCreateGame}
                                        disabled={isUploadingPdf || !isFormValid()}
                                    >
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {activeTab === '我的游戏' && (
                        <div className={styles.myGamesContainer}>
                            <h2>我的游戏</h2>
                            <p>我的游戏内容待开发...</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Create;
