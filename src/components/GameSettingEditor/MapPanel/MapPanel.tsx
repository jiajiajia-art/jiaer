import React, { useEffect, useMemo, useState, useRef, useImperativeHandle } from 'react';
import styles from './MapPanel.module.css';
import type { MapPanelProps, SubScene } from './types';
import SubSceneTab, { type SubSceneTabRef } from './SubSceneTab';
import SceneTab, { type SceneTabRef } from './SceneTab';
import MapTab, { type MapTabRef } from './MapTab';
import MapWorldData from '../../../api/worldInteraction/mapWorldData';
import type { AbilityNodeSetting } from '../../../api/worldInteraction/worldInteractionApi.type';
import SaveConfirmModal from '../../GoodsModal/SaveConfirmModal';
import { toast } from 'react-hot-toast';

export interface MapPanelRef {
    checkBeforeLeave: () => Promise<boolean> | boolean;
}

const MapPanel = React.forwardRef<MapPanelRef, MapPanelProps>(({ sceneSetting, worldMapImage, fileId, onDataChange, isActive, abilityNodeSetting: propAbilityNodeSetting }, ref) => {
    const [mapTab, setMapTab] = useState<'subScene' | 'scene' | 'map'>('subScene');
    const [localAbilityNodeSetting, setLocalAbilityNodeSetting] = useState<AbilityNodeSetting | undefined>(propAbilityNodeSetting);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [saveConfirmModalOpen, setSaveConfirmModalOpen] = useState(false);
    const [pendingAction, setPendingAction] = useState<{ type: 'switchTab' | 'switchPanel'; targetTab?: string } | null>(null);
    const [isBlockingSwitch, setIsBlockingSwitch] = useState(false);
    const subSceneTabRef = useRef<SubSceneTabRef | null>(null);
    const sceneTabRef = useRef<SceneTabRef | null>(null);
    const mapTabRef = useRef<MapTabRef | null>(null);
    const [hasUnsavedChangesScene, setHasUnsavedChangesScene] = useState(false);
    const [hasUnsavedChangesMap, setHasUnsavedChangesMap] = useState(false);

    // 当面板激活时，独立请求最新的 abilityNodeSetting
    useEffect(() => {
        if (isActive && fileId) {
            const fetchAbilityNodeSetting = async () => {
                try {
                    const response = await MapWorldData.getMapWorldData(fileId);
                    if (response.data?.success && response.data.abilityNodeSetting) {
                        setLocalAbilityNodeSetting(response.data.abilityNodeSetting);
                    }
                } catch (error) {
                    console.warn('获取 abilityNodeSetting 失败，使用 prop 值:', error);
                    // 如果请求失败，使用 prop 值
                    setLocalAbilityNodeSetting(propAbilityNodeSetting);
                }
            };
            fetchAbilityNodeSetting();
        }
    }, [isActive, fileId]);

    // 当 prop 更新时，同步更新本地状态
    useEffect(() => {
        setLocalAbilityNodeSetting(propAbilityNodeSetting);
    }, [propAbilityNodeSetting]);

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

    // 使用 ref 来存储最新的状态值，避免闭包问题
    const hasUnsavedChangesRef = useRef(hasUnsavedChanges);
    const isBlockingSwitchRef = useRef(isBlockingSwitch);
    
    useEffect(() => {
        hasUnsavedChangesRef.current = hasUnsavedChanges;
    }, [hasUnsavedChanges]);
    
    useEffect(() => {
        isBlockingSwitchRef.current = isBlockingSwitch;
    }, [isBlockingSwitch]);

    // 检查是否可以切换 tab
    const checkBeforeSwitchTab = React.useCallback((targetTab: 'subScene' | 'scene' | 'map') => {
        // 检查当前 tab 是否有未保存的修改
        if (mapTab === 'subScene' && hasUnsavedChanges) {
            setPendingAction({ type: 'switchTab', targetTab });
            setSaveConfirmModalOpen(true);
            setIsBlockingSwitch(true);
            return false;
        }
        if (mapTab === 'scene' && hasUnsavedChangesScene) {
            setPendingAction({ type: 'switchTab', targetTab });
            setSaveConfirmModalOpen(true);
            setIsBlockingSwitch(true);
            return false;
        }
        if (mapTab === 'map' && hasUnsavedChangesMap) {
            setPendingAction({ type: 'switchTab', targetTab });
            setSaveConfirmModalOpen(true);
            setIsBlockingSwitch(true);
            return false;
        }
        return true;
    }, [hasUnsavedChanges, hasUnsavedChangesScene, hasUnsavedChangesMap, mapTab]);

    // 执行待处理的操作
    const executePendingAction = React.useCallback(() => {
        if (!pendingAction) return;

        if (pendingAction.type === 'switchTab' && pendingAction.targetTab) {
            setMapTab(pendingAction.targetTab as 'subScene' | 'scene' | 'map');
        }

        setPendingAction(null);
    }, [pendingAction]);

    // 暴露给父组件的方法，用于在切换面板前检查
    useImperativeHandle(ref, () => ({
        checkBeforeLeave: async () => {
            const isBlocking = isBlockingSwitchRef.current;
            
            // 检查当前 tab 是否有未保存的修改
            if (mapTab === 'subScene' && hasUnsavedChangesRef.current && !isBlocking) {
                setPendingAction({ type: 'switchPanel' });
                setSaveConfirmModalOpen(true);
                setIsBlockingSwitch(true);
                return false;
            }
            if (mapTab === 'scene' && sceneTabRef.current?.checkUnsavedChanges()) {
                setPendingAction({ type: 'switchPanel' });
                setSaveConfirmModalOpen(true);
                setIsBlockingSwitch(true);
                return false;
            }
            if (mapTab === 'map' && mapTabRef.current?.checkUnsavedChanges()) {
                setPendingAction({ type: 'switchPanel' });
                setSaveConfirmModalOpen(true);
                setIsBlockingSwitch(true);
                return false;
            }
            
            if (isBlocking) {
                return false;
            }
            
            return true;
        },
    }), [mapTab]);

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
                        onClick={() => {
                            if (checkBeforeSwitchTab(tab.id as 'subScene' | 'scene' | 'map')) {
                                setMapTab(tab.id as 'subScene' | 'scene' | 'map');
                            }
                        }}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className={`${styles.mapEditor} ${mapTab === 'subScene' ? styles.mapEditorThreeColumns : ''}`}>
                {mapTab === 'subScene' && (
                    <SubSceneTab
                        ref={subSceneTabRef}
                        subScenes={subScenes}
                        sceneSetting={sceneSetting}
                        fileId={fileId}
                        onDataChange={onDataChange}
                        isActive={isActive}
                        abilityNodeSetting={localAbilityNodeSetting}
                        onHasUnsavedChanges={setHasUnsavedChanges}
                    />
                )}
                {mapTab === 'scene' && (
                    <SceneTab
                        ref={sceneTabRef}
                        sceneSetting={sceneSetting}
                        fileId={fileId}
                        onDataChange={onDataChange}
                        onHasUnsavedChanges={setHasUnsavedChangesScene}
                    />
                )}
                {mapTab === 'map' && (
                    <MapTab
                        ref={mapTabRef}
                        sceneSetting={sceneSetting}
                        worldMapImage={worldMapImage}
                        fileId={fileId}
                        onDataChange={onDataChange}
                        isActive={isActive}
                        onHasUnsavedChanges={setHasUnsavedChangesMap}
                    />
                )}

                {mapTab === 'scene' && (
                    <SceneTab
                        sceneSetting={sceneSetting}
                        fileId={fileId}
                        onDataChange={onDataChange}
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

            {/* 保存确认弹窗 */}
            <SaveConfirmModal
                isOpen={saveConfirmModalOpen}
                onSave={async () => {
                    // 根据当前 tab 调用对应的保存方法
                    let saveSuccess = false;
                    if (mapTab === 'subScene' && subSceneTabRef.current?.save) {
                        try {
                            await subSceneTabRef.current.save();
                            saveSuccess = true;
                        } catch (error) {
                            console.error('保存失败:', error);
                            toast.error('保存失败，请重试');
                        }
                    } else if (mapTab === 'scene' && sceneTabRef.current?.save) {
                        try {
                            await sceneTabRef.current.save();
                            saveSuccess = true;
                        } catch (error) {
                            console.error('保存失败:', error);
                            toast.error('保存失败，请重试');
                        }
                    } else if (mapTab === 'map' && mapTabRef.current?.save) {
                        try {
                            await mapTabRef.current.save();
                            saveSuccess = true;
                        } catch (error) {
                            console.error('保存失败:', error);
                            toast.error('保存失败，请重试');
                        }
                    } else {
                        saveSuccess = true; // 没有保存方法，直接允许切换
                    }
                    
                    if (saveSuccess) {
                        setSaveConfirmModalOpen(false);
                        setIsBlockingSwitch(false);
                        executePendingAction();
                    }
                }}
                onDiscard={() => {
                    setSaveConfirmModalOpen(false);
                    setHasUnsavedChanges(false);
                    setIsBlockingSwitch(false);
                    executePendingAction();
                }}
                onCancel={() => {
                    setSaveConfirmModalOpen(false);
                    setPendingAction(null);
                    setIsBlockingSwitch(false);
                }}
                title="未保存的修改"
                message="您有未保存的NPC位置修改，是否要保存？"
                saveButtonText="保存"
                discardButtonText="不保存"
            />
        </div>
    );
});

MapPanel.displayName = 'MapPanel';

export default MapPanel;
