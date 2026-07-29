import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { FaRegShareFromSquare } from 'react-icons/fa6';
import { IoChevronBack } from 'react-icons/io5';
import TextModeDisplay from '../components/Galgame/TextModeDisplay';
import NovelTextVirtualList from '../components/NovelReader/NovelTextVirtualList';
import NovelPlaybackShell from '../components/NovelReader/NovelPlaybackShell';
import novelApi, { type NovelChapter, type NovelContent, type NovelMeta } from '../api/galgame/novel';
import getGalgamePresetApi from '../api/galgame/getGalgamePreset';
import { convertStepsToTextModalFormat } from '../hooks/mapGalgame/common/interactionUtils';
import { useNovelNormalPlayback, type NovelPlaybackPreset } from '../hooks/galgame/useNovelNormalPlayback';
import { getImageUrl } from '../utils/constants';
import { countVisibleNovelTextSteps } from '../utils/novelGame';
import { getGameTypeLabelFromMeta } from '../utils/gameTypeLabel';
import {
  normalizeNovelChapterIndex,
  resolveNovelSynopsisText,
} from '../lib/galgame/novelChapters';
import {
  applyNovelWindowToBuffer,
  bufferFromFullSteps,
  createEmptyNovelStepBuffer,
  NOVEL_WINDOW_DEFAULT_LIMIT,
  shouldUseNovelVirtualList,
  shouldUseNovelWindowMode,
  type NovelStepBuffer,
} from '../lib/galgame/novelContentWindow';
import {
  contiguousLoadedStepsFromBuffer,
  shouldPrefetchPlaybackWindow,
} from '../lib/galgame/novelPlayback';
import styles from './NovelReader.module.css';

/** 复制文本到剪贴板：优先 Clipboard API，移动端/非 HTTPS 时回退 execCommand */
async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      console.warn('[NovelReader] clipboard API copy failed:', error);
    }
  }

  if (typeof document === 'undefined') {
    return false;
  }

  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.setAttribute('readonly', 'true');
  textArea.style.position = 'fixed';
  textArea.style.opacity = '0';
  textArea.style.pointerEvents = 'none';
  document.body.appendChild(textArea);
  textArea.select();

  try {
    return document.execCommand('copy');
  } catch (error) {
    console.warn('[NovelReader] execCommand copy failed:', error);
    return false;
  } finally {
    document.body.removeChild(textArea);
  }
}

function hasReplayStepsContent(content: NovelContent | null): content is NovelContent & { steps: any[] } {
    return Array.isArray(content?.steps) && content.steps.length > 0;
}

function hasLegacyChaptersContent(content: NovelContent | null): content is NovelContent & { chapters: NovelChapter[] } {
    return Array.isArray(content?.chapters) && content.chapters.length > 0;
}

