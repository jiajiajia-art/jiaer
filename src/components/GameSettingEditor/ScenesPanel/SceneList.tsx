import React, { useState } from 'react';
import styles from './SceneList.module.css';
import { RiDeleteBin5Line, RiArrowDownSLine, RiArrowRightSLine } from 'react-icons/ri';
import type { LocalScene } from './handlers';
import type { WorldSubScene } from '../editorCompat';
import { getSceneById, isWorldScene } from '../editorCompat';
import { addImageTimestamp, DEFAULT_SCENE_IMAGE, DEFAULT_WORLD_MAP_IMAGE } from './utils';

interface SceneListProps {
    sceneData: LocalScene[];
    activeSceneId: string;
    activeSubsceneId: string | null;
    mode: string;
    gameData: any;
    onSceneClick: (sceneId: string) => void;
    onSubsceneClick: (sceneId: string, subsceneId: string, subscene: WorldSubScene) => void;
    onDeleteClick: (sceneId: string, e: React.MouseEvent) => void;
    onSubsceneDeleteClick: (sceneId: string, subsceneId: string, e: React.MouseEvent) => void;
    onAddNewScene: () => void;
    onAddNewSubscene: () => void;
}

const SceneList: React.FC<SceneListProps> = ({
    sceneData,
    activeSceneId,
    activeSubsceneId,
    mode,
    gameData,
    onSceneClick,
    onSubsceneClick,
    onDeleteClick,
    onSubsceneDeleteClick,
    onAddNewScene,
    onAddNewSubscene,
}) => {
    // 子场景折叠状态在组件内部管理
    const [subsceneCollapsed, setSubsceneCollapsed] = useState<Record<string, boolean>>({});

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
                    <h3>解析出的场景</h3>
                </div>
                <button className={styles.ghostSmall} onClick={onAddNewScene}>
                    + 新增场景
                </button>
            </div>
            <div className={styles.sceneList}>
                {sceneData.map((scene) => {
                    const originalScene = mode === 'worldInteraction'
                        ? getSceneById(gameData, scene.id)
                        : null;
                    const subscenes: WorldSubScene[] = isWorldScene(originalScene as any) 
                        ? (originalScene?.subscenes || []) 
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
                                    style={{ backgroundImage: `url('${scene.image || DEFAULT_SCENE_IMAGE}')` }}
                                >
                                    {!scene.image && <span>待上传</span>}
                                </div>
                                <div className={styles.sceneMeta}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                        <strong>{scene.name}</strong>
                                        <button
                                            className={styles.deleteButton}
                                            onClick={(e) => onDeleteClick(scene.id, e)}
                                            title="删除场景"
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
                                                子场景（{subscenes.length}）
                                            </span>
                                        </div>
                                        <button 
                                            className={styles.ghostSmall} 
                                            onClick={onAddNewSubscene}
                                            style={{ fontSize: '12px', padding: '4px 8px' }}
                                        >
                                            + 新增子场景
                                        </button>
                                    </div>
                                    {!subsceneCollapsed[scene.id] && subscenes.map((sub) => {
                                        const subId = sub.id || sub.name;
                                        const isActiveSub = activeSubsceneId === subId;
                                        return (
                                            <article
                                                key={subId}
                                                className={`${styles.sceneRow} ${styles.subsceneRowCard} ${isActiveSub ? styles.active : ''}`}
                                                onClick={() => onSubsceneClick(scene.id, subId, sub)}
                                            >
                                                <div
                                                    className={`${styles.sceneThumb} ${!sub.image ? styles.empty : ''}`}
                                                    style={{ 
                                                        backgroundImage: `url('${sub.image ? addImageTimestamp(sub.image) : DEFAULT_WORLD_MAP_IMAGE}')` 
                                                    }}
                                                >
                                                    {!sub.image && <span>待生成或上传</span>}
                                                </div>
                                                <div className={styles.sceneMeta}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                            <strong>{sub.name || '未命名子场景'}</strong>
                                                            <span className={styles.subsceneTag}>子场景</span>
                                                        </div>
                                                        <button
                                                            className={styles.deleteButton}
                                                            onClick={(e) => onSubsceneDeleteClick(scene.id, subId, e)}
                                                            title="删除子场景"
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
        </div>
    );
};

export default SceneList;

