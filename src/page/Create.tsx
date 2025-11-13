import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Sidebar, { type SidebarItem } from '../components/Sidebar';
import styles from './Create.module.css';
import { useGameStore } from '../store/gameStore';
import createGameApi from '../api/createGame/createGameApi.type';
import createSessionApi from '../api/createGame/createSessionApi';
import { useAuthStore } from '../store/useAuthStore';
import MobileTopNav from '../components/Mobile/MobileTopNav';
import MobileBottomNav from '../components/Mobile/MobileBottomNav';

const Create: React.FC = () => {
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [coverFile, setCoverFile] = useState<File | null>(null);
    const [coverImage, setCoverImage] = useState<string | null>(null);
    const [isDragover, setIsDragover] = useState(false);
    const [isDragoverCover, setIsDragoverCover] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [createProgress, setCreateProgress] = useState(0);
    const [createProgressText, setCreateProgressText] = useState('');
    const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const startTimeRef = useRef<number | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const MAX_TIME = 5 * 60 * 1000; // 5分钟（毫秒）
    const MAX_PROGRESS = 90; // 最大进度90%
    
    const [gameName, setGameName] = useState('');
    const [gameSubtitle, setGameSubtitle] = useState('');
    const [gameDescription, setGameDescription] = useState('');
    const [noImageMode, setNoImageMode] = useState(false); // 无图模式
    
    const { setPdfFileId, setSessionId } = useGameStore();
    const { user } = useAuthStore();
    const navigate = useNavigate();
    const sidebarItems = useMemo<SidebarItem[]>(() => [
        {
            id: 'create',
            label: '创作游戏',
            icon: 'data/asset/创作页面/文件图标.png',
            route: '/create',
        },
        {
            id: 'myGames',
            label: '我的游戏',
            icon: 'data/asset/创作页面/文件夹图标.png',
            route: '/create/myGames',
        }
    ], []);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const coverInputRef = useRef<HTMLInputElement>(null);

    // 清理进度条定时器
    useEffect(() => {
        return () => {
            if (progressTimerRef.current) {
                clearInterval(progressTimerRef.current);
            }
        };
    }, []);

    // 启动假进度条（5分钟倒计时）
    const startFakeProgress = () => {
        // 清理之前的定时器
        if (progressTimerRef.current) {
            clearInterval(progressTimerRef.current);
        }

        startTimeRef.current = Date.now();
        setCreateProgress(5); // 从5%开始

        // 每100ms更新一次进度
        progressTimerRef.current = setInterval(() => {
            if (!startTimeRef.current) return;

            const elapsed = Date.now() - startTimeRef.current;
            const progress = Math.min(5 + (elapsed / MAX_TIME) * (MAX_PROGRESS - 5), MAX_PROGRESS);
            
            setCreateProgress(progress);

            // 如果达到5分钟，停止进度条
            if (elapsed >= MAX_TIME) {
                if (progressTimerRef.current) {
                    clearInterval(progressTimerRef.current);
                    progressTimerRef.current = null;
                }
            }
        }, 100);
    };

    // 停止假进度条
    const stopFakeProgress = () => {
        if (progressTimerRef.current) {
            clearInterval(progressTimerRef.current);
            progressTimerRef.current = null;
        }
        startTimeRef.current = null;
    };

    // 取消上传
    const handleCancelUpload = () => {
        // 停止假进度条
        stopFakeProgress();
        
        // 取消正在进行的请求
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        
        // 重置状态
        setIsCreating(false);
        setCreateProgress(0);
        setCreateProgressText('');
    };

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
            setCoverFile(file);
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
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // 移除封面
    const removeCover = () => {
        setCoverFile(null);
        setCoverImage(null);
        if (coverInputRef.current) {
            coverInputRef.current.value = '';
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
            setCoverFile(file);
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
            coverFile !== null
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
        if (!coverFile) {
            alert('请上传封面图片');
            return;
        }
        if (!user?.user?.id) {
            alert('请先登录');
            return;
        }

        setIsCreating(true);
        setCreateProgress(0);
        setCreateProgressText('准备上传文件...');
        
        // 创建 AbortController 用于取消请求
        abortControllerRef.current = new AbortController();
        
        // 启动假进度条
        startFakeProgress();
        
        try {
            // 第一步：创建游戏并上传文件
            setCreateProgressText('正在上传文件并创建游戏...');
            
            const createGameResponse = await createGameApi.createGame({
                file: uploadedFile,
                cover: coverFile,
                title: gameName.trim(),
                subtitle: gameSubtitle.trim(),
                description: gameDescription.trim(),
                creator_user_id: String(user.user.id),
                author_name: user.user.nickname,
            });

            if (!createGameResponse.data.success) {
                stopFakeProgress();
                abortControllerRef.current = null;
                alert(createGameResponse.data.message || '创建游戏失败');
                setIsCreating(false);
                setCreateProgress(0);
                setCreateProgressText('');
                return;
            }

            const fileId = createGameResponse.data.fileId;
            setPdfFileId(fileId);
            setCreateProgressText('游戏创建成功，正在初始化会话...');

            // 第二步：创建session
            const sessionResponse = await createSessionApi.getSession({
                fileId: fileId,
                userId: user.user.id
            });

            if (sessionResponse.data.success) {
                const sessionData = sessionResponse.data.data;
                setSessionId(sessionData?.session.session_id || null);
                
                // 停止假进度条，快速到100%
                stopFakeProgress();
                abortControllerRef.current = null;
                setCreateProgress(100);
                setCreateProgressText('创建成功！正在跳转...');
                
                // 延迟一下让用户看到完成状态
                setTimeout(() => {
                    navigate('/newmain');
                }, 500);
            } else {
                stopFakeProgress();
                abortControllerRef.current = null;
                alert(sessionResponse.data.message || '创建游戏会话失败');
                setIsCreating(false);
                setCreateProgress(0);
                setCreateProgressText('');
            }
        } catch (error: any) {
            // 如果是取消操作，不显示错误
            if (error.name === 'AbortError' || error.message === 'Request aborted') {
                return;
            }
            
            console.error('创建游戏错误:', error);
            stopFakeProgress();
            abortControllerRef.current = null;
            const errorMessage = error.response?.data?.message || error.message || '创建游戏失败，请稍后重试';
            alert(errorMessage);
            setIsCreating(false);
            setCreateProgress(0);
            setCreateProgressText('');
        }
    };

    return (
        <div className={styles.pageRoot}>
            <Navbar />
            <MobileTopNav items={sidebarItems} />
            
            {/* 上传遮罩层 */}
            {isCreating && (
                <div className={styles.uploadOverlay}>
                    <div className={styles.uploadOverlayContent}>
                        <h3 className={styles.uploadOverlayTitle}>正在创建游戏</h3>
                        
                        {/* 进度条 */}
                        <div className={styles.uploadProgressContainer}>
                            <div className={styles.uploadProgressBar}>
                                <div
                                    className={styles.uploadProgressFill}
                                    style={{ width: `${createProgress}%` }}
                                />
                            </div>
                            <div className={styles.uploadProgressPercent}>
                                {Math.round(createProgress)}%
                            </div>
                        </div>
                        
                        {/* 提示文字 */}
                        <p className={styles.uploadOverlayText}>
                            {createProgressText || '处理中...'}
                        </p>
                        
                        {/* 取消按钮 */}
                        <button
                            className={styles.cancelUploadBtn}
                            onClick={handleCancelUpload}
                            type="button"
                        >
                            取消上传
                        </button>
                    </div>
                </div>
            )}
            
            <div className={styles.mainContent}>
                {/* 左侧侧边栏 */}
                <Sidebar items={sidebarItems} />

                {/* 右侧内容区域 */}
                <div className={styles.main}>
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
                                        disabled={isCreating}
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
                                        disabled={isCreating}
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
                                        disabled={isCreating}
                                    />
                                </div>


                                <div className={`${styles.formGroup} ${styles.requiredField}`}>
                                    <label htmlFor="gamePDF">游戏内容文档 (PDF/DOCX)</label>
                                    <div
                                        className={`${styles.fileUploadArea} ${isDragover ? styles.fileUploadAreaDragover : ''} ${isCreating ? styles.disabled : ''}`}
                                        onClick={() => !isCreating && fileInputRef.current?.click()}
                                        onDragOver={(e) => !isCreating && handleDragOver(e)}
                                        onDragLeave={(e) => !isCreating && handleDragLeave(e)}
                                        onDrop={(e) => !isCreating && handleDrop(e)}
                                    >
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            id="gamePDF"
                                            accept=".pdf,.docx"
                                            hidden
                                            onChange={handleFileSelect}
                                            autoComplete="off"
                                            disabled={isCreating}
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
                                                        disabled={isCreating}
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* 右侧40% - 封面展示 */}
                            <div className={styles.coverSection}>
                                <h3 className={styles.coverTitle}>封面预览</h3>
                                <div 
                                    className={`${styles.coverPreview} ${isDragoverCover ? styles.coverPreviewDragover : ''} ${isCreating ? styles.disabled : ''}`}
                                    onDragOver={(e) => !isCreating && handleCoverDragOver(e)}
                                    onDragLeave={(e) => !isCreating && handleCoverDragLeave(e)}
                                    onDrop={(e) => !isCreating && handleCoverDrop(e)}
                                    onClick={() => !isCreating && coverInputRef.current?.click()}
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
                                                disabled={isCreating}
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
                                        disabled={isCreating}
                                    />
                                </div>
                                
                                <div className={styles.coverActions}>
                                    <label className={styles.noImageModeLabel}>
                                        <input 
                                            type="checkbox"
                                            checked={noImageMode}
                                            onChange={(e) => setNoImageMode(e.target.checked)}
                                            disabled={isCreating}
                                            className={styles.noImageModeCheckbox}
                                        />
                                        <span className={styles.noImageModeText}>无图模式</span>
                                    </label>
                                    <button 
                                        className={styles.createGameBtn}
                                        onClick={handleCreateGame}
                                        disabled={isCreating || !isFormValid()}
                                    >
                                    </button>
                                </div>
                            </div>
                        </div>
                </div>
            </div>
            <MobileBottomNav />
        </div>
    );
};

export default Create;
