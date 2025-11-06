import React from 'react';
import styles from './PlayerFloatingPanel.module.css';

interface PlayerProfile {
    avatar: string;
    name: string;
    age: number;
    gender: string;
    job: string;
}

interface PlayerStats {
    level: number;
    health: number;
    maxHealth: number;
    attack: number;
    defense: number;
    speed: number;
}

interface PlayerState {
    profile: PlayerProfile;
    stats: PlayerStats;
    experience: { current: number; required: number };
    currency: { gold: number };
}

interface PlayerFloatingPanelProps {
    isOpen: boolean;
    onClose?: () => void;
    player: PlayerState | null;
}

const PlayerFloatingPanel: React.FC<PlayerFloatingPanelProps> = ({
    isOpen,
    onClose,
    player
}) => {
    if (!isOpen) return null;


    return (
        <div className={styles.playerFloatingPanel}>
            <div className={styles.playerPanelHeader}>
                <span className={styles.playerPanelHeaderLevel}>
                    <p className={styles.playerPanelHeaderLevelText}>LV.</p>
                    <p className={styles.playerPanelHeaderLevelValue}>{player?.stats.level ?? 1}</p>
                </span>
                <h3>{player?.profile.name || '未命名'}</h3>
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
                            src={player?.profile.avatar || '/data/avatars/hunter.png'}
                            alt="角色头像"
                        />
                    </div>
                    {/* <div className={styles.playerDetails}> */}
                    <div className={styles.playerBasic}>
                        <p>
                            <span className={styles.label}>年龄:</span>
                            <span>{player?.profile.age ?? '-'}</span>
                        </p>
                        <p>
                            <span className={styles.label}>性别:</span>
                            <span>{player?.profile.gender ?? '-'}</span>
                        </p>
                        <p>
                            <span className={styles.label}>职业:</span>
                            <span>{player?.profile.job ?? '-'}</span>
                        </p>
                    </div>
                    {/* <div className={styles.playerStats}>
                            <h4>属性</h4>
                            <div className={styles.statBar}>
                                <span className={styles.statLabel}>等级:</span>
                                <span className={styles.statValue}>{player?.stats.level ?? 1}</span>
                            </div>
                            <div className={styles.statBar}>
                                <span className={styles.statLabel}>生命:</span>
                                <span className={styles.statValue}>
                                    {player ? `${player.stats.health}/${player.stats.maxHealth}` : '100/100'}
                                </span>
                            </div>
                            <div className={styles.statBar}>
                                <span className={styles.statLabel}>攻击:</span>
                                <span className={styles.statValue}>{player?.stats.attack ?? 10}</span>
                            </div>
                            <div className={styles.statBar}>
                                <span className={styles.statLabel}>防御:</span>
                                <span className={styles.statValue}>{player?.stats.defense ?? 5}</span>
                            </div>
                            <div className={styles.statBar}>
                                <span className={styles.statLabel}>速度:</span>
                                <span className={styles.statValue}>{player?.stats.speed ?? 8}</span>
                            </div>
                        </div> */}
                    {/* </div> */}
                </div>

            </div>
            <div className={styles.playerStats}>
                <div className={styles.playerStatsColumn}>
                    <p>
                        <span className={styles.label}>等级:</span>
                        <span>{player?.stats.level ?? 1}</span>
                    </p>
                    <p>
                        <span className={styles.label}>防御:</span>
                        <span>{player?.stats.defense ?? 5}</span>
                    </p>
                    <p>
                        <span className={styles.label}>攻击:</span>
                        <span>{player?.stats.attack ?? 10}</span>
                    </p>
                </div>
                <div className={styles.playerStatsColumn}>
                    <p>
                        <span className={styles.label}>生命:</span>
                        <span>
                            {player ? `${player.stats.health}/${player.stats.maxHealth}` : '100/100'}
                        </span>
                    </p>
                    <p>
                        <span className={styles.label}>速度:</span>
                        <span>{player?.stats.speed ?? 8}</span>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default PlayerFloatingPanel;
