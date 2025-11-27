import React from 'react';
import styles from './MissionSubmitModal.module.css';
import type { MissionData, Mission, CompletionPathRequirements } from '../../api/game/missionApi.type';
import toast, { Toaster } from 'react-hot-toast';

interface MissionSubmitModalProps {
    missionData: MissionData | null;
    onClose: () => void;
    onSubmitMission: (missionId: string) => Promise<void>;
    onSkipMission: (missionId: string) => Promise<void>;
}

const hasRequirementContent = (requirements?: CompletionPathRequirements | null) => {
    if (!requirements) return false;
    return Boolean(
        (requirements.items && requirements.items.length > 0) ||
        (requirements.relationships && requirements.relationships.length > 0) ||
        (requirements.locations && requirements.locations.length > 0) ||
        (requirements.stats && requirements.stats.length > 0)
    );
};

const RequirementSections: React.FC<{
    requirements?: CompletionPathRequirements | null;
}> = ({ requirements }) => {
    if (!requirements) {
        return <p className={styles.requirementEmpty}>暂无额外要求</p>;
    }

    const hasContent = hasRequirementContent(requirements);

    if (!hasContent) {
        return <p className={styles.requirementEmpty}>暂无额外要求</p>;
    }

    return (
        <div className={styles.requirementGroups}>
            {requirements.items && requirements.items.length > 0 && (
                <div className={styles.requirementSection}>
                    <div className={styles.requirementSectionTitle}>物品</div>
                    <ul className={styles.requirementList}>
                        {requirements.items.map((item, index) => (
                            <li key={`${item.itemName}-${index}`}>
                                {item.itemName} × {item.quantity}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            {requirements.relationships && requirements.relationships.length > 0 && (
                <div className={styles.requirementSection}>
                    <div className={styles.requirementSectionTitle}>关系</div>
                    <ul className={styles.requirementList}>
                        {requirements.relationships.map((relationship, index) => (
                            <li key={`${relationship.npcName}-${index}`}>
                                与 {relationship.npcName} 好感 ≥ {relationship.minValue}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            {requirements.locations && requirements.locations.length > 0 && (
                <div className={styles.requirementSection}>
                    <div className={styles.requirementSectionTitle}>地点</div>
                    <div className={styles.requirementBadges}>
                        {requirements.locations.map((location, index) => (
                            <span key={`${location}-${index}`} className={styles.requirementBadge}>
                                {location}
                            </span>
                        ))}
                    </div>
                </div>
            )}
            {requirements.stats && requirements.stats.length > 0 && (
                <div className={styles.requirementSection}>
                    <div className={styles.requirementSectionTitle}>属性</div>
                    <ul className={styles.requirementList}>
                        {requirements.stats.map((stat, index) => (
                            <li key={`${stat.statName}-${index}`}>
                                {stat.statName} ≥ {stat.minValue}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

const MissionItem: React.FC<{
    mission: Mission;
    onSubmitMission: (missionId: string) => Promise<void>;
    onSkipMission: (missionId: string) => Promise<void>;
}> = ({ mission, onSubmitMission, onSkipMission }) => {
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [isSkipping, setIsSkipping] = React.useState(false);

    const handleSubmitMission = async () => {
        if (mission.id && !isSubmitting && !isSkipping) {
            try {
                setIsSubmitting(true);
                await onSubmitMission(mission.id);
            } catch (error: any) {
                console.error('❌ 任务提交错误:', error);
                toast.error('任务提交失败，请稍后重试');
            } finally {
                setIsSubmitting(false);
            }
        }
    };

    const handleSkipMission = async () => {
        if (mission.id && !isSubmitting && !isSkipping) {
            try {
                setIsSkipping(true);
                await onSkipMission(mission.id);
            } catch (error: any) {
                console.error('❌ 任务跳过错误:', error);
                toast.error('任务跳过失败，请稍后重试');
            } finally {
                setIsSkipping(false);
            }
        }
    };

    const hasMultipleRequirementPlans =
        Array.isArray(mission.requirements) && mission.requirements.length > 1;


    return (
        <div className={styles.missionItem}>
            <div className={styles.missionHeader}>
                <h4 className={styles.missionTitle}>{mission.title}</h4>
                <span className={`${styles.missionStatus} ${styles.missionStatusActive}`}>
                    进行中
                </span>
            </div>
            <div className={styles.missionDescription}>
                <p>{mission.description}</p>
                {mission.isStoryMission && mission.completionPaths.length > 0 ? (
                    <div className={styles.missionCompletionPaths}>
                        <p className={styles.requirementsTitle}>推荐完成路径：</p>
                        <div className={styles.pathList}>
                            {mission.completionPaths.map((path, index) => (
                                <div key={path.pathId} className={styles.pathCard}>
                                    <div className={styles.pathHeader}>
                                        <span className={styles.pathName}>
                                            {path.name || `路径 ${index + 1}`}
                                        </span>
                                    </div>
                                    {path.description && (
                                        <p className={styles.pathDescription}>{path.description}</p>
                                    )}
                                    <RequirementSections requirements={path.requirements} />
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className={styles.missionRequirements}>
                        <p className={styles.requirementsTitle}>完成条件：</p>
                        {Array.isArray(mission.requirements)
                            ? mission.requirements.map((req, index) => (
                                <div key={index} className={styles.requirementGroup}>
                                    {hasMultipleRequirementPlans && (
                                        <span className={styles.requirementPlanTag}>方案 {index + 1}</span>
                                    )}
                                    <RequirementSections requirements={req} />
                                </div>
                            ))
                            : (
                                <RequirementSections requirements={mission.requirements ?? null} />
                            )}
                    </div>
                )}
            </div>
            <div className={styles.missionReward}>
                <span className={styles.rewardItem}>经验: {mission.reward?.experience ?? 0}</span>
                <span className={styles.rewardItem}>金币: {mission.reward?.gold ?? 0}</span>
                {(mission.reward?.items ?? []).map((item, index) => (
                    <span key={index} className={styles.rewardItem}>{item}</span>
                ))}
            </div>
            <div className={styles.missionSubmitButton}>
                <button
                    className={`${styles.submitButton} ${styles.skipButton}`}
                    onClick={handleSkipMission}
                    disabled={isSubmitting || isSkipping}
                >
                    {isSkipping ? '跳过中...' : '跳过任务'}
                </button>
                <button
                    className={styles.submitButton}
                    onClick={handleSubmitMission}
                    disabled={isSubmitting || isSkipping}
                >
                    {isSubmitting ? '提交中...' : '任务提交'}
                </button>
            </div>
        </div>
    );
};

const MissionSubmitModal: React.FC<MissionSubmitModalProps> = ({ 
    missionData, 
    onSubmitMission,
    onSkipMission
}) => {
    if (!missionData || missionData.activeMissions.length === 0) {
        return null;
    }

    return (
        <div className={styles.modalOverlay}>
            <Toaster
                position="top-center"
                containerStyle={{
                    position: 'fixed',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                }}
                toastOptions={{
                    duration: 3000,
                    style: {
                        minWidth: '250px',
                        textAlign: 'center',
                        borderRadius: '8px',
                    },
                }}
            />
            <div className={styles.modalContent}>
                <div className={styles.modalHeader}>
                    <h2 className={styles.modalTitle}>任务提示</h2>
                </div>
                <div className={styles.modalBody}>
                    <div className={styles.alertMessage}>
                        <p className={styles.alertText}>
                            您有未完成的任务，请完成任务后再继续游戏。
                        </p>
                    </div>
                    <div className={styles.missionsList}>
                        <h3 className={styles.sectionTitle}>
                            进行中的任务 ({missionData.activeMissions.length})
                        </h3>
                        {missionData.activeMissions.map((mission) => (
                            <MissionItem
                                key={mission.id}
                                mission={mission}
                                onSubmitMission={onSubmitMission}
                                onSkipMission={onSkipMission}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MissionSubmitModal;

