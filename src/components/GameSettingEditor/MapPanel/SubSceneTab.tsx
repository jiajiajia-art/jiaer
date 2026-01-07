import React from 'react';
import styles from './SubSceneTab.module.css';
import sharedStyles from './shared.module.css';
import FunctionalNPCList from './FunctionalNPCList';
import { useSubSceneTab } from './hooks/useSubSceneTab';
import type { SubScene, Scene } from './types';
import type { AbilityNodeSetting } from '../../../api/worldInteraction/worldInteractionApi.type';
import {
    DEFAULT_MAP_IMAGE,
    DEFAULT_NPC_IMAGE,
    BASE_NPC_WIDTH,
    BASE_NPC_HEIGHT,
    MAX_NPCS,
    DEFAULT_Z_INDEX,
    MIN_Z_INDEX,
    MAX_Z_INDEX,
} from './constants';
import { getImageUrl } from '../../../utils/constants';
import worldEditor from '../../../api/worldInteraction/worldEditor';
import type { NpcSlot } from '../../../api/worldInteraction/worldEditor.type';
import toast from 'react-hot-toast';

interface SubSceneTabProps {
    subScenes: SubScene[];
    sceneSetting?: { scenes?: Scene[] };
    fileId: string;
    onDataChange?: () => void;
    isActive?: boolean;
    sceneImageUrl: string;
    abilityNodeSetting?: AbilityNodeSetting;
}

