import React from 'react';
import styles from './FunctionalNPCList.module.css';
import type { AbilityNodeSetting } from '../../../api/worldInteraction/worldInteractionApi.type';
import { getImageUrl } from '../../../utils/constants';

interface FunctionalNPCListProps {
    abilityNodeSetting?: AbilityNodeSetting;
}

const FunctionalNPCList: React.FC<FunctionalNPCListProps> = ({ abilityNodeSetting }) => {
    const abilityNodes = abilityNodeSetting?.abilityNodes || [];

    if (abilityNodes.length === 0) {
        return (
            <div className={styles.functionalNPCList}>
                <h4>功能性NPC</h4>
                <div className={styles.emptyState}>暂无功能性NPC</div>
            </div>
        );
    }
    
    return (
        <div className={styles.functionalNPCList}>
            <h4>功能性NPC</h4>
            <div className={styles.functionalNPCItems}>
                {abilityNodes.map((abilityNode) => {
                    // 按钮型NPC如果没有文字，不显示图片
                    const shouldShowImage = abilityNode.type === 'illustration' 
                        ? !!abilityNode.imagePath 
                        : (abilityNode.type === 'button' && abilityNode.name ? !!abilityNode.imagePath : false);
                    
                    // 判断是否可以拖拽：立绘型需要有图片，按钮型需要有文字
                    const canDrag = abilityNode.type === 'illustration' 
                        ? !!abilityNode.imagePath 
                        : (abilityNode.type === 'button' && !!abilityNode.name);
                    
                    return (
                        <div 
                            key={abilityNode.node_id} 
                            className={`${styles.functionalNPCItem} ${!shouldShowImage ? styles.functionalNPCItemNoImage : ''}`}
                            draggable={canDrag}
                            onDragStart={(e) => {
                                if (!canDrag) {
                                    e.preventDefault();
                                    return;
                                }
                                
                                // 清理之前可能残留的数据
                                e.dataTransfer.clearData();
                                
                                // 传递功能性NPC数据
                                e.dataTransfer.setData('application/json', JSON.stringify({
                                    nodeId: abilityNode.node_id,
                                    imagePath: abilityNode.imagePath,
                                    type: abilityNode.type,
                                    name: abilityNode.name,
                                    authorNote: abilityNode.authorNote,
                                }));
                                e.dataTransfer.effectAllowed = 'copy';
                                
                                // 设置拖拽预览
                                if (abilityNode.type === 'illustration' && abilityNode.imagePath) {
                                    // 立绘型：使用真实图片作为拖拽预览
                                    const imgElement = e.currentTarget.querySelector('img') as HTMLImageElement | null;
                                    if (imgElement && imgElement.complete && imgElement.naturalWidth > 0) {
                                        // 图片已加载，直接使用
                                        const canvas = document.createElement('canvas');
                                        const maxSize = 200;
                                        const scale = Math.min(
                                            maxSize / imgElement.naturalWidth,
                                            maxSize / imgElement.naturalHeight,
                                            1
                                        );
                                        canvas.width = imgElement.naturalWidth * scale;
                                        canvas.height = imgElement.naturalHeight * scale;
                                        const ctx = canvas.getContext('2d');
                                        if (ctx) {
                                            ctx.drawImage(imgElement, 0, 0, canvas.width, canvas.height);
                                            e.dataTransfer.setDragImage(canvas, canvas.width / 2, canvas.height / 2);
                                        }
                                    } else {
                                        // 图片未加载，创建临时图片
                                        const img = new Image();
                                        img.crossOrigin = 'anonymous';
                                        img.src = getImageUrl(abilityNode.imagePath);
                                        img.onload = () => {
                                            const canvas = document.createElement('canvas');
                                            const maxSize = 200;
                                            const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
                                            canvas.width = img.width * scale;
                                            canvas.height = img.height * scale;
                                            const ctx = canvas.getContext('2d');
                                            if (ctx) {
                                                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                                                e.dataTransfer.setDragImage(canvas, canvas.width / 2, canvas.height / 2);
                                            }
                                        };
                                    }
                                } else if (abilityNode.type === 'button' && abilityNode.name) {
                                    // 按钮型：显示文字预览
                                    const dragPreview = document.createElement('div');
                                    dragPreview.style.cssText = `
                                        position: absolute;
                                        top: -1000px;
                                        left: -1000px;
                                        padding: 8px 16px;
                                        background: rgba(224, 61, 75, 0.9);
                                        color: white;
                                        border-radius: 8px;
                                        font-size: 14px;
                                        font-weight: 600;
                                        white-space: nowrap;
                                        pointer-events: none;
                                    `;
                                    dragPreview.textContent = abilityNode.name;
                                    document.body.appendChild(dragPreview);
                                    requestAnimationFrame(() => {
                                        e.dataTransfer.setDragImage(
                                            dragPreview,
                                            dragPreview.offsetWidth / 2,
                                            dragPreview.offsetHeight / 2
                                        );
                                        setTimeout(() => {
                                            if (document.body.contains(dragPreview)) {
                                                document.body.removeChild(dragPreview);
                                            }
                                        }, 0);
                                    });
                                }
                            }}
                        >
                            {shouldShowImage && (
                        <div className={styles.functionalNPCThumbWrapper}>
                                <img
                                    src={getImageUrl(abilityNode.imagePath)}
                                        alt={abilityNode.authorNote || '功能性NPC'}
                                    className={styles.functionalNPCThumbImage}
                                        draggable={false}
                                    onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.onerror = null;
                                        target.style.display = 'none';
                                        const placeholder = target.nextElementSibling as HTMLElement;
                                        if (placeholder) placeholder.style.display = 'block';
                                    }}
                                />
                            <div
                                className={styles.functionalNPCThumb}
                                style={{
                                            display: 'none',
                                            backgroundImage: `url('${import.meta.env.BASE_URL}data/assets/创作界面切图/defaultNpc.png')`,
                                    backgroundSize: 'cover',
                                    backgroundPosition: 'center',
                                }}
                            />
                        </div>
                            )}
                        <div className={styles.functionalNPCMeta}>
                                <div className={styles.functionalNPCName}>{abilityNode.authorNote || '未命名NPC'}</div>
                                <div className={styles.functionalNPCType}>
                                    {abilityNode.type === 'illustration' ? '立绘型' : abilityNode.type === 'button' ? '按钮型' : abilityNode.type || '功能性NPC'}
                                </div>
                                {abilityNode.type === 'button' && abilityNode.name && (
                                    <div className={styles.functionalNPCButtonText}>
                                        按钮文字: {abilityNode.name}
                            </div>
                                )}
                            {abilityNode.actions && abilityNode.actions.length > 0 && (
                                <div className={styles.functionalNPCButtonText}>
                                    功能: {abilityNode.actions.map(a => a.name).join(', ')}
                                </div>
                            )}
                        </div>
                    </div>
                    );
                })}
            </div>
        </div>
    );
};

export default FunctionalNPCList;

