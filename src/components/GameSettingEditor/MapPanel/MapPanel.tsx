import React, { useEffect, useMemo, useState } from 'react';
import styles from './MapPanel.module.css';
import { getImageUrl } from '../../../utils/constants';
import type { MapPanelProps, SubScene } from './types';
import { DEFAULT_MAP_IMAGE, DEFAULT_SCENE_IMAGE } from './constants';
import SubSceneTab from './SubSceneTab';
import SceneTab from './SceneTab';
import MapTab from './MapTab';

const MapPanel: React.FC<MapPanelProps> = ({ sceneSetting, worldMapImage, fileId, onDataChange, isActive, abilityNodeSetting }) => {
    const [mapTab, setMapTab] = useState<'subScene' | 'scene' | 'map'>('subScene');

    useEffect(() => {
        if (isActive) {
            setMapTab('subScene');
        }
    }, [isActive]);

    // 计算属性，提取subscenes
    const subScenes = useMemo<SubScene[]>(() => {
        if (!sceneSetting?.scenes) return [];
        return sceneSetting.scenes.flatMap(scene =>
            (scene.subscenes || []).map(sub => ({
                ...sub,
                parentId: scene.id,
                parentName: scene.name,
            }))
        );
    }, [sceneSetting?.scenes]);

    // 根据当前 tab 选择显示的底图
    const sceneImageUrl = useMemo(() => {
        if (mapTab === 'subScene') {
            // 子场景tab使用第一个子场景的图片或默认图
            const firstSubScene = subScenes[0];
            if (firstSubScene?.image && firstSubScene.image.trim() !== '') {
                return getImageUrl(firstSubScene.image);
            }
            return DEFAULT_MAP_IMAGE;
        }
        if (mapTab === 'scene') {
            const currentScene = sceneSetting?.scenes?.[0];
            return currentScene?.image ? getImageUrl(currentScene.image) : DEFAULT_SCENE_IMAGE;
        }
        return DEFAULT_SCENE_IMAGE;
    }, [mapTab, subScenes, sceneSetting?.scenes]);

    return (
        <div className={styles.mapSection}>
            <div className={styles.mapHeader}>
                <div>
                    <p className={styles.eyebrow}>Step 5</p>
                    <h2>地图编辑</h2>
                    <p className={styles.subtitle}>构建三级地图结构：子场景 -{'>'} 场景 -{'>'} 地图</p>
                </div>
            </div>
            <div className={styles.mapTabs}>
                {[
                    { id: 'subScene', label: '子场景' },
                    { id: 'scene', label: '场景' },
                    { id: 'map', label: '地图' },
                ].map(tab => (
                    <button
                        key={tab.id}
                        className={`${styles.mapTab} ${mapTab === tab.id ? styles.mapTabActive : ''}`}
                        onClick={() => setMapTab(tab.id as 'subScene' | 'scene' | 'map')}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className={`${styles.mapEditor} ${mapTab === 'subScene' ? styles.mapEditorThreeColumns : ''}`}>
                {mapTab === 'subScene' && (
                    <SubSceneTab
                        subScenes={subScenes}
                        sceneSetting={sceneSetting}
                        fileId={fileId}
                        onDataChange={onDataChange}
                        isActive={isActive}
                        sceneImageUrl={sceneImageUrl}
                        abilityNodeSetting={abilityNodeSetting}
                    />
                )}

                {mapTab === 'scene' && (
                    <SceneTab
                        sceneSetting={sceneSetting}
                        fileId={fileId}
                        onDataChange={onDataChange}
                        sceneImageUrl={sceneImageUrl}
                    />
                )}

                {mapTab === 'map' && (
                    <MapTab
                        sceneSetting={sceneSetting}
                        worldMapImage={worldMapImage}
                        fileId={fileId}
                        onDataChange={onDataChange}
                        isActive={isActive}
                    />
                )}
            </div>
        </div>
    );
};

export default MapPanel;
