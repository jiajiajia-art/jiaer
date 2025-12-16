import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Navbar from '../components/Layout/Navbar';
import styles from './CreateGame.module.css';
import { useGameStore } from '../store/gameStore';
import createGameApi from '../api/createGame/createGameApi.type';
import createSessionApi from '../api/createGame/createSessionApi';
import { useAuthStore } from '../store/useAuthStore';
import MobileBottomNav from '../components/Layout/MobileBottomNav';
import getGameDataApi from '../api/home/getGameData';
import type { UserGameData } from '../api/home/getGameData.type';
import GameAction from '../api/game/gameAction';
import PublishSettingsModal from '../components/goodsModal/PublishSettingsModal';
import DeletModal from '../components/goodsModal/DeletModal';
import GameForm, { type GameFormData } from '../components/CreateGame/GameForm';
import GameStatsView from '../components/CreateGame/GameStatsView';
import UploadProgress from '../components/CreateGame/UploadProgress';
import FooterArea from '../components/Layout/FooterArea';
import toast, { Toaster } from 'react-hot-toast';
import { useEditorStore } from '../store/editorStore';

const CreateGame: React.FC = () => {
    const [searchParams] = useSearchParams();
    const modeParam = searchParams.get('mode') ?? 'create';
    const gameId = searchParams.get('gameId');
    const isStatsMode = modeParam !== 'create' && !!gameId;

    const [isCreating, setIsCreating] = useState(false);
    const [createProgress, setCreateProgress] = useState(0);
    const [createProgressText, setCreateProgressText] = useState('');
    const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const startTimeRef = useRef<number | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const MAX_TIME = 5 * 60 * 1000; // 5分钟（毫秒）
    const MAX_PROGRESS = 90; // 最大进度90%

    const [showForm, setShowForm] = useState(!isStatsMode);
    const [formData, setFormData] = useState<GameFormData | null>(null);
    const [existingFiles, setExistingFiles] = useState<{
        existingDocFile: File | null;
        existingCoverFile: File | null;
    }>({
        existingDocFile: null,
        existingCoverFile: null,
    });

    const [gameDetail, setGameDetail] = useState<UserGameData | null>(null);
    const [isLoadingDetail, setIsLoadingDetail] = useState(false);
    const [detailError, setDetailError] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showPublishModal, setShowPublishModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const { setFileId } = useEditorStore();

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
    const heroBackground = gameDetail?.cover_url || formData?.coverImage || defaultHeroCover;

    const { setPdfFileId, setSessionId } = useGameStore();
    const { user } = useAuthStore();
    const navigate = useNavigate();

    // 清理进度条定时器
    useEffect(() => {
        return () => {
            if (progressTimerRef.current) {
                clearInterval(progressTimerRef.current);
            }
        };
    }, []);

    // 根据模式加载游戏详情
    useEffect(() => {
        if (!isStatsMode || !gameId) {
            setShowForm(true);
            setGameDetail(null);
            setExistingFiles({
                existingDocFile: null,
                existingCoverFile: null,
            });
            return;
        }

        let isMounted = true;

        const fetchDetail = async () => {
            setIsLoadingDetail(true);
            setDetailError(null);
            try {
                const response = await getGameDataApi.getGameDetail({
                    fileId: gameId,
                });
                if (!isMounted) return;

                if (response.data && response.data.data) {
                    const data = response.data.data;
                    setGameDetail(data);

                    // 准备表单初始数据
                    let existingDocFile: File | null = null;
                    let existingCoverFile: File | null = null;

                    if (data.doc_url) {
                        try {
                            const docName = extractFileName(data.doc_url);
                            existingDocFile = await convertUrlToFile(data.doc_url, docName);
                        } catch (error) {
                            console.warn('获取原始文档失败，需要重新上传');
                        }
                    }

                    if (data.cover_url) {
                        try {
                            existingCoverFile = await convertUrlToFile(data.cover_url, `${data.title || 'cover'}.png`);
                        } catch (error) {
                            console.warn('获取封面失败，需要重新上传');
                        }
                    }

                    if (isMounted) {
                        setExistingFiles({
                            existingDocFile,
                            existingCoverFile,
                        });
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

    // 启动假进度条
    const startFakeProgress = () => {
        if (progressTimerRef.current) {
            clearInterval(progressTimerRef.current);
        }

        startTimeRef.current = Date.now();
        setCreateProgress(5);

        progressTimerRef.current = setInterval(() => {
            if (!startTimeRef.current) return;

            const elapsed = Date.now() - startTimeRef.current;
            const progress = Math.min(5 + (elapsed / MAX_TIME) * (MAX_PROGRESS - 5), MAX_PROGRESS);

            setCreateProgress(progress);

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
        stopFakeProgress();

        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }

        setIsCreating(false);
        setCreateProgress(0);
        setCreateProgressText('');
    };

    // 验证必填字段
    const isFormValid = () => {
        if (!formData) return false;
        return (
            formData.gameName.trim() !== '' &&
            formData.gameSubtitle.trim() !== '' &&
            formData.gameDescription.trim() !== '' &&
            (formData.uploadedFile !== null || formData.existingDocFile !== null) &&
            (formData.coverFile !== null || formData.existingCoverFile !== null)
        );
    };

    // 创建游戏（通用方法）
    const createGame = async () => {
        if (!formData) {
            alert('表单数据未准备好');
            return null;
        }

        if (!formData.gameName.trim()) {
            alert('请填写游戏名称');
            return null;
        }
        if (!formData.gameSubtitle.trim()) {
            alert('请填写游戏副标题');
            return null;
        }
        if (!formData.gameDescription.trim()) {
            alert('请填写游戏简介');
            return null;
        }
        if (!user?.user?.id) {
            alert('请先登录');
            return null;
        }

        const fileToUpload = formData.uploadedFile ?? formData.existingDocFile;
        const coverToUpload = formData.coverFile ?? formData.existingCoverFile;

        if (!fileToUpload || !coverToUpload) {
            alert('请上传完整的文档和封面文件');
            return null;
        }

        try {
            setCreateProgressText('正在上传文件并创建游戏...');

            const createGameResponse = await createGameApi.createGame({
                file: fileToUpload,
                cover: coverToUpload,
                title: formData.gameName.trim(),
                subtitle: formData.gameSubtitle.trim(),
                description: formData.gameDescription.trim(),
                author_name: user.user.nickname,
                generateImages: !formData.generateImages,
            });

            if (!createGameResponse.data.success) {
                alert(createGameResponse.data.message || '创建游戏失败');
                return null;
            }

            return createGameResponse.data.fileId;
        } catch (error: any) {
            console.error('创建游戏错误:', error);
            const errorMessage = error.response?.data?.message || error.message || '创建游戏失败，请稍后重试';
            alert(errorMessage);
            return null;
        }
    };

    // 测试体验：创建游戏 + 创建 session + 跳转
    const handleTestGame = async () => {
        setIsCreating(true);
        setCreateProgress(0);
        setCreateProgressText('准备上传文件...');

        abortControllerRef.current = new AbortController();
        startFakeProgress();

        try {
            const fileId = await createGame();
            if (!fileId) {
                stopFakeProgress();
                abortControllerRef.current = null;
                setIsCreating(false);
                setCreateProgress(0);
                setCreateProgressText('');
                return;
            }

            setPdfFileId(fileId);
            setCreateProgressText('游戏创建成功，正在初始化会话...');

            // 创建session
            const sessionResponse = await createSessionApi.getSession({
                fileId: fileId,
            });

            if (sessionResponse.data.success) {
                const sessionData = sessionResponse.data.data;
                setSessionId(sessionData?.session.session_id || null);

                stopFakeProgress();
                abortControllerRef.current = null;
                setCreateProgress(100);
                setCreateProgressText('创建成功！正在跳转...');

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
            if (error.name === 'AbortError' || error.message === 'Request aborted') {
                return;
            }

            console.error('测试游戏错误:', error);
            stopFakeProgress();
            abortControllerRef.current = null;
            setIsCreating(false);
            setCreateProgress(0);
            setCreateProgressText('');
        }
    };


    // 显示删除弹窗
    const handleDeleteGame = () => {
        if (!isStatsMode || !gameId || isDeleting) {
            return;
        }
        setShowDeleteModal(true);
    };

    // 执行删除操作
    const handleConfirmDelete = async () => {
        if (!gameId || isDeleting) {
            return;
        }

        try {
            setIsDeleting(true);
            await GameAction.deleteGame(gameId);
            setShowDeleteModal(false);
            navigate('/create');
        } catch (error) {
            console.error('删除游戏失败:', error);
            alert('删除失败，请稍后重试');
        } finally {
            setIsDeleting(false);
        }
    };

    // 发布游戏
    const handlePublishGame = async (price: number | null, isFree: boolean) => {
        if (!gameId) return;

        try {
            const priceAmount = isFree ? 0 : (price || 0);
            const response = await GameAction.publishGame({
                fileId: gameId,
                priceAmount: priceAmount,
            });

            if (response.data.success) {
                setShowPublishModal(false);
                navigate('/create');
            } else {
                console.error('发布游戏失败:', response.data);
                alert('发布游戏失败');
            }
        } catch (error) {
            console.error('发布游戏失败:', error);
            alert('发布游戏失败');
        }
    };
    // 下架游戏
    const handleUnpublishGame = async (fileId: string) => {
        if (!fileId) return;
        try {
            const response = await GameAction.unpublishGame({ fileId: fileId });
            if (response.data.success) {
                navigate('/create');
            } else {
                toast.error(response.data.message || '下架游戏失败');
                console.error('下架游戏失败:', response.data);
            }
        } catch (error) {
            console.error('下架游戏失败:', error);
            alert('下架游戏失败');
        }
    };

    const editGame = () => {
        if(gameDetail?.version == 'old') {
            setShowForm(true);
        } else if(gameDetail?.version == 'map-plugin-version') {
            setFileId(gameId)
            navigate(`/gameSettingsEditor?mode=worldInteraction`);
        } else {
            setFileId(gameId);
            navigate(`/gameSettingsEditor`);
        }
    }

    return (
        <div className={styles.pageRoot}>
            <Navbar />

            <UploadProgress
                isOpen={isCreating}
                progress={createProgress}
                progressText={createProgressText}
                onCancel={handleCancelUpload}
            />

            {isStatsMode && (
                <>
                    {isLoadingDetail ? (
                        <div className={styles.detailLoading}>加载游戏详情中...</div>
                    ) : detailError ? (
                        <div className={styles.detailError}>{detailError}</div>
                    ) : gameDetail ? (
                        <GameStatsView
                            gameDetail={gameDetail}
                            heroBackground={heroBackground}
                            onEdit={() => editGame()}
                            onDelete={handleDeleteGame}
                            isDeleting={isDeleting}
                            onPublish={() => setShowPublishModal(true)}
                            onUnpublish={handleUnpublishGame}
                        />
                    ) : (
                        <div className={styles.detailError}>未找到游戏信息</div>
                    )}
                </>
            )}

            <Toaster
                position="top-center"
                containerStyle={{
                    position: 'fixed',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                }}
            />

            <div className={`${styles.mainContent} ${isStatsMode && !showForm ? styles.mainContentHidden : ''}`}>
                <div className={`${styles.main} ${isStatsMode && !showForm ? styles.mainHidden : ''}`}>
                    <div className={styles.createGameContainer}>
                        {(!isStatsMode || showForm) ? (
                            <div className={`${styles.formSection} ${!isStatsMode ? styles.formSectionOnly : ''}`}>
                                <GameForm
                                    initialGameData={gameDetail || undefined}
                                    initialFiles={existingFiles}
                                    isCreating={isCreating}
                                    onFormDataChange={setFormData}
                                    onTestGame={handleTestGame}
                                    isFormValid={isFormValid()}
                                />
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>
            <MobileBottomNav />

            {gameDetail && (
                <PublishSettingsModal
                    isOpen={showPublishModal}
                    onClose={() => setShowPublishModal(false)}
                    onPublish={handlePublishGame}
                />
            )}

            <DeletModal
                isOpen={showDeleteModal}
                onDelete={handleConfirmDelete}
                onCancel={() => setShowDeleteModal(false)}
            />

            <FooterArea />
            <MobileBottomNav />
        </div>
    );
};

export default CreateGame;
