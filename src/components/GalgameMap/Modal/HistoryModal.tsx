import React, { useEffect, useRef } from 'react';
import styles from './HistoryModal.module.css';
import type { GetWorldInteractionHistoryResponse } from "../../../api/worldInteraction/interactionApi.type";
import ColoredMarkdownText from '../../Galgame/ColoredMarkdownText';

interface HistoryModalProps {
    visible: boolean;
    onClose: () => void;
    history: GetWorldInteractionHistoryResponse | null;
    bottomBar?: React.ReactNode;
}

const HistoryModal = ({ visible, onClose, history, bottomBar }: HistoryModalProps) => {
    if (!visible) return null;

    const interactions = history?.interactions ?? [];
    const contentRef = useRef<HTMLDivElement | null>(null);

    // 打开历史时自动滚动到最底部
    useEffect(() => {
        if (!visible) return;
        const el = contentRef.current;
        if (!el) return;
        // 使用 requestAnimationFrame 确保内容渲染完成
        requestAnimationFrame(() => {
            const el2 = contentRef.current;
            if (!el2) return;
            el2.scrollTop = el2.scrollHeight;
        });
    }, [visible, interactions.length]);

    return (
        <div className={styles.mask} onClick={onClose}>
            <div
                className={styles.modal}
                onClick={(e) => e.stopPropagation()}
            >
                <div className={styles.header}>
                    <div className={styles.title}>历史回顾</div>
                </div>

                <div className={styles.content} ref={contentRef}>
                    {interactions.length === 0 && (
                        <div className={styles.empty}>
                            暂无历史记录
                        </div>
                    )}

                    {interactions.map((interaction: any, idx: number) => {
                        const isAbilityNode = interaction.type === 'ability_node_interaction';
                        const isNpcDialogue = interaction.type === 'npc_dialogue';
                        const isPlayerChoice = interaction.type === 'player_choice';

                        // 根据类型获取不同的数据源
                        const steps = isAbilityNode
                            ? (interaction.narrative || [])
                            : isPlayerChoice
                                ? (interaction.npcResponse || [])
                                : (interaction.narrativeSteps || []);

                        return (
                            <div
                                key={idx}
                                className={`${styles.block} ${isAbilityNode ? styles.blockAbilityNode : ''}`}
                            >
                                <div className={styles.blockHeader}>
                                    <div className={styles.blockMeta}>
                                        {/* 类型标签 */}
                                        {isAbilityNode && (
                                            <span className={styles.typeTag}>
                                                功能性NPC
                                            </span>
                                        )}
                                        {isNpcDialogue && (
                                            <span className={styles.typeTagNpc}>
                                                NPC对话
                                            </span>
                                        )}
                                        {isPlayerChoice && (
                                            <span className={styles.typeTagNpc}>
                                                玩家选择
                                            </span>
                                        )}

                                        {/* 功能性NPC的头部信息 */}
                                        {isAbilityNode && (
                                            <>
                                                <span className={styles.eventTitle}>
                                                    {interaction.nodeName || '功能性NPC'}
                                                </span>
                                                {interaction.sceneName && (
                                                    <>
                                                        <span className={styles.dot}>·</span>
                                                        <span className={styles.subsceneName}>
                                                            {interaction.sceneName}
                                                        </span>
                                                    </>
                                                )}
                                            </>
                                        )}

                                        {/* NPC对话的头部信息 */}
                                        {isNpcDialogue && (
                                            <>
                                                <span className={styles.eventTitle}>
                                                    {interaction.eventTitle || '无标题事件'}
                                                </span>
                                                <span className={styles.dot}>·</span>
                                                <span className={styles.npcName}>
                                                    {interaction.npcName}
                                                </span>
                                                {interaction.subsceneName && (
                                                    <>
                                                        <span className={styles.dot}>·</span>
                                                        <span className={styles.subsceneName}>
                                                            {interaction.subsceneName}
                                                        </span>
                                                    </>
                                                )}
                                            </>
                                        )}
                                    </div>
                                    <div className={styles.time}>
                                        {new Date(interaction.timestamp).toLocaleString()}
                                    </div>
                                </div>

                                <div className={styles.body}>
                                    <div className={styles.timeline}>
                                        {/* 玩家选择：先显示玩家选择 */}
                                        {isPlayerChoice && interaction.selectedOption && (
                                            <div className={styles.timelineItem}>
                                                <div className={styles.timelineDotPlayer} />
                                                <div className={styles.timelineContent}>
                                                    <div className={styles.playerChoiceLabel}>
                                                        你的选择
                                                    </div>
                                                    <div className={styles.playerChoiceText}>
                                                        {interaction.selectedOption.text}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        {/* 功能性NPC：先显示选择的操作 */}
                                        {isAbilityNode && interaction.selectedAction && (
                                            <div className={styles.timelineItem}>
                                                <div className={styles.timelineDotAbility} />
                                                <div className={styles.timelineContent}>
                                                    <div className={styles.actionText}>
                                                        <div className={styles.actionNameText}>
                                                            {interaction.selectedAction.name}
                                                        </div>
                                                        {interaction.selectedAction.description && (
                                                            <div className={styles.actionDesc}>
                                                                {interaction.selectedAction.description}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* 然后显示交互内容（narrative） */}
                                        {steps.map((step: any, sIdx: number) => (
                                            <div key={sIdx} className={styles.timelineItem}>
                                                <div className={styles.timelineDot} />
                                                <div className={styles.timelineContent}>
                                                    {step.type === 'narration' && (
                                                        <div className={styles.narration}>
                                                            <ColoredMarkdownText text={step.content} />
                                                            {/* {step.content} */}
                                                        </div>
                                                    )}
                                                    {step.type === 'dialogue' && (
                                                        <div className={styles.dialogue}>
                                                            <div className={styles.dialogueName}>
                                                                {step.speakerName || interaction.npcName}
                                                            </div>
                                                            <div className={styles.dialogueText}>
                                                                <ColoredMarkdownText text={step.content} />
                                                                {/* {step.content} */}
                                                            </div>
                                                        </div>
                                                    )}
                                                    {step.type === 'choice' && (
                                                        <div className={styles.choice}>
                                                            <div className={styles.choiceTitle}>
                                                                {step.title || '选择'}
                                                            </div>
                                                            {step.description && (
                                                                <div className={styles.choiceDesc}>
                                                                    {step.description}
                                                                </div>
                                                            )}
                                                            <div className={styles.choiceOptions}>
                                                                {step.options?.map((opt: any, oIdx: number) => (
                                                                    <div
                                                                        key={oIdx}
                                                                        className={styles.choiceOption}
                                                                    >
                                                                        {opt.text}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}


                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {bottomBar && <div className={styles.bottomBar}>{bottomBar}</div>}
            </div>
        </div>
    );
};

export default HistoryModal;