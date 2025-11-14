import React, { useState, useRef, useEffect } from 'react';
import styles from './MissionsModal.module.css';
import type { MissionData, Mission } from '../../api/game/missionApi.type';
import { IoIosArrowDown, IoIosArrowUp } from 'react-icons/io';

interface MissionsModalProps {
    onClose?: () => void;
    missionData: MissionData | null;
    loading?: boolean;
}

interface MissionItemProps {
    mission: Mission;
}

const MissionItem: React.FC<MissionItemProps> = ({ mission }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isOverflowing, setIsOverflowing] = useState(false);
    const descriptionRef = useRef<HTMLParagraphElement>(null);
    const fullTextRef = useRef<HTMLParagraphElement>(null);

    // 检测文本是否溢出
    useEffect(() => {
        const checkOverflow = () => {
            if (fullTextRef.current) {
                const element = fullTextRef.current;
                // 临时移除行数限制来检查完整高度
                const originalStyle = element.style.cssText;
                element.style.cssText = 'display: block; -webkit-line-clamp: unset; -webkit-box-orient: unset; overflow: visible; max-height: none; visibility: hidden; position: absolute;';
                const fullHeight = element.scrollHeight;
                element.style.cssText = originalStyle;
                
                // 计算2行的高度（line-height * 2）
                const lineHeight = parseFloat(getComputedStyle(element).lineHeight) || 16.8; // 12px * 1.4
                const twoLineHeight = lineHeight * 2;
                
                // 如果完整高度超过2行，则显示展开按钮
                setIsOverflowing(fullHeight > twoLineHeight);
            }
        };

        // 延迟检查，确保DOM已渲染
        const timer = setTimeout(checkOverflow, 100);
        window.addEventListener('resize', checkOverflow);
        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', checkOverflow);
        };
    }, [mission.description]);

    const toggleExpand = () => {
        setIsExpanded(!isExpanded);
    };

    return (
        <div className={styles.missionItem}>
            <div className={styles.missionHeader}>
                <h4 className={styles.missionTitle}>{mission.title}</h4>
                <span className={`${styles.missionStatus} ${styles[`missionStatus${mission.status}`]}`}>
                    {mission.status === 'active' ? '进行中' : mission.status === 'completed' ? '已完成' : '失败'}
                </span>
            </div>
            <div className={styles.missionDescriptionWrapper}>
                {/* 用于检测完整高度的隐藏元素 */}
                <p 
                    ref={fullTextRef}
                    className={styles.missionDescriptionFull}
                    style={{ visibility: 'hidden', position: 'absolute', top: '-9999px' }}
                >
                    {mission.description}
                </p>
                <div 
                    className={`${styles.missionDescriptionContainer} ${isExpanded ? styles.missionDescriptionExpanded : ''}`}
                >
                    <p 
                        ref={descriptionRef}
                        className={styles.missionDescription}
                    >
                        {mission.description}
                    </p>
                </div>
                {isOverflowing && (
                    <button 
                        className={styles.expandButton}
                        onClick={toggleExpand}
                        aria-label={isExpanded ? '收起' : '展开'}
                    >
                        {isExpanded ? (
                            <IoIosArrowUp className={styles.arrowIcon} />
                        ) : (
                            <IoIosArrowDown className={styles.arrowIcon} />
                        )}
                    </button>
                )}
            </div>
            <div className={styles.missionReward}>
                <span className={styles.rewardItem}>经验: {mission.reward.experience}</span>
                <span className={styles.rewardItem}>金币: {mission.reward.gold}</span>
            </div>
        </div>
    );
};

const MissionsModal: React.FC<MissionsModalProps> = ({ onClose, missionData, loading = false }) => {
    const renderMission = (mission: Mission) => {
        return <MissionItem key={mission.id} mission={mission} />;
    };

    return (
        <div className={styles.missionsModal}>
            <div className={styles.missionsContent}>
                <h3 className={styles.missionsTitle}>任务列表</h3>
                {loading ? (
                    <div className={styles.loadingMessage}>加载中...</div>
                ) : !missionData ? (
                    <div className={styles.emptyMessage}>暂无任务</div>
                ) : (
                    <div className={styles.missionsList}>
                        {missionData.activeMissions.length > 0 && (
                            <div className={styles.missionSection}>
                                <h4 className={styles.sectionTitle}>进行中的任务 ({missionData.activeMissions.length})</h4>
                                {missionData.activeMissions.map(renderMission)}
                            </div>
                        )}
                        {missionData.completedMissions.length > 0 && (
                            <div className={styles.missionSection}>
                                <h4 className={styles.sectionTitle}>已完成的任务 ({missionData.completedMissions.length})</h4>
                                {missionData.completedMissions.map(renderMission)}
                            </div>
                        )}
                        {missionData.activeMissions.length === 0 && missionData.completedMissions.length === 0 && (
                            <div className={styles.emptyMessage}>暂无任务</div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default MissionsModal;