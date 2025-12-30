import React, { useState } from 'react';
import styles from './FunctionalNPCsPanel.module.css';
import FunctionalNPCList from './FunctionalNPCList';
import FunctionalNPCDetail from './FunctionalNPCDetail';
import ConfirmModal from '../../GoodsModal/ConfirmModal';
import { toast } from 'react-hot-toast';
import type { FunctionalNPC } from './types';

interface FunctionalNPCsPanelProps {
    fileId?: string | null;
    mode?: string;
    onDataChange?: () => void;
}

const FunctionalNPCsPanel: React.FC<FunctionalNPCsPanelProps> = ({
    onDataChange,
}) => {
    const DEFAULT_NPC_IMAGE = '';

    const [npcs, setNPCs] = useState<FunctionalNPC[]>([]);
    const [activeNPCId, setActiveNPCId] = useState<string | null>(null);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [npcToDelete, setNpcToDelete] = useState<string | null>(null);
    const [isNewNPC, setIsNewNPC] = useState(false);

    // 创建新的功能性NPC
    const handleCreateNPC = () => {
        const newNPC: FunctionalNPC = {
            id: `npc-${Date.now()}`,
            name: '新建功能',
            type: 'portrait', // 默认立绘型，后续在详情里切换
            image: DEFAULT_NPC_IMAGE,
            hasOptions: false,
            buttonText: '',
            options: [],
        };

        setNPCs(prev => [...prev, newNPC]);
        setActiveNPCId(newNPC.id);
        setIsNewNPC(true);
        toast.success('已创建立绘型功能');
    };

    // 删除功能性NPC
    const handleDeleteClick = (npcId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setNpcToDelete(npcId);
        setDeleteModalOpen(true);
    };

    const handleConfirmDelete = () => {
        if (!npcToDelete) return;

        setNPCs(prev => prev.filter(npc => npc.id !== npcToDelete));
        if (activeNPCId === npcToDelete) {
            const remainingNPCs = npcs.filter(npc => npc.id !== npcToDelete);
            setActiveNPCId(remainingNPCs.length > 0 ? remainingNPCs[0].id : null);
        }
        toast.success('删除成功');
        setDeleteModalOpen(false);
        setNpcToDelete(null);
        if (onDataChange) {
            onDataChange();
        }
    };

    const handleCancelDelete = () => {
        setDeleteModalOpen(false);
        setNpcToDelete(null);
    };

    const activeNPC = npcs.find(npc => npc.id === activeNPCId);

    return (
        <div className={styles.panelContent}>
            <div className={styles.panelHeader}>
                <div>
                    <p className={styles.eyebrow}>Step 6</p>
                    <h2>剧情事件插件</h2>
                    <p className={styles.subtitle}>
                        功能性NPC管理：创建和管理场景中的功能性NPC
                    </p>
                </div>
            </div>

            <div className={styles.npcLayout}>
                {/* 左侧：功能性NPC列表 */}
                <FunctionalNPCList
                    npcs={npcs}
                    activeNPCId={activeNPCId}
                    onNPCClick={(id) => {
                        setActiveNPCId(id);
                        setIsNewNPC(false);
                    }}
                    onDeleteClick={handleDeleteClick}
                    onCreateClick={handleCreateNPC}
                />

                {/* 右侧：详情菜单 */}
                <FunctionalNPCDetail
                    npc={activeNPC || null}
                    isNew={isNewNPC}
                    onSave={(updatedNPC) => {
                        setNPCs(prev =>
                            prev.map(npc => (npc.id === updatedNPC.id ? updatedNPC : npc)),
                        );
                        setIsNewNPC(false);
                        toast.success('已保存功能配置');
                        if (onDataChange) {
                            onDataChange();
                        }
                    }}
                />
            </div>

            <ConfirmModal
                isOpen={deleteModalOpen}
                onConfirm={handleConfirmDelete}
                onCancel={handleCancelDelete}
                title="删除功能性NPC"
                message={npcToDelete ? `确定要删除功能性NPC "${npcs.find(n => n.id === npcToDelete)?.name}" 吗？删除后不可恢复。` : '确定要删除此功能性NPC吗？删除后不可恢复。'}
                confirmButtonText="确认删除"
                cancelButtonText="取消"
            />
        </div>
    );
};

export default FunctionalNPCsPanel;

