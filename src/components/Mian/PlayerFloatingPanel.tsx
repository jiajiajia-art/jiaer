import React, { useState, useRef, useEffect } from 'react';
import styles from './PlayerFloatingPanel.module.css';
import { useGameStore } from '../../store/gameStore';
import ModeifyPlayer from '../../api/game/modifyPlayer';
import { FaCheckToSlot, FaPenToSquare } from 'react-icons/fa6';
import type { PlayerData } from '../../api/game/gameData';

interface PlayerFloatingPanelProps {
    isOpen: boolean;
    onClose?: () => void;
    player: PlayerData | null;
}

const PlayerFloatingPanel: React.FC<PlayerFloatingPanelProps> = ({
    isOpen,
    onClose,
    player
}) => {
    const { sessionId, updatePlayer } = useGameStore();

    // 玩家姓名编辑相关状态
    const [isEditingName, setIsEditingName] = useState(false);
    const [editingName, setEditingName] = useState('');
    const nameInputRef = useRef<HTMLInputElement>(null);

    // 当弹窗打开时，重置编辑状态
    useEffect(() => {
        if (!isOpen) {
            setIsEditingName(false);
            setEditingName('');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    // ==================== 玩家姓名编辑相关 ====================
    // 开始编辑姓名
    const handleStartEditName = () => {
        if (player?.profile?.name) {
            setEditingName(player.profile.name);
            setIsEditingName(true);
            // 使用 setTimeout 确保 DOM 更新后再聚焦
            setTimeout(() => {
                nameInputRef.current?.focus();
            }, 0);
        }
    };

    // 保存姓名
    const handleSaveName = async () => {
        if (!sessionId || !player || !player.profile) return;

        const trimmedName = editingName.trim();
        if (!trimmedName) {
            alert('姓名不能为空');
            return;
        }

        if (trimmedName === player.profile.name) {
            // 没有变化，直接取消编辑
            setIsEditingName(false);
            return;
        }

        try {
            // 调用 API 更新玩家姓名
            const response = await ModeifyPlayer.ModeifyPlayerName(sessionId, { name: trimmedName });

            if (response.data.success) {
                // 更新本地状态
                updatePlayer((prevPlayer) => {
                    if (!prevPlayer) return null;
                    return {
                        ...prevPlayer,
                        profile: {
                            ...prevPlayer.profile,
                            name: trimmedName,
                        },
                    };
                });
                setIsEditingName(false);
            } else {
                alert(response.data.message || '更新姓名失败');
            }
        } catch (error) {
            console.error('更新姓名失败:', error);
            alert('更新姓名失败，请稍后重试');
        }
    };

    // 处理输入框按键事件
    const handleNameInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleSaveName();
        } else if (e.key === 'Escape') {
            setIsEditingName(false);
            setEditingName('');
        }
    };

    console.log("角色信息",player);
    

    return (
        <div className={styles.playerFloatingPanel}>
            <div className={styles.playerPanelHeader}>
                <span className={styles.playerPanelHeaderLevel}>
                    <p className={styles.playerPanelHeaderLevelText}>LV.</p>
                    <p className={styles.playerPanelHeaderLevelValue}>{player?.stats?.level ?? 1}</p>
                </span>
                {isEditingName ? (
                    <div className={styles.playerNameInputWrapper}>
                        <input
                            ref={nameInputRef}
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onBlur={handleSaveName}
                            onKeyDown={handleNameInputKeyDown}
                            className={styles.playerNameInput}
                            maxLength={20}
                        />
                        <FaCheckToSlot
                            className={styles.playerNameSaveIcon}
                            onClick={handleSaveName}
                        />
                    </div>
                ) : (
                    <>
                        <h3 className={styles.playerNameDisplay}>
                            {player?.profile?.name || '未命名'}
                        </h3>
                        <FaPenToSquare
                            className={styles.playerNameIcon}
                            onClick={(e) => {
                                e.stopPropagation();
                                handleStartEditName();
                            }}
                        />
                    </>
                )}
                {onClose && (
                    <button className={styles.closePlayerBtn} onClick={onClose}>
                        <img src={`${import.meta.env.BASE_URL}data/asset/关闭按钮.png`} alt="关闭" />
                    </button>
                )}
            </div>
            <div className={styles.playerPanelContent}>
                <div className={styles.playerInfo}>
                    <div className={styles.playerAvatar}>
                        <img
                            src={player?.profile?.avatar || '/data/avatars/hunter.png'}
                            alt="角色头像"
                        />
                    </div>
                    <div className={styles.playerBasic}>
                        <p>
                            <span className={styles.label}>年龄:</span>
                            <span>{player?.profile?.age ?? '-'}</span>
                        </p>
                        <p>
                            <span className={styles.label}>性别:</span>
                            <span>{player?.profile?.gender ?? '-'}</span>
                        </p>
                        <p>
                            <span className={styles.label}>职业:</span>
                            <span>{player?.profile?.job ?? '-'}</span>
                        </p>
                    </div>
                </div>

            </div>
            <div className={styles.playerStats}>
                <div className={styles.playerStatsColumn}>
                    <p>
                        <span className={styles.label}>等级:</span>
                        <span>{player?.stats.level}</span>
                    </p>
                    <p>
                        <span className={styles.label}>防御:</span>
                        <span>{player?.stats?.defense ?? 5}</span>
                    </p>
                    <p>
                        <span className={styles.label}>攻击:</span>
                        <span>{player?.stats?.attack ?? 10}</span>
                    </p>
                </div>
                <div className={styles.playerStatsColumn}>
                    <p>
                        <span className={styles.label}>生命:</span>
                        <span>
                            {player?.stats ? `${player.stats.health}/${player.stats.maxHealth}` : '100/100'}
                        </span>
                    </p>
                    <p>
                        <span className={styles.label}>速度:</span>
                        <span>{player?.stats?.speed ?? 8}</span>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default PlayerFloatingPanel;
