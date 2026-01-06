import React, { useEffect, useState } from 'react';
import styles from './FunctionalNPCList.module.css';
import type { FunctionalNPC } from '../FunctionalNPCsPanel/types';
import { getImageUrl } from '../../../utils/constants';
import worldEditor from '../../../api/worldInteraction/worldEditor';

interface FunctionalNPCListProps {
    fileId: string;
}

const FunctionalNPCList: React.FC<FunctionalNPCListProps> = ({ fileId }) => {
    const [functionalNPCs, setFunctionalNPCs] = useState<FunctionalNPC[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!fileId) return;

        const loadFunctionalNPCs = async () => {
            setLoading(true);
            try {
                const response = await worldEditor.getFunctionalNPCs(fileId);
                if (response.data.success && (response.data as any).functionalNPCs) {
                    setFunctionalNPCs((response.data as any).functionalNPCs);
                }
            } catch (error) {
                console.error('加载功能性NPC失败:', error);
            } finally {
                setLoading(false);
            }
        };

        loadFunctionalNPCs();
    }, [fileId]);

    if (loading) {
        return (
            <div className={styles.functionalNPCList}>
                <h4>功能性NPC</h4>
                <div className={styles.loading}>加载中...</div>
            </div>
        );
    }

    if (functionalNPCs.length === 0) {
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
                {functionalNPCs.map((npc) => (
                    <div key={npc.id} className={styles.functionalNPCItem}>
                        <div className={styles.functionalNPCThumbWrapper}>
                            {npc.type === 'portrait' && npc.image ? (
                                <img
                                    src={getImageUrl(npc.image)}
                                    alt={npc.name}
                                    className={styles.functionalNPCThumbImage}
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
                                className={styles.functionalNPCThumb}
                                style={{
                                    display: (npc.type === 'portrait' && npc.image) ? 'none' : 'block',
                                    backgroundImage: (npc.type === 'button' || !npc.image) 
                                        ? `url('${import.meta.env.BASE_URL}data/assets/创作界面切图/defaultNpc.png')` 
                                        : undefined,
                                    backgroundSize: 'cover',
                                    backgroundPosition: 'center',
                                }}
                            />
                        </div>
                        <div className={styles.functionalNPCMeta}>
                            <div className={styles.functionalNPCName}>{npc.name}</div>
                            <div className={styles.functionalNPCType}>
                                {npc.type === 'portrait' ? '立绘型' : '按钮型'}
                            </div>
                            {npc.type === 'button' && npc.buttonText && (
                                <div className={styles.functionalNPCButtonText}>
                                    按钮: {npc.buttonText}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default FunctionalNPCList;

