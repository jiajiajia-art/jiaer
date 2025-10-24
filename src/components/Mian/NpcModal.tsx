import React from 'react';
import styles from './NpcModal.module.css';

interface NpcModalProps {
    isOpen: boolean;
    onClose: () => void;
    npc: any | null;
    onStartChat: (npc: any) => void;
    scenes?: Record<string, any>;
}

const NpcModal: React.FC<NpcModalProps> = ({
    isOpen,
    onClose,
    npc,
    onStartChat,
    scenes = {}
}) => {
    if (!isOpen || !npc) return null;
    console.log('npc', npc);
    console.log('scenes', scenes);
    
    return (
        <div className={styles.modal} onClick={onClose}>
            <div className={`${styles.modalContent} ${styles.npcModalContent}`} onClick={(e) => e.stopPropagation()}>
                <button className={styles.closeNpcModal} onClick={onClose}>×</button>
                
                <div className={styles.npcDetailHeader}>
                    <img 
                        src={`http://localhost:3000${npc.icon}` || '/data/avatars/default.png'} 
                        alt="NPC头像" 
                        className={styles.npcDetailAvatar} 
                    />
                    <div className={styles.npcDetailInfo}>
                        <h2>{npc.name || 'NPC'}</h2>
                        <div className={styles.npcDetailStats}>
                            <span className={styles.npcDetailJob}>
                                {npc.job || npc.type || '职业'}
                            </span>
                            <span className={styles.npcDetailGender}>
                                {npc.gender || '性别'}
                            </span>
                            <span className={styles.npcDetailAge}>
                                {npc.age ? `${npc.age}岁` : '年龄'}
                            </span>
                        </div>
                    </div>
                </div>

                <div className={styles.npcDetailDescription}>
                    <p>{npc.description || '描述'}</p>
                </div>

                <div className={styles.npcRelationships}>
                    <h3>人际关系</h3>
                    <div className={styles.relationshipsGrid}>
                        {npc.relationships && Object.keys(npc.relationships).length > 0 ? (
                            Object.entries(npc.relationships).map(([npcId, relation]: any) => {
                                const allNPCs: Record<string, any> = {};
                                Object.values(scenes).forEach((sc: any) => 
                                    (sc.npcs || []).forEach((n: any) => (allNPCs[n.id] = n))
                                );
                                const related = allNPCs[npcId];
                                if (!related) return null;
                                
                                return (
                                    <div key={npcId} className={styles.relationshipCard}>
                                        <img 
                                            src={`http://localhost:3000${related.avatar}` || '/data/avatars/default.png'} 
                                            alt={related.name} 
                                        />
                                        <div className={styles.relationshipName}>{related.name}</div>
                                        <div className={styles.relationshipType}>{relation}</div>
                                    </div>
                                );
                            })
                        ) : (
                            <p className={styles.noRelationships}>暂无人际关系</p>
                        )}
                    </div>
                </div>

                <div className={styles.npcActions}>
                    <button 
                        className={styles.chatWithNpcBtn} 
                        onClick={() => onStartChat(npc)}
                    >
                        💬 与TA对话
                    </button>
                </div>
            </div>
        </div>
    );
};

export default NpcModal;
