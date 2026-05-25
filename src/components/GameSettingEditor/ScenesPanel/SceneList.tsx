import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './SceneList.module.css';
import { RiDeleteBin5Line, RiArrowDownSLine, RiArrowRightSLine } from 'react-icons/ri';
import type { LocalScene } from './handlers';
import type { WorldSubScene } from '../editorCompat';
import { DEFAULT_SCENE_IMAGE, DEFAULT_WORLD_MAP_IMAGE, getImageUrl } from '../../../utils/constants';
import { withCacheBust } from '../../../utils/imageCache';

interface SceneListProps {
    sceneData: LocalScene[];
    subsceneDataBySceneId?: Record<string, WorldSubScene[]>;
    activeSceneId: string;
    activeSubsceneId: string | null;
    mode: string;
    getEffectiveImage: (sceneId: string, subsceneId?: string) => string | undefined;
    onSceneClick: (sceneId: string) => void;
    onSubsceneClick: (sceneId: string, subsceneId: string) => void;
    onDeleteClick: (sceneId: string, e: React.MouseEvent) => void;
    onSubsceneDeleteClick: (sceneId: string, subsceneId: string, e: React.MouseEvent) => void;
    onAddNewScene: () => void;
    onAddNewSubscene: () => void;
}

const SceneList: React.FC<SceneListProps> = ({
    sceneData,
    subsceneDataBySceneId,
    activeSceneId,
    activeSubsceneId,
    mode,
    getEffectiveImage,
    onSceneClick,
    onSubsceneClick,
    onDeleteClick,
    onSubsceneDeleteClick,
    onAddNewScene,
    onAddNewSubscene,
}) => {
    const { t } = useTranslation();
    // 子场景折叠状态在组件内部管理
    const [subsceneCollapsed, setSubsceneCollapsed] = useState<Record<string, boolean>>({});
    // 实现移动端场景列表折叠
    const [isMobileViewport, setIsMobileViewport] = useState(() =>
        typeof window !== 'undefined' ? window.matchMedia('(max-width: 720px)').matches : false
    );
    const [isMobileExpanded, setIsMobileExpanded] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return undefined;
        }

        const mediaQuery = window.matchMedia('(max-width: 720px)');
        const handleViewportChange = (event: MediaQueryListEvent) => {
            setIsMobileViewport(event.matches);
        };

        setIsMobileViewport(mediaQuery.matches);

        if (typeof mediaQuery.addEventListener === 'function') {
            mediaQuery.addEventListener('change', handleViewportChange);
            return () => mediaQuery.removeEventListener('change', handleViewportChange);
        }

        mediaQuery.addListener(handleViewportChange);
        return () => mediaQuery.removeListener(handleViewportChange);
    }, []);

    useEffect(() => {
        if (!isMobileViewport) {
            setIsMobileExpanded(false);
        }
    }, [isMobileViewport]);

    const visibleScenes = useMemo(() => {
        if (!isMobileViewport || isMobileExpanded || sceneData.length <= 2) {
            return sceneData;
        }

        const defaultScenes = sceneData.slice(0, 2);
        if (defaultScenes.some((scene) => scene.id === activeSceneId)) {
            return defaultScenes;
        }

        const activeScene = sceneData.find((scene) => scene.id === activeSceneId);
        return activeScene ? [...defaultScenes, activeScene] : defaultScenes;
    }, [activeSceneId, isMobileExpanded, isMobileViewport, sceneData]);

    const handleToggleCollapse = (sceneId: string) => {
        setSubsceneCollapsed(prev => ({
            ...prev,
            [sceneId]: !prev[sceneId],
        }));
    };
    return (
        <div className={styles.card}>
            <div className={styles.boardHead}>
                <div>
                    <h3>{t('createGame.parsedScenes')}</h3>
                </div>
                <button className={styles.ghostSmall} onClick={onAddNewScene}>
                    + {t('createGame.addScene')}
                </button>
            </div>
            <div className={styles.sceneList}>
                {visibleScenes.map((scene) => {
                    const subscenes: WorldSubScene[] =
                        mode === 'worldInteraction'
                            ? (subsceneDataBySceneId?.[scene.id] || [])
                            : [];

                    return (
                        <React.Fragment key={scene.id}>
                            {/* 父场景卡片 */}
                            <article
                                className={`${styles.sceneRow} ${scene.id === activeSceneId && !activeSubsceneId ? styles.active : ''}`}
                                onClick={() => onSceneClick(scene.id)}
                            >
                                <div
                                    className={`${styles.sceneThumb} ${!scene.image ? styles.empty : ''}`}
                                    style={{ backgroundImage: (() => {
                                        const img = getEffectiveImage(scene.id);
                                        if (!img) return `url('${DEFAULT_SCENE_IMAGE}')`;
                                        if (img.startsWith('blob:') || img.startsWith('data:')) {
                                            return `url('${img}')`;
                                        }
                                        return `url('${withCacheBust(getImageUrl(img))}')`;
                                    })() }}
                                >
                                    {!scene.image && <span>{t('createGame.waitingUpload')}</span>}
                                </div>
                                <div className={styles.sceneMeta}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                        <strong>{scene.name}</strong>
                                        <button
                                            className={styles.deleteButton}
                                            onClick={(e) => onDeleteClick(scene.id, e)}
                                            title={t('createGame.deleteScene')}
                                        >
                                            <RiDeleteBin5Line />
                                        </button>
                                    </div>
                                    <p className={styles.mutedSmall}>{scene.desc}</p>
                                </div>
                            </article>

                            {/* 子场景卡片（独立盒子，轻微缩进） */}
                            {mode === 'worldInteraction' && (
                                <div className={styles.subsceneList}>
                                    <div className={styles.subsceneHeader}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleToggleCollapse(scene.id);
                                                }}
                                                style={{ backgroundColor: 'transparent', border: 'none', cursor: 'pointer' }}
                                                aria-label={subsceneCollapsed[scene.id] ? '展开子场景' : '折叠子场景'}
                                                title={subsceneCollapsed[scene.id] ? '展开子场景' : '折叠子场景'}
                                            >
                                                {subsceneCollapsed[scene.id] ? (
                                                    <RiArrowRightSLine size={16} />
                                                ) : (
                                                    <RiArrowDownSLine size={16} />
                                                )}
                                            </button>
                                            <span className={styles.subsceneHeaderText}>
                                                {t('createGame.subSceneCount', { count: subscenes.length })}
                                            </span>
                                        </div>
                                        <button 
                                            className={styles.ghostSmall} 
                                            onClick={onAddNewSubscene}
                                            style={{ fontSize: '12px', padding: '4px 8px' }}
                                        >
                                            + {t('createGame.addSubScene')}
                                        </button>
                                    </div>
                                    {!subsceneCollapsed[scene.id] && subscenes.map((sub) => {
                                        const subId = sub.id || sub.name;
                                        const isActiveSub = activeSubsceneId === subId;
                                        const subImage = getEffectiveImage(scene.id, subId);
                                        return (
                                            <article
                                                key={subId}
                                                className={`${styles.sceneRow} ${styles.subsceneRowCard} ${isActiveSub ? styles.active : ''}`}
                                                onClick={() => onSubsceneClick(scene.id, subId)}
                                            >
                                                <div
                                                    className={`${styles.sceneThumb} ${!subImage ? styles.empty : ''}`}
                                                    style={{
                                                        backgroundImage: (() => {
                                                            if (!subImage) return `url('${DEFAULT_WORLD_MAP_IMAGE}')`;
                                                            if (subImage.startsWith('blob:') || subImage.startsWith('data:')) {
                                                                return `url('${subImage}')`;
                                                            }
                                                            return `url('${withCacheBust(getImageUrl(subImage))}')`;
                                                        })()
                                                    }}
                                                >
                                                    {!subImage && <span>{t('createGame.waitingGenerateOrUpload')}</span>}
                                                </div>
                                                <div className={styles.sceneMeta}>
                                                    <div className={styles.subsceneTitleRow}>
                                                        <div className={styles.subsceneTitleLeft}>
                                                            <strong className={styles.subsceneName}>{sub.name || t('createGame.unnamedSubScene')}</strong>
                                                            <span className={styles.subsceneTag}>{t('createGame.subScene')}</span>
                                                        </div>
                                                        <button
                                                            className={styles.deleteButton}
                                                            onClick={(e) => onSubsceneDeleteClick(scene.id, subId, e)}
                                                            title={t('createGame.deleteSubScene')}
                                                        >
                                                            <RiDeleteBin5Line />
                                                        </button>
                                                    </div>
                                                    <p className={styles.mutedSmall}>{sub.description}</p>
                                                </div>
                                            </article>
                                        );
                                    })}
                                </div>
                            )}
                        </React.Fragment>
                    );
                })}
            </div>
            {isMobileViewport && sceneData.length > 2 && (
                <button
                    type="button"
                    className={styles.mobileToggleButton}
                    onClick={() => setIsMobileExpanded((prev) => !prev)}
                >
                    {isMobileExpanded ? t('createGame.collapseAll') : t('createGame.expandAll', { count: sceneData.length })}
                </button>
            )}
        </div>
    );
};

export default React.memo(SceneList);

