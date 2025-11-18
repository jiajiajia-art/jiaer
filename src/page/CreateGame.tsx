import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Navbar from '../components/Layout/Navbar';
import styles from './CreateGame.module.css';
import { useGameStore } from '../store/gameStore';
import createGameApi from '../api/createGame/createGameApi.type';
import createSessionApi from '../api/createGame/createSessionApi';
import { useAuthStore } from '../store/useAuthStore';
import MobileBottomNav from '../components/Mobile/MobileBottomNav';
import { FaFileAlt, FaImage } from 'react-icons/fa';
import getGameDataApi from '../api/home/getGameData';
import type { UserGameData } from '../api/home/getGameData.type';
import GameAction from '../api/game/gameAction';
import { IoEye, IoWallet } from 'react-icons/io5';
import { TbHandClick } from 'react-icons/tb';
import { IoIosArrowForward } from 'react-icons/io';

const CreateGame: React.FC = () => {
    const [searchParams] = useSearchParams();
    const modeParam = searchParams.get('mode') ?? 'create';
    const gameId = searchParams.get('gameId');
    const isStatsMode = modeParam !== 'create' && !!gameId;

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
    const [showForm, setShowForm] = useState(!isStatsMode);

    const [gameDetail, setGameDetail] = useState<UserGameData | null>(null);
    const [isLoadingDetail, setIsLoadingDetail] = useState(false);
    const [detailError, setDetailError] = useState<string | null>(null);

    const [existingDocFile, setExistingDocFile] = useState<File | null>(null);
    const [existingCoverFile, setExistingCoverFile] = useState<File | null>(null);
    const [existingDocName, setExistingDocName] = useState<string>('');
    const [existingDocSize, setExistingDocSize] = useState<number | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const formatFileSizeLabel = (size?: number | null) => {
        if (!size) return '--';
        if (size < 1024) return `${size} B`;
        if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
        return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    };

    const documentDisplayName = uploadedFile?.name ?? existingDocName;
    const documentDisplaySize = uploadedFile ? uploadedFile.size : existingDocSize;

    const convertUrlToFile = async (url: string, filename: string) => {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('下载文件失败');
        }
        const blob = await response.blob();
        const inferredName = filename || 'file';
        return new File([blob], inferredName, { type: blob.type || 'application/octet-stream' });
    };

    const extractFileName = (url: string) => {
        try {
            const pathname = new URL(url).pathname;
            const segments = pathname.split('/');
            return decodeURIComponent(segments.pop() || 'document');
        } catch (error) {
            return 'document';
        }
    };

    const defaultHeroCover = `${import.meta.env.BASE_URL}data/events/welcome.png`;

    const heroBackground = gameDetail?.cover_url || coverImage || defaultHeroCover;

    const { setPdfFileId, setSessionId } = useGameStore();
    const { user } = useAuthStore();
    const navigate = useNavigate();

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

    // 根据模式加载游戏详情与统计数据
    useEffect(() => {
        if (!isStatsMode || !gameId) {
            setShowForm(true);
            setGameDetail(null);
            setExistingDocFile(null);
            setExistingDocName('');
            setExistingDocSize(null);
            setExistingCoverFile(null);
            setCoverImage(null);
            return;
        }

        let isMounted = true;

        const fetchDetail = async () => {
            setIsLoadingDetail(true);
            setDetailError(null);
            try {
                const response = await getGameDataApi.getGameDetail({
                    fileId: gameId,
                    userId: String(user?.user?.id || '')
                });
                if (!isMounted) return;

                if (response.data && response.data.data) {
                    const data = response.data.data;
                    setGameDetail(data);
                    setGameName(data.title || '');
                    setGameSubtitle(data.subtitle || '');
                    setGameDescription(data.description || '');
                    setCoverImage(data.cover_url || null);
                    setNoImageMode(!data.cover_url);

                    setExistingDocName('');
                    setExistingDocSize(null);
                    setExistingDocFile(null);

                    if (data.doc_url) {
                        const docName = extractFileName(data.doc_url);
                        setExistingDocName(docName);
                        try {
                            const docFile = await convertUrlToFile(data.doc_url, docName);
                            if (isMounted) {
                                setExistingDocFile(docFile);
                                setExistingDocSize(docFile.size);
                            }
                        } catch (error) {
                            console.warn('获取原始文档失败，需要重新上传');
                            if (isMounted) {
                                setExistingDocFile(null);
                                setExistingDocSize(null);
                            }
                        }
                    }

                    setExistingCoverFile(null);
                    if (data.cover_url) {
                        try {
                            const coverFile = await convertUrlToFile(data.cover_url, `${data.title || 'cover'}.png`);
                            if (isMounted) {
                                setExistingCoverFile(coverFile);
                            }
                        } catch (error) {
                            console.warn('获取封面失败，需要重新上传');
                            if (isMounted) {
                                setExistingCoverFile(null);
                            }
                        }
                    }
                } else {
                    setDetailError('未找到游戏详情');
                }
            } catch (error) {
                console.error('加载游戏详情失败:', error);
                if (isMounted) {
                    setDetailError('加载游戏详情失败');
                }
            } finally {
                if (isMounted) {
                    setIsLoadingDetail(false);
                    setShowForm(false);
                }
            }
        };

        fetchDetail();

        return () => {
            isMounted = false;
        };
    }, [isStatsMode, gameId, user?.user?.id]);

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

    // 移除文件
    const removeFile = () => {
        setUploadedFile(null);
        setExistingDocFile(null);
        setExistingDocName('');
        setExistingDocSize(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // 移除封面
    const removeCover = () => {
        setCoverFile(null);
        setExistingCoverFile(null);
        setCoverImage(null);
        if (coverInputRef.current) {
            coverInputRef.current.value = '';
        }
    };

    const handleDeleteGame = async () => {
        if (!isStatsMode || !gameId || isDeleting) {
            return;
        }
        const confirmDelete = window.confirm('删除后不可恢复，确定要删除该游戏吗？');
        if (!confirmDelete) return;

        try {
            setIsDeleting(true);
            await GameAction.deleteGame(gameId);
            alert('删除成功');
            navigate('/create');
        } catch (error) {
            console.error('删除游戏失败:', error);
            alert('删除失败，请稍后重试');
        } finally {
            setIsDeleting(false);
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
            (uploadedFile !== null || existingDocFile !== null) &&
            (coverFile !== null || existingCoverFile !== null)
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

        const fileToUpload = uploadedFile ?? existingDocFile;
        const coverToUpload = coverFile ?? existingCoverFile;

        if (!fileToUpload || !coverToUpload) {
            alert('请上传完整的文档和封面文件');
            setIsCreating(false);
            stopFakeProgress();
            return;
        }

        try {
            // 第一步：创建游戏并上传文件
            setCreateProgressText('正在上传文件并创建游戏...');

            const createGameResponse = await createGameApi.createGame({
                file: fileToUpload,
                cover: coverToUpload,
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

            {isStatsMode && (
                <div className={styles.statsModeWrapper}>
                    {isLoadingDetail ? (
                        <div className={styles.detailLoading}>加载游戏详情中...</div>
                    ) : detailError ? (
                        <div className={styles.detailError}>{detailError}</div>
                    ) : gameDetail ? (
                        <>
                            <div
                                className={styles.heroBanner}
                                style={{ backgroundImage: `url(${heroBackground})` }}
                            >
                                <div className={styles.heroOverlay}>
                                    <div className={styles.heroContent}>
                                        <div className={styles.heroTitle}>{gameDetail.title || '未命名剧本'}</div>
                                        <div className={styles.heroMeta}>
                                            <span className={styles.heroRating}>
                                                {(Number(gameDetail.rating_avg ?? 0)).toFixed(1)}
                                            </span>
                                            <span className={styles.heroMetaLabel}>
                                                {(gameDetail.rating_count || 0).toLocaleString()} 人评论
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className={styles.heroStatsWrapper}>
                                <div className={styles.statsSection}>
                                    <div className={styles.sectionHeader}>
                                        <div className={styles.sectionTitle}>我的数据</div>
                                        <hr />
                                        <button
                                            type="button"
                                            className={`${styles.more} ${styles.moreText}`}
                                        >
                                            每晚12:00更新
                                            <IoIosArrowForward />
                                        </button>
                                    </div>
                                    <div className={styles.statsGrid}>
                                        <div className={styles.statBox}>
                                            <div className={styles.statLabel}>
                                                <IoEye />
                                                <span>浏览量</span>
                                            </div>
                                            <div className={styles.statValue}>{200}</div>
                                        </div>
                                        <div className={styles.statBox}>
                                            <div className={styles.statLabel}>
                                                <TbHandClick />
                                                <span>点击</span>
                                            </div>
                                            <div className={styles.statValue}>{6}</div>
                                        </div>
                                        <div className={styles.statBox}>
                                            <div className={styles.statLabel}>
                                                <IoWallet />
                                                <span>收益</span>
                                            </div>
                                            <div className={styles.statValue}>{0}</div>
                                        </div>
                                    </div>
                                </div>

                                <div className={styles.heroActionGroup}>
                                    <button
                                        className={styles.editGameBtn}
                                        onClick={() => setShowForm(true)}
                                    >
                                        编辑游戏
                                    </button>
                                    <button
                                        className={styles.deleteGameBtn}
                                        onClick={handleDeleteGame}
                                        disabled={isDeleting}
                                    >
                                        {isDeleting ? '删除中...' : '删除游戏'}
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className={styles.detailError}>未找到游戏信息</div>
                    )}
                </div>
            )}

            <div className={styles.mainContent}>
                {/* 右侧内容区域 */}
                <div className={styles.main}>
                    <div className={styles.createGameContainer}>
                        {/* 左侧60% - 表单 */}
                        {(!isStatsMode || showForm) ? (
                            <div className={`${styles.formSection} ${!isStatsMode ? styles.formSectionOnly : ''}`}>
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
                                    <label htmlFor="gamePDF">文档内容</label>
                                    <div
                                        className={`${styles.documentUploadArea} ${isDragover ? styles.dragActive : ''} ${isCreating ? styles.disabled : ''}`}
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
                                        {documentDisplayName ? (
                                            <div className={styles.uploadInfo}>
                                                <span className={styles.fileIcon}>
                                                    <FaFileAlt color="#bfbfbf" />
                                                </span>
                                                <div className={styles.fileMeta}>
                                                    <span className={styles.fileName}>{documentDisplayName}</span>
                                                    <span className={styles.fileSize}>{formatFileSizeLabel(documentDisplaySize)}</span>
                                                </div>
                                                <button
                                                    type="button"
                                                    className={styles.removeFileBtn}
                                                    onClick={removeFile}
                                                    disabled={isCreating}
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        ) : (
                                            <div className={styles.uploadPlaceholder}>
                                                <span className={styles.uploadIcon}>
                                                    <FaFileAlt color="#bfbfbf" />
                                                </span>
                                                <p className={styles.uploadText}>点击或拖拽文档文件到此处</p>
                                                <p className={styles.uploadHint}>支持 PDF 和 DOCX 格式，最大 10MB</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className={`${styles.formGroup} ${styles.requiredField}`}>
                                    <label htmlFor="coverImage">封面预览</label>
                                    <div
                                        className={`${styles.coverUploadArea} ${isDragoverCover ? styles.dragActive : ''} ${isCreating ? styles.disabled : ''}`}
                                        onClick={() => !isCreating && coverInputRef.current?.click()}
                                        onDragOver={(e) => !isCreating && handleCoverDragOver(e)}
                                        onDragLeave={(e) => !isCreating && handleCoverDragLeave(e)}
                                        onDrop={(e) => !isCreating && handleCoverDrop(e)}
                                    >
                                        <input
                                            ref={coverInputRef}
                                            type="file"
                                            id="coverImage"
                                            accept="image/jpeg,image/png,image/jpg"
                                            hidden
                                            onChange={handleCoverSelect}
                                            autoComplete="off"
                                            disabled={isCreating}
                                        />
                                        {!coverImage ? (
                                            <div className={styles.uploadPlaceholder}>
                                                <span className={styles.uploadIcon}>
                                                    <FaImage color='#bfbfbf' />
                                                </span>
                                                <p className={styles.uploadText}>点击或拖拽图片到此处</p>
                                                <p className={styles.uploadHint}>支持 JPG、PNG 格式</p>
                                            </div>
                                        ) : (
                                            <div className={styles.coverPreviewContainer}>
                                                <img src={coverImage} alt="封面预览" className={styles.coverPreviewImage} />
                                                <button
                                                    type="button"
                                                    className={styles.removeFileBtn}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        removeCover();
                                                    }}
                                                    disabled={isCreating}
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className={styles.formGroup}>
                                    <label htmlFor=""></label>
                                    <input
                                        type="checkbox"
                                        checked={noImageMode}
                                        onChange={(e) => setNoImageMode(e.target.checked)}
                                        disabled={isCreating}
                                        className={styles.noImageModeCheckbox}
                                    />
                                    <span className={styles.noImageModeText}>无图模式</span>
                                </div>
                                <div className={styles.formGroup}>
                                    <label></label>
                                    <button
                                        className={styles.createGameBtn}
                                        onClick={handleCreateGame}
                                        disabled={isCreating || !isFormValid()}
                                    >
                                        测试体验
                                    </button>
                                </div>

                                <div className={styles.formGroup}>
                                    <label></label>
                                    <button
                                        className={styles.createGameBtn}
                                        onClick={handleCreateGame}
                                        disabled={isCreating || !isFormValid()}
                                    >
                                        直接发布
                                    </button>
                                </div>
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>
            <MobileBottomNav />
        </div>
    );
};

export default CreateGame;
