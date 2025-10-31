import React from 'react';
import styles from './NpcModal.module.css';
import { HOST_ADDRESS } from '../../config';

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
                <button className={styles.closeNpcModal} onClick={onClose}>
                    <img src="/data/asset/关闭按钮.png" alt="关闭" />
                </button>
                <div className={styles.npcDetailGoodness}>
                    <p>{npc.relationships}</p>
                </div>
                
                <div className={styles.npcDetailHeader}>
                    <img 
                        src={`${HOST_ADDRESS}${npc.icon}` || '/data/avatars/default.png'} 
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