const NovelReader: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { fileId = '' } = useParams<{ fileId: string }>();
    const [content, setContent] = useState<NovelContent | null>(null);
    const [meta, setMeta] = useState<NovelMeta | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [windowMode, setWindowMode] = useState(false);
    const [stepBuffer, setStepBuffer] = useState<NovelStepBuffer>(() => createEmptyNovelStepBuffer());
    const [isFetchingWindow, setIsFetchingWindow] = useState(false);
    const [loadError, setLoadError] = useState(false);
    const [playbackPreset, setPlaybackPreset] = useState<NovelPlaybackPreset | null>(null);
    /** 文本模式：对齐经典回放底栏「文本」开关 */
    const [isPlaybackTextMode, setIsPlaybackTextMode] = useState(false);
    const fetchLockRef = useRef(false);
    const loadStartedAtRef = useRef(0);

    const fetchWindow = useCallback(async (from: number, limit: number) => {
        if (!fileId || fetchLockRef.current) return;
        fetchLockRef.current = true;
        setIsFetchingWindow(true);
        try {
            const response = await novelApi.getContent(fileId, { from, limit });
            const data = response.data;
            if (!data?.success) {
                throw new Error('window content failed');
            }
            const steps = Array.isArray(data.steps)
                ? data.steps
                : Array.isArray(data.content?.steps)
                    ? data.content.steps
                    : [];
            const totalStepCount = Number(data.totalStepCount ?? data.content?.stepCount ?? 0);
            const chapterIndexRaw = data.chapterIndex ?? data.content?.chapterIndex ?? [];
            setStepBuffer((prev) =>
                applyNovelWindowToBuffer(prev, Number(data.from ?? from) || from, steps, {
                    totalStepCount,
                    chapterIndex: normalizeNovelChapterIndex(chapterIndexRaw, Math.max(totalStepCount, 1)),
                }),
            );
            if (data.content) {
                setContent((prev) => ({
                    ...(prev || data.content!),
                    ...data.content,
                    steps: prev?.steps?.length ? prev.steps : steps,
                    chapterIndex: chapterIndexRaw.length ? chapterIndexRaw : prev?.chapterIndex,
                    stepCount: totalStepCount || prev?.stepCount,
                }));
            }
        } finally {
            fetchLockRef.current = false;
            setIsFetchingWindow(false);
        }
    }, [fileId]);

    const textModalSteps = useMemo(() => {
        if (windowMode) {
            const entries = [...stepBuffer.stepsByIndex.entries()]
                .sort((a, b) => a[0] - b[0])
                .map(([index, step]) => ({ ...(step as object), globalStepIndex: index }));
            return convertStepsToTextModalFormat(entries, null).map((step: any, i: number) => ({
                ...step,
                globalStepIndex: entries[i]?.globalStepIndex ?? i,
            }));
        }
        if (!hasReplayStepsContent(content)) return [];
        return convertStepsToTextModalFormat(content.steps, null).map((step: any, index: number) => ({
            ...step,
            globalStepIndex: index,
        }));
    }, [content, stepBuffer.stepsByIndex, windowMode]);

    const visibleTextStepCount = useMemo(
        () => countVisibleNovelTextSteps(textModalSteps),
        [textModalSteps],
    );

    const legacyChapters = useMemo(() => {
        if (!hasLegacyChaptersContent(content)) return [];
        return content.chapters;
    }, [content]);


    const synopsisText = useMemo(
        () => resolveNovelSynopsisText(meta?.description),
        [meta?.description],
    );

    const heroStyle = useMemo(() => {
        const coverUrl = meta?.coverUrl;
        if (!coverUrl) return {};
        return {
            backgroundImage: `url(${getImageUrl(coverUrl)})`,
        };
    }, [meta?.coverUrl]);

    const novelTypeLabel = useMemo(
        () => getGameTypeLabelFromMeta({ engine: 'NOVEL', game_tags: 'NOVEL' }),
        [],
    );

    const useVirtualList = windowMode && shouldUseNovelVirtualList(stepBuffer.totalStepCount);

    /** 回放式阅读用已加载连续 steps；全量模式直接用 content.steps */
    const playbackSteps = useMemo(() => {
        if (windowMode) {
            return contiguousLoadedStepsFromBuffer(
                stepBuffer.stepsByIndex,
                stepBuffer.totalStepCount || meta?.stepCount || 0,
            );
        }
        if (hasReplayStepsContent(content)) return content.steps;
        return [];
    }, [content, meta?.stepCount, stepBuffer.stepsByIndex, stepBuffer.totalStepCount, windowMode]);

    const hasPlaybackSteps = playbackSteps.length > 0;
    const playModeEnabled = hasPlaybackSteps && !isLoading && !loadError;

    const handlePlaybackPrefetch = useCallback(
        (playbackIndex: number) => {
            if (!windowMode || !fileId) return;
            const loaded = playbackSteps.length;
            const total = stepBuffer.totalStepCount || meta?.stepCount || 0;
            if (!shouldPrefetchPlaybackWindow(loaded, playbackIndex, total, 20)) return;
            void fetchWindow(loaded, NOVEL_WINDOW_DEFAULT_LIMIT);
        },
        [fetchWindow, fileId, meta?.stepCount, playbackSteps.length, stepBuffer.totalStepCount, windowMode],
    );

    const playback = useNovelNormalPlayback({
        steps: playbackSteps,
        preset: playbackPreset,
        enabled: playModeEnabled,
        isWaitingForData: isFetchingWindow,
        onNeedPrefetch: handlePlaybackPrefetch,
    });


    // 功能注释：用原作 fileId 拉场景/NPC，供回放式背景与立绘（与 /replay 一致）
    useEffect(() => {
        const sourceFileId = meta?.sourceFileId;
        if (!sourceFileId) {
            setPlaybackPreset(null);
            return;
        }
        let mounted = true;
        void (async () => {
            try {
                const response = await getGalgamePresetApi.getGalgameFileId(sourceFileId);
                if (!mounted) return;
                const payload = response.data?.data;
                if (!payload) {
                    setPlaybackPreset(null);
                    return;
                }
                setPlaybackPreset({
                    world: payload.world ?? null,
                    scenes: payload.scenes ?? null,
                    npcs: payload.npcs ?? null,
                });
            } catch (error) {
                console.warn('[NovelReader] load playback preset failed:', error);
                if (mounted) setPlaybackPreset(null);
            }
        })();
        return () => {
            mounted = false;
        };
    }, [meta?.sourceFileId]);

    const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

    const handleBack = useCallback(() => {
        if (window.history.length > 1) {
            navigate(-1);
            return;
        }
        if (fileId) {
            navigate(`/game/${encodeURIComponent(fileId)}`);
            return;
        }
        navigate('/home');
    }, [fileId, navigate]);

    const handleShare = useCallback(async () => {
        const shareTitle = meta?.title || t('gameDetail.unnamedGame');
        const shareText = meta?.description || '';

        if (canNativeShare) {
            try {
                await navigator.share({
                    title: shareTitle,
                    text: shareText,
                    url: window.location.href,
                });
                return;
            } catch (error) {
                if ((error as Error)?.name === 'AbortError') {
                    return;
                }
            }
        }

        const copied = await copyTextToClipboard(window.location.href);
        if (copied) {
            toast.success(t('gameDetail.linkCopied'));
        } else {
            toast.error(t('gameDetail.copyFailed'));
        }
    }, [canNativeShare, meta?.description, meta?.title, t]);


    const handleRetry = useCallback(() => {
        setLoadError(false);
        setIsLoading(true);
        setContent(null);
        setStepBuffer(createEmptyNovelStepBuffer());
        // 触发 effect 重载：改 fileId 依赖外用时间戳
        setMeta((prev) => (prev ? { ...prev } : prev));
        void (async () => {
            if (!fileId) return;
            try {
                const metaResponse = await novelApi.getMeta(fileId);
                if (metaResponse.data?.success && metaResponse.data.novel) {
                    setMeta(metaResponse.data.novel);
                }
            } catch {
                setLoadError(true);
                setIsLoading(false);
            }
        })();
    }, [fileId]);

    useEffect(() => {
        if (!fileId) {
            toast.error(t('novelReader.invalidNovelId'));
            navigate('/home');
            return;
        }

        let mounted = true;
        const loadNovel = async () => {
            setIsLoading(true);
            setLoadError(false);
            loadStartedAtRef.current = typeof performance !== 'undefined' ? performance.now() : Date.now();
            try {
                const metaResponse = await novelApi.getMeta(fileId);
                if (!mounted) return;
                const nextMeta = metaResponse.data?.success ? metaResponse.data.novel : null;
                if (nextMeta) setMeta(nextMeta);

                const useWindow = shouldUseNovelWindowMode(nextMeta);
                setWindowMode(useWindow);

                if (useWindow) {
                    // 功能注释：长文先窗口首包，目录不依赖拉完全文
                    const response = await novelApi.getContent(fileId, {
                        from: 0,
                        limit: NOVEL_WINDOW_DEFAULT_LIMIT,
                    });
                    if (!mounted) return;
                    const data = response.data;
                    if (!data?.success) {
                        throw new Error('load window failed');
                    }
                    const steps = Array.isArray(data.steps)
                        ? data.steps
                        : Array.isArray(data.content?.steps)
                            ? data.content.steps
                            : [];
                    const totalStepCount = Number(
                        data.totalStepCount ?? data.content?.stepCount ?? nextMeta?.stepCount ?? 0,
                    );
                    const chapterIndexRaw = data.chapterIndex ?? data.content?.chapterIndex ?? [];
                    const normalizedChapters = normalizeNovelChapterIndex(
                        chapterIndexRaw,
                        Math.max(totalStepCount, 1),
                    );
                    setStepBuffer(
                        applyNovelWindowToBuffer(
                            createEmptyNovelStepBuffer(totalStepCount, normalizedChapters),
                            Number(data.from ?? 0) || 0,
                            steps,
                            { totalStepCount, chapterIndex: normalizedChapters },
                        ),
                    );
                    setContent({
                        novelFileId: fileId,
                        sourceFileId: String(nextMeta?.sourceFileId || ''),
                        sourceReplayId: String(nextMeta?.sourceReplayId || ''),
                        compiledAt: Number(nextMeta?.compiledAt || Date.now()),
                        stepCount: totalStepCount,
                        contentVersion: data.content?.contentVersion,
                        chapterIndex: chapterIndexRaw,
                        steps,
                        contentLayout: data.contentLayout || nextMeta?.contentLayout || 'single',
                    } as NovelContent);
                    if (typeof console !== 'undefined' && console.info) {
                        const elapsed =
                            (typeof performance !== 'undefined' ? performance.now() : Date.now())
                            - loadStartedAtRef.current;
                        console.info('[NovelReader]', {
                            mode: 'window',
                            stepCount: totalStepCount,
                            contentBytes: nextMeta?.contentBytes,
                            firstPackSteps: steps.length,
                            loadMs: Math.round(elapsed),
                        });
                    }
                } else {
                    const contentResponse = await novelApi.getContent(fileId);
                    if (!mounted) return;
                    if (contentResponse.data?.success && contentResponse.data.content) {
                        const full = contentResponse.data.content;
                        setContent(full);
                        if (Array.isArray(full.steps) && full.steps.length > 0) {
                            setStepBuffer(
                                bufferFromFullSteps(
                                    full.steps,
                                    normalizeNovelChapterIndex(
                                        full.chapterIndex,
                                        full.steps.length,
                                    ),
                                ),
                            );
                        }
                        if (typeof console !== 'undefined' && console.info) {
                            const elapsed =
                                (typeof performance !== 'undefined' ? performance.now() : Date.now())
                                - loadStartedAtRef.current;
                            console.info('[NovelReader]', {
                                mode: 'full',
                                stepCount: full.stepCount ?? full.steps?.length,
                                loadMs: Math.round(elapsed),
                            });
                        }
                    } else {
                        toast.error(t('novelReader.loadFailed'));
                        navigate(`/game/${fileId}`);
                    }
                }
            } catch (error) {
                console.error('加载小说正文失败:', error);
                if (mounted) {
                    setLoadError(true);
                    toast.error(t('novelReader.loadFailed'));
                }
            } finally {
                if (mounted) setIsLoading(false);
            }
        };

        void loadNovel();
        return () => {
            mounted = false;
        };
    }, [fileId, navigate, t]);

    const useReplayTextMode = textModalSteps.length > 0 || (windowMode && stepBuffer.totalStepCount > 0);

    const renderBody = () => {
        if (isLoading) {
            return (
                <div className={styles.loading}>
                    {windowMode || shouldUseNovelWindowMode(meta)
                        ? t('novelReader.loadingLong')
                        : t('novelReader.loading')}
                </div>
            );
        }

        if (loadError) {
            return (
                <div className={styles.emptyContent}>
                    <p>{t('novelReader.loadFailed')}</p>
                    <button type="button" className={styles.tocInMeta} onClick={handleRetry}>
                        {t('novelReader.retry')}
                    </button>
                </div>
            );
        }

        // 功能注释：默认回放式呈现（方案 A）；文本气泡保留为次要模式
        if (playModeEnabled) {
            return (
                <NovelPlaybackShell
                    backgroundImage={playback.backgroundImage}
                    sceneName={playback.sceneName}
                    currentMessage={playback.currentMessage}
                    finalDisplayText={playback.finalDisplayText}
                    finalIsTyping={playback.finalIsTyping}
                    isAutoPlay={playback.isAutoPlay}
                    isTextMode={isPlaybackTextMode}
                    playbackIndex={playback.index}
                    stepsCount={playback.stepsCount}
                    playbackSpeed={playback.playbackSpeed}
                    playbackSpeedOptions={playback.playbackSpeedOptions}
                    textModalSteps={textModalSteps}
                    stepHandlers={playback.stepHandlers}
                    onNextMessage={playback.handleNext}
                    onChoiceClick={playback.handleChoiceClick}
                    onToggleAutoPlay={() => playback.setIsAutoPlay((v) => !v)}
                    onToggleTextMode={() => {
                        setIsPlaybackTextMode((prev) => {
                            const next = !prev;
                            if (next) playback.setIsAutoPlay(false);
                            return next;
                        });
                    }}
                    onSeek={playback.seekTo}
                    onSpeedChange={playback.setPlaybackSpeed}
                    onExit={handleBack}
                />
            );
        }

        if (useVirtualList) {
            return (
                <div className={styles.replayTextModeWrapper}>
                    <NovelTextVirtualList
                        buffer={stepBuffer}
                        isFetching={isFetchingWindow}
                        onNeedWindow={(from, limit) => {
                            void fetchWindow(from, limit);
                        }}
                    />
                    {isFetchingWindow ? (
                        <div className={styles.loadingMore}>{t('novelReader.loadingMore')}</div>
                    ) : null}
                </div>
            );
        }

        if (useReplayTextMode) {
            if (visibleTextStepCount === 0 && !(windowMode && isFetchingWindow)) {
                return <div className={styles.emptyContent}>{t('novelReader.emptyContent')}</div>;
            }

            return (
                <div className={styles.replayTextModeWrapper}>
                    <TextModeDisplay
                        steps={textModalSteps}
                        currentStepIndex={-1}
                        currentDisplayText=""
                        isTyping={false}
                        isWaitingForData={isFetchingWindow}
                        historyLength={0}
                        isFreeRound
                        readOnly
                        surface="light"
                    />
                    {windowMode ? (
                        <div className={styles.windowActions}>
                            {stepBuffer.ranges.some((r) => r.to < stepBuffer.totalStepCount) ? (
                                <button
                                    type="button"
                                    className={styles.tocInMeta}
                                    disabled={isFetchingWindow}
                                    onClick={() => {
                                        const lastTo = Math.max(0, ...stepBuffer.ranges.map((r) => r.to));
                                        void fetchWindow(lastTo, NOVEL_WINDOW_DEFAULT_LIMIT);
                                    }}
                                >
                                    {isFetchingWindow
                                        ? t('novelReader.loadingMore')
                                        : t('novelReader.loadMore')}
                                </button>
                            ) : null}
                        </div>
                    ) : null}
                </div>
            );
        }

        if (legacyChapters.length > 0) {
            return (
                <article className={styles.readerArticle}>
                    {legacyChapters.map((chapter) => (
                        <section
                            key={chapter.id}
                            id={`novel-chapter-${chapter.id}`}
                            className={styles.chapterSection}
                        >
                            {chapter.title && (
                                <h2 className={styles.chapterTitle}>{chapter.title}</h2>
                            )}
                            {chapter.paragraphs.map((paragraph, index) => {
                                const key = `${chapter.id}-${index}`;
                                if (paragraph.type === 'scene') {
                                    return (
                                        <div key={key} className={styles.sceneBlock}>
                                            {paragraph.sceneImage ? (
                                                <figure className={styles.sceneFigure}>
                                                    <img
                                                        src={getImageUrl(paragraph.sceneImage)}
                                                        alt={paragraph.text || t('novelReader.sceneImage')}
                                                    />
                                                </figure>
                                            ) : null}
                                            {paragraph.text ? (
                                                <p className={styles.sceneParagraph}>{paragraph.text}</p>
                                            ) : null}
                                        </div>
                                    );
                                }
                                if (paragraph.type === 'dialogue') {
                                    return (
                                        <p key={key} className={styles.dialogueParagraph}>
                                            {paragraph.speaker ? (
                                                <strong>{paragraph.speaker}：</strong>
                                            ) : null}
                                            {paragraph.text}
                                        </p>
                                    );
                                }
                                return (
                                    <p key={key} className={styles.narrationParagraph}>
                                        {paragraph.text}
                                    </p>
                                );
                            })}
                        </section>
                    ))}
                </article>
            );
        }

        return <div className={styles.emptyContent}>{t('novelReader.emptyContent')}</div>;
    };

    return (
        <div className={`${styles.pageContainer} ${playModeEnabled ? styles.pageContainerPlay : ''}`}>
            {!playModeEnabled ? (
                <div className={styles.topBar}>
                    <div className={styles.topBarContent}>
                        <button
                            type="button"
                            className={styles.backIconButton}
                            onClick={handleBack}
                            aria-label={t('gameDetail.back')}
                        >
                            <IoChevronBack />
                        </button>
                        <div className={styles.topActions}>
                            <button
                                type="button"
                                className={styles.topIconButton}
                                onClick={handleShare}
                                aria-label={t('gameDetail.share')}
                            >
                                <FaRegShareFromSquare />
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            {!playModeEnabled ? (
                <div className={styles.heroSection} style={heroStyle} />
            ) : null}

            <main className={`${styles.contentSection} ${playModeEnabled ? styles.contentSectionPlay : ''}`}>
                <div className={`${styles.contentWrapper} ${playModeEnabled ? styles.contentWrapperPlay : ''}`}>
                    {!playModeEnabled ? (
                        <header className={styles.headerSection}>
                            <h1 className={styles.novelTitle}>
                                {meta?.title || t('gameDetail.unnamedGame')}
                            </h1>
                            <div className={styles.metaTagsRow}>
                                <span className={styles.novelType}>{novelTypeLabel}</span>
                            </div>
                            {meta?.authorName ? (
                                <div className={styles.authorName}>{meta.authorName}</div>
                            ) : null}
                            <p className={styles.synopsis}>
                                {synopsisText || t('novelReader.noDescription')}
                            </p>
                        </header>
                    ) : null}

                    <div className={`${styles.readerBody} ${playModeEnabled ? styles.readerBodyPlay : ''}`}>
                        {renderBody()}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default NovelReader;