const SubSceneTab: React.FC<SubSceneTabProps> = ({
    subScenes,
    sceneSetting,
    fileId,
    onDataChange,
    isActive,
    sceneImageUrl,
    abilityNodeSetting,
}) => {
    const {
        selectedSubSceneId,
        setSelectedSubSceneId,
        placedNPCs,
        draggingNPCId,
        selectedNPCId,
        setSelectedNPCId,
        previewRef,
        imageRef,
        currentSceneIdRef,
        currentSubSceneIdRef,
        setImageLoaded,
        isSubSceneContentReady,
        handleDragStart,
        handleDrop,
        handleDragOver,
        handleDragEnd,
        handleNPCMouseDown,
        handleResizeStart,
        handleRemoveNPC,
        handleChangeZIndex,
        handleSetZIndex,
        getNPCPosition,
    } = useSubSceneTab({ subScenes, sceneSetting, isActive });

    const handleConfirm = React.useCallback(async () => {
        if (!currentSceneIdRef.current || !currentSubSceneIdRef.current) {
            alert('请先选择子场景');
            return;
        }

        if (!fileId) {
            alert('文件ID不存在，请先上传文件');
            return;
        }

        const npcSlots: NpcSlot[] = placedNPCs.map(npc => ({
            position: [npc.x, npc.y] as [number, number],
            zoom: npc.zIndex ?? DEFAULT_Z_INDEX,
        }));

        try {
            const response = await worldEditor.setZoomNpc(
                fileId,
                currentSceneIdRef.current,
                currentSubSceneIdRef.current,
                npcSlots
            );

            if (response.data.success) {
                toast.success('NPC位置和层级已保存');
                if (onDataChange) {
                    onDataChange();
                }
            }
        } catch (error: any) {
            console.error('保存失败:', error);
            toast.error('保存失败：' + (error.message || '请检查网络连接'));
        }
    }, [placedNPCs, fileId, onDataChange, currentSceneIdRef, currentSubSceneIdRef]);

    return (
        <>
            {/* 左侧：功能性NPC列表 */}
            <div className={sharedStyles.mapLeftSidebar}>
                <FunctionalNPCList abilityNodeSetting={abilityNodeSetting} />
            </div>

            {/* 中间：拖拽区域 */}
            <div
                ref={previewRef}
                className={sharedStyles.mapPreview}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
            >
                <img
                    ref={imageRef}
                    src={sceneImageUrl}
                    alt="子场景预览"
                    className={sharedStyles.sceneImage}
                    draggable={false}
                    onLoad={() => {
                        requestAnimationFrame(() => {
                            requestAnimationFrame(() => {
                                const container = previewRef.current;
                                if (container) {
                                    const rect = container.getBoundingClientRect();
                                    if (rect.width > 0 && rect.height > 0) {
                                        setImageLoaded(true);
                                    } else {
                                        setTimeout(() => {
                                            const rect2 = container.getBoundingClientRect();
                                            if (rect2.width > 0 && rect2.height > 0) {
                                                setImageLoaded(true);
                                            }
                                        }, 100);
                                    }
                                }
                            });
                        });
                    }}
                    onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        if (target.src !== DEFAULT_MAP_IMAGE) {
                            target.src = DEFAULT_MAP_IMAGE;
                        } else {
                            setImageLoaded(true);
                        }
                    }}
                />

                {/* 加载遮罩 */}
                {!isSubSceneContentReady && (
                    <div className={sharedStyles.loadingOverlay}>
                        <div className={sharedStyles.loadingSpinner}></div>
                        <div className={sharedStyles.loadingText}>正在加载场景...</div>
                    </div>
                )}

                {/* 只在内容准备好时才渲染NPC（按层级排序） */}
                {isSubSceneContentReady &&
                    [...placedNPCs]
                        .sort((a, b) => (a.zIndex ?? DEFAULT_Z_INDEX) - (b.zIndex ?? DEFAULT_Z_INDEX))
                        .map(npc => {
                            const pos = getNPCPosition(npc);
                            const isSelected = selectedNPCId === npc.id;
                            const isDragging = draggingNPCId === npc.id;

                            if (!pos.visible) return null;

                            return (
                                <div
                                    key={npc.id}
                                    className={`${styles.placedNPC} ${npc.type === 'button' ? styles.placedNPCButton : ''} ${isSelected ? sharedStyles.placedNPCSelected : ''} ${isDragging ? sharedStyles.placedNPCDragging : ''}`}
                                    style={{
                                        left: `${pos.left}px`,
                                        top: `${pos.top}px`,
                                        width: npc.type === 'button' ? 'auto' : `${pos.width}px`,
                                        height: npc.type === 'button' ? 'auto' : `${pos.height}px`,
                                        opacity: pos.visible ? 1 : 0,
                                        transition: 'opacity 0.3s ease',
                                        zIndex: npc.zIndex ?? DEFAULT_Z_INDEX,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                    onMouseDown={(e) => handleNPCMouseDown(e, npc.id)}
                                    onClick={() => setSelectedNPCId(npc.id)}
                                >
                                    {(() => {
                                        // 按钮型NPC：显示文字
                                        if (npc.nodeId && npc.type === 'button' && npc.name) {
                                            return (
                                                <div className={styles.npcButtonText}>
                                                    {npc.name}
                                                </div>
                                            );
                                        }
                                        // 立绘型NPC：显示真实图片
                                        if (npc.nodeId && npc.imagePath && npc.type === 'illustration') {
                                            return (
                                                <img
                                                    src={getImageUrl(npc.imagePath)}
                                                    alt={npc.authorNote || '功能性NPC'}
                                                    draggable={false}
                                                    className={styles.npcImage}
                                                    onError={(e) => {
                                                        (e.target as HTMLImageElement).src = DEFAULT_NPC_IMAGE;
                                                    }}
                                                />
                                            );
                                        }
                                        // 默认显示默认图片
                                        return (
                                            <img
                                                src={DEFAULT_NPC_IMAGE}
                                                alt="NPC 立绘"
                                                draggable={false}
                                                className={styles.npcImage}
                                            />
                                        );
                                    })()}
                                    {isSelected && (
                                        <>
                                            {/* 四个角的调整手柄 */}
                                            <div
                                                className={`${styles.resizeHandle} ${styles.resizeHandleNW}`}
                                                onMouseDown={(e) => handleResizeStart(e, npc.id, 'nw')}
                                            />
                                            <div
                                                className={`${styles.resizeHandle} ${styles.resizeHandleNE}`}
                                                onMouseDown={(e) => handleResizeStart(e, npc.id, 'ne')}
                                            />
                                            <div
                                                className={`${styles.resizeHandle} ${styles.resizeHandleSW}`}
                                                onMouseDown={(e) => handleResizeStart(e, npc.id, 'sw')}
                                            />
                                            <div
                                                className={`${styles.resizeHandle} ${styles.resizeHandleSE}`}
                                                onMouseDown={(e) => handleResizeStart(e, npc.id, 'se')}
                                            />
                                            {/* 控制按钮 */}
                                            <div className={styles.npcControls}>
                                                {/* 层级控制 */}
                                                <div className={styles.zIndexControl}>
                                                    <span className={styles.zIndexLabel}>层级:</span>
                                                    <button
                                                        className={styles.zIndexBtnSmall}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleChangeZIndex(npc.id, -1);
                                                        }}
                                                        disabled={(npc.zIndex ?? DEFAULT_Z_INDEX) <= MIN_Z_INDEX}
                                                        title="降低层级"
                                                    >
                                                        -
                                                    </button>
                                                    <input
                                                        type="number"
                                                        className={styles.zIndexInputSmall}
                                                        value={npc.zIndex ?? DEFAULT_Z_INDEX}
                                                        min={MIN_Z_INDEX}
                                                        max={MAX_Z_INDEX}
                                                        onClick={(e) => e.stopPropagation()}
                                                        onChange={(e) => {
                                                            const value = parseInt(e.target.value, 10);
                                                            if (!isNaN(value)) {
                                                                handleSetZIndex(npc.id, value);
                                                            }
                                                        }}
                                                    />
                                                    <button
                                                        className={styles.zIndexBtnSmall}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleChangeZIndex(npc.id, 1);
                                                        }}
                                                        disabled={(npc.zIndex ?? DEFAULT_Z_INDEX) >= MAX_Z_INDEX}
                                                        title="提高层级"
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                                {/* 移除按钮 */}
                                                <button
                                                    className={styles.removeBtn}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleRemoveNPC(npc.id);
                                                    }}
                                                >
                                                    移除
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            );
                        })}

                <div className={sharedStyles.mapOverlayHint}>
                    拖拽 NPC 到场景，支持缩放（已放置: {placedNPCs.length}/{MAX_NPCS}）
                    {selectedNPCId && (
                        <span className={sharedStyles.hintSelected}> • 拖拽四个角调整大小</span>
                    )}
                </div>
            </div>

            {/* 右侧：原有的侧边栏内容 */}
            <div className={sharedStyles.mapSidebar}>
                <div className={sharedStyles.subSceneList}>
                    <h4>子场景列表</h4>
                    <div className={sharedStyles.subSceneItems}>
                        {subScenes.length === 0 && (
                            <div className={sharedStyles.subSceneDesc}>暂无子场景，请先上传并解析数据</div>
                        )}
                        {subScenes.map((sub) => (
                            <div
                                key={sub.id}
                                className={`${sharedStyles.subSceneItem} ${selectedSubSceneId === sub.id ? sharedStyles.subSceneItemActive : ''}`}
                                onClick={() => setSelectedSubSceneId(sub.id)}
                            >
                                <div className={sharedStyles.subSceneThumbWrapper}>
                                    {sub.image && sub.image.trim() !== '' ? (
                                        <img
                                            src={getImageUrl(sub.image)}
                                            alt={sub.name}
                                            className={sharedStyles.subSceneThumbImage}
                                            onError={(e) => {
                                                const target = e.target as HTMLImageElement;
                                                target.onerror = null;
                                                target.style.display = 'none';
                                                const placeholder = target.nextElementSibling as HTMLElement;
                                                if (placeholder) placeholder.style.display = 'block';
                                            }}
                                        />
                                    ) : null}
                                    <div
                                        className={sharedStyles.subSceneThumb}
                                        style={{
                                            display: sub.image && sub.image.trim() !== '' ? 'none' : 'block',
                                            backgroundImage:
                                                !sub.image || sub.image.trim() === ''
                                                    ? `url('${DEFAULT_MAP_IMAGE}')`
                                                    : undefined,
                                            backgroundSize: 'cover',
                                            backgroundPosition: 'center',
                                        }}
                                    />
                                </div>
                                <div className={sharedStyles.subSceneMeta}>
                                    <div className={sharedStyles.subSceneName}>{sub.name}</div>
                                    {sub.parentName && (
                                        <div className={sharedStyles.subSceneParent}>父场景：{sub.parentName}</div>
                                    )}
                                    {sub.description && (
                                        <div className={sharedStyles.subSceneDesc} title={sub.description}>
                                            {sub.description}
                                        </div>
                                    )}
                                    {sub.npcs_slots && sub.npcs_slots.length > 0 && (
                                        <div className={sharedStyles.npcCount}>已有NPC: {sub.npcs_slots.length}个</div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className={styles.npcPalette}>
                    <h4>NPC 立绘（拖拽）</h4>
                    <div className={styles.npcItems}>
                        <div
                            className={`${styles.npcItem} ${placedNPCs.length >= MAX_NPCS ? styles.npcItemDisabled : ''}`}
                            draggable={placedNPCs.length < MAX_NPCS}
                            onDragStart={handleDragStart}
                        >
                            <img
                                src={DEFAULT_NPC_IMAGE}
                                alt="NPC 立绘"
                                className={styles.defaultNpcImage}
                                draggable={false}
                            />
                            <div className={styles.npcName}>NPC 立绘</div>
                        </div>
                    </div>
                    <div className={styles.npcHint}>
                        可拖拽一张立绘至场景，单场景最多放置 {MAX_NPCS} 个
                        <br />
                        基础尺寸: {BASE_NPC_WIDTH}×{BASE_NPC_HEIGHT}px
                    </div>
                </div>

                <div className={sharedStyles.confirmSection}>
                    <button
                        className={sharedStyles.confirmBtn}
                        onClick={handleConfirm}
                        disabled={placedNPCs.length === 0 || !fileId}
                    >
                        确认保存 NPC 位置
                    </button>
                    <div className={sharedStyles.confirmHint}>
                        {placedNPCs.length === 0
                            ? '请先放置NPC到场景中'
                            : `将保存 ${placedNPCs.length} 个NPC的位置和层级信息`}
                    </div>
                </div>
            </div>
        </>
    );
};

export default SubSceneTab;

