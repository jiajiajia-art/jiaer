import React from 'react';
import styles from './FunctionalNPCsPanel.module.css';
import { RiDeleteBin5Line } from 'react-icons/ri';
import type { FunctionalNPC } from './types';

interface FunctionalNPCListProps {
    npcs: FunctionalNPC[];
    activeNPCId: string | null;
    onNPCClick: (npcId: string) => void;
    onDeleteClick: (npcId: string, e: React.MouseEvent) => void;
    onCreateClick: () => void;
}

const FunctionalNPCList: React.FC<FunctionalNPCListProps> = ({
    npcs,
    activeNPCId,
    onNPCClick,
    onDeleteClick,
    onCreateClick,
}) => {
    const DEFAULT_NPC_IMAGE = '';

    return (
        <div className={styles.npcList}>
            <div className={styles.npcListHeader}>
                <h3>功能性NPC</h3>
                <button className={styles.ghostSmall} onClick={onCreateClick}>
                    + 创建
                </button>
            </div>
            <div className={styles.npcListContent}>
                {npcs.length === 0 ? (
                    <div className={styles.emptyState}>
                        <p>暂无功能性NPC</p>
                        <p className={styles.emptyHint}>点击"创建"添加新的功能性NPC</p>
                    </div>
                ) : (
                    npcs.map((npc) => {
                        const isActive = activeNPCId === npc.id;
                        return (
                            <div
                                key={npc.id}
                                className={`${styles.npcCard} ${isActive ? styles.npcCardActive : ''}`}
                                onClick={() => onNPCClick(npc.id)}
                            >
                                <div className={styles.npcCardThumbnail}>
                                    <img
                                        src={npc.image || DEFAULT_NPC_IMAGE}
                                        alt={npc.name}
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).src = DEFAULT_NPC_IMAGE;
                                        }}
                                    />
                                </div>
                                <div className={styles.npcCardInfo}>
                                    <div className={styles.npcCardName}>{npc.name}</div>
                                    <div className={styles.npcCardType}>
                                        {npc.type === 'portrait' ? '立绘型' : '按钮型'}
                                    </div>
                                </div>
                                <button
                                    className={styles.npcCardDelete}
                                    onClick={(e) => onDeleteClick(npc.id, e)}
                                    aria-label="删除"
                                >
                                    <RiDeleteBin5Line size={18} />
                                </button>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default FunctionalNPCList;