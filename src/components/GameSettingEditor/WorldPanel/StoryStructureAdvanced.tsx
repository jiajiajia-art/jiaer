import React, { useState, useEffect } from 'react';
import type { StoryStructure, DynamicEntry } from '../../../api/galgame/EditorData.type';
import styles from './StoryStructureAdvanced.module.css';
import worldPanelStyles from './WorldPanel.module.css';
import EditorApi from '../../../api/galgame/EditorData';
import { toast } from 'react-hot-toast';
import ConfirmModal from '../../CommonModal/ConfirmModal';
import { MdArrowDropDown } from 'react-icons/md';

const parseCommaSeparated = (value: string): string[] =>
    value
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);

interface StoryStructureAdvancedProps {
    storyStructure: StoryStructure | null;
    setStoryStructure: (updater: (prev: StoryStructure | null) => StoryStructure | null) => void;
    dynamicEntries: DynamicEntry[];
    setDynamicEntries: (updater: (prev: DynamicEntry[]) => DynamicEntry[]) => void;
    storyPrompt: string;
    setStoryPrompt: (value: string) => void;
    isGeneratingStory: boolean;
    generationProgress: number;
    generationStage: string;
    advancedError: string | null;
    onGenerate: () => void;
    canGenerate: boolean;
    fileId?: string;
}

const StoryStructureAdvanced: React.FC<StoryStructureAdvancedProps> = ({
    storyStructure,
    setStoryStructure,
    dynamicEntries,
    setDynamicEntries,
    storyPrompt,
    setStoryPrompt,
    isGeneratingStory,
    generationProgress,
    generationStage,
    advancedError,
    onGenerate,
    canGenerate,
    fileId,
}) => {
    const [activeSubTab, setActiveSubTab] = useState<'story' | 'dynamic'>('story');
    const [collapsedPhases, setCollapsedPhases] = useState<Record<string, boolean>>({});
    const [collapsedDynamics, setCollapsedDynamics] = useState<Record<string, boolean>>({});
    const [showPrompt, setShowPrompt] = useState(true);
    const [phaseToDelete, setPhaseToDelete] = useState<string | null>(null);
    const [dynamicToDelete, setDynamicToDelete] = useState<string | null>(null);
    const [isAddPhaseModalOpen, setIsAddPhaseModalOpen] = useState(false);
    const [isAddDynamicModalOpen, setIsAddDynamicModalOpen] = useState(false);
    const [newPhase, setNewPhase] = useState({
        name: '',
        description: '',
        context: '',
        activeByDefault: true,
        isFinalPhase: false,
        activeFlags: '',
    });
    const [newDynamic, setNewDynamic] = useState({
        category: '',
        content: '',
        probability: 100,
        maxActivations: 1,
        sticky: 1,
        cooldown: 0,
        order: 100,
        enabled: true,
        requiredFlags: '',
    });

    // 有 storyStructure 时，默认不再展示生成表单，除非用户点击重新生成
    useEffect(() => {
        if (storyStructure) {
            setShowPrompt(false);
        }
    }, [storyStructure]);

    const handleStoryEnabledChange = (enabled: boolean) => {
        setStoryStructure(prev => (prev ? { ...prev, enabled } : prev));
    };

    const handlePhaseFieldChange = (
        phaseId: string,
        key: 'name' | 'description' | 'context',
        value: string,
    ) => {
        setStoryStructure(prev => {
            if (!prev) return prev;
            return {
                ...prev,
                phases: prev.phases.map(phase =>
                    phase.id === phaseId ? { ...phase, [key]: value } : phase,
                ),
            };
        });
    };

    const handlePhaseToggleChange = (
        phaseId: string,
        key: 'activeByDefault' | 'isFinalPhase',
        value: boolean,
    ) => {
        setStoryStructure(prev => {
            if (!prev) return prev;
            return {
                ...prev,
                phases: prev.phases.map(phase =>
                    phase.id === phaseId ? { ...phase, [key]: value } : phase,
                ),
            };
        });
    };

    const doDeletePhase = async (phaseId: string) => {
        setStoryStructure(prev => {
            if (!prev) return prev;
            return {
                ...prev,
                phases: prev.phases.filter(p => p.id !== phaseId),
            };
        });
        if (!fileId) return;
        try {
            await EditorApi.deleteStoryPhase(fileId, phaseId);
        } catch (e) {
            console.error('删除 phase 失败', e);
            toast.error('删除章节失败，请稍后重试');
        }
    };

    const handlePhaseSetFlagsChange = (phaseId: string, value: string) => {
        const flags = parseCommaSeparated(value);
        setStoryStructure(prev => {
            if (!prev) return prev;
            return {
                ...prev,
                phases: prev.phases.map(phase =>
                    phase.id === phaseId ? { ...phase, setFlags: flags } : phase,
                ),
            };
        });
    };

    const handleTransitionFieldChange = (
        phaseId: string,
        index: number,
        field: 'targetPhase' | 'minTurns' | 'required' | 'anyOf' | 'automatic',
        value: string | boolean,
    ) => {
        setStoryStructure(prev => {
            if (!prev) return prev;
            return {
                ...prev,
                phases: prev.phases.map(phase => {
                    if (phase.id !== phaseId) return phase;
                    const transitions = (phase.transitions || []).map((t, i) => {
                        if (i !== index) return t;
                        const baseCondition = t.condition || {
                            minTurns: 0,
                            flags: { required: [], anyOf: [] },
                        };
                        const baseFlags = baseCondition.flags || {
                            required: [],
                            anyOf: [],
                        };
                        switch (field) {
                            case 'targetPhase':
                                return { ...t, targetPhase: String(value) };
                            case 'minTurns':
                                return {
                                    ...t,
                                    condition: {
                                        ...baseCondition,
                                        minTurns: Number(value) || 0,
                                    },
                                };
                            case 'required': {
                                const arr = String(value)
                                    .split(',')
                                    .map(v => v.trim())
                                    .filter(Boolean);
                                return {
                                    ...t,
                                    condition: {
                                        ...baseCondition,
                                        flags: {
                                            ...baseFlags,
                                            required: arr,
                                        },
                                    },
                                };
                            }
                            case 'anyOf': {
                                const arr = String(value)
                                    .split(',')
                                    .map(v => v.trim())
                                    .filter(Boolean);
                                return {
                                    ...t,
                                    condition: {
                                        ...baseCondition,
                                        flags: {
                                            ...baseFlags,
                                            anyOf: arr,
                                        },
                                    },
                                };
                            }
                            case 'automatic':
                                return { ...t, automatic: Boolean(value) };
                            default:
                                return t;
                        }
                    });
                    return { ...phase, transitions };
                }),
            };
        });
    };

    const handleDynamicEntryChange = <K extends keyof DynamicEntry>(
        id: string,
        key: K,
        value: DynamicEntry[K],
    ) => {
        setDynamicEntries(prev =>
            prev.map(entry =>
                entry.id === id ? { ...entry, [key]: value } : entry,
            ),
        );
    };

    const doDeleteDynamicEntry = async (id: string) => {
        setDynamicEntries(prev => prev.filter(e => e.id !== id));
        if (!fileId) return;
        try {
            await EditorApi.deleteDynamicEntry(fileId, id);
        } catch (e) {
            console.error('删除 dynamicEntry 失败', e);
            toast.error('删除动态条目失败，请稍后重试');
        }
    };

    const handleDynamicSetFlagsChange = (id: string, value: string) => {
        const flags = parseCommaSeparated(value);
        setDynamicEntries(prev =>
            prev.map(entry =>
                entry.id === id ? { ...entry, setFlags: flags } : entry,
            ),
        );
    };

    const handleDynamicActivationFlagsChange = (id: string, value: string) => {
        const flags = parseCommaSeparated(value);
        setDynamicEntries(prev =>
            prev.map(entry => {
                if (entry.id !== id) return entry;
                const baseActivation = entry.activationConditions || {
                    flags: { required: [] },
                    probability: 0,
                    maxActivations: 0,
                };
                const baseFlags = baseActivation.flags || { required: [] };
                return {
                    ...entry,
                    activationConditions: {
                        ...baseActivation,
                        flags: {
                            ...baseFlags,
                            required: flags,
                        },
                    },
                };
            }),
        );
    };

    const handleDynamicNumberFieldChange = (
        id: string,
        field: 'probability' | 'maxActivations' | 'sticky' | 'cooldown' | 'order',
        value: string,
    ) => {
        const num = Number(value) || 0;
        setDynamicEntries(prev =>
            prev.map(entry => {
                if (entry.id !== id) return entry;
                if (field === 'probability' || field === 'maxActivations') {
                    const baseActivation = entry.activationConditions || {
                        flags: { required: [] },
                        probability: 0,
                        maxActivations: 0,
                    };
                    return {
                        ...entry,
                        activationConditions: {
                            ...baseActivation,
                            [field]: num,
                        },
                    };
                }
                return { ...entry, [field]: num } as DynamicEntry;
            }),
        );
    };

    const handleSavePhase = async (phaseId: string) => {
        if (!fileId) {
            toast.error('缺少文件ID，无法保存章节');
            return;
        }
        const phase = storyStructure?.phases.find(p => p.id === phaseId);
        if (!phase) return;
        try {
            await EditorApi.updateStoryPhase(fileId, phaseId, phase);
            toast.success('章节已保存');
        } catch (e) {
            console.error('保存章节失败', e);
            toast.error('保存章节失败，请稍后重试');
        }
    };

    const handleSaveDynamicEntry = async (id: string) => {
        if (!fileId) {
            toast.error('缺少文件ID，无法保存动态条目');
            return;
        }
        const entry = dynamicEntries.find(e => e.id === id);
        if (!entry) return;
        try {
            await EditorApi.updateDynamicEntry(fileId, id, entry);
            toast.success('动态条目已保存');
        } catch (e) {
            console.error('保存动态条目失败', e);
            toast.error('保存动态条目失败，请稍后重试');
        }
    };

    const handleAddPhase = async () => {
        if (!fileId) {
            toast.error('缺少文件ID，无法新增章节');
            return;
        }
        if (!newPhase.name.trim()) {
            toast.error('请填写章节名称');
            return;
        }
        const tempId = `tmp-${Date.now()}`;
        const activeFlagsArr = parseCommaSeparated(newPhase.activeFlags);

        const phasePayload: StoryStructure['phases'][number] & { activeFlags?: string[] } = {
            id: tempId,
            name: newPhase.name.trim(),
            description: newPhase.description.trim(),
            context: newPhase.context.trim(),
            activeByDefault: newPhase.activeByDefault,
            isFinalPhase: newPhase.isFinalPhase,
            ...(activeFlagsArr.length > 0 && { activeFlags: activeFlagsArr }),
            setFlags: [],
            transitions: [],
        };
        setStoryStructure(prev => {
            if (!prev) {
                const base: StoryStructure = {
                    enabled: true,
                    defaultPhase: tempId,
                    phases: [phasePayload],
                };
                return base;
            }
            return {
                ...prev,
                phases: [...prev.phases, phasePayload],
            };
        });
        try {
            await EditorApi.addStoryPhase(fileId, phasePayload);
            toast.success('章节已新增');
            setIsAddPhaseModalOpen(false);
            setNewPhase({
                name: '',
                description: '',
                context: '',
                activeByDefault: true,
                isFinalPhase: false,
                activeFlags: '',
            });
        } catch (e) {
            console.error('新增章节失败', e);
            toast.error('新增章节失败，请稍后重试');
        }
    };

    const handleAddDynamicEntry = async () => {
        if (!fileId) {
            toast.error('缺少文件ID，无法新增动态条目');
            return;
        }
        if (!newDynamic.content.trim()) {
            toast.error('请填写动态条目内容');
            return;
        }
        const tempId = `tmp-${Date.now()}`;
        const required = parseCommaSeparated(newDynamic.requiredFlags);
        const entryPayload: DynamicEntry = {
            id: tempId,
            category: newDynamic.category.trim(),
            content: newDynamic.content.trim(),
            activationConditions: {
                flags: { required },
                probability: newDynamic.probability || 100,
                maxActivations: newDynamic.maxActivations || 1,
            },
            setFlags: [],
            sticky: newDynamic.sticky || 1,
            cooldown: newDynamic.cooldown || 0,
            order: newDynamic.order || 100,
            enabled: newDynamic.enabled,
        };
        setDynamicEntries(prev => [...prev, entryPayload]);
        try {
            await EditorApi.addDynamicEntry(fileId, entryPayload);
            toast.success('动态条目已新增');
            setIsAddDynamicModalOpen(false);
            setNewDynamic({
                category: '',
                content: '',
                probability: 100,
                maxActivations: 1,
                sticky: 1,
                cooldown: 0,
                order: 100,
                enabled: true,
                requiredFlags: '',
            });
        } catch (e) {
            console.error('新增动态条目失败', e);
            toast.error('新增动态条目失败，请稍后重试');
        }
    };

    return (
        <div className={`${styles.advancedContent} ${isGeneratingStory ? styles.advancedContentGenerating : ''}`}>
            <div className={styles.advancedHeader}>
                <div>
                    <h3 className={styles.advancedTitle}>故事结构 · 高级引导</h3>
                    <p className={styles.advancedSubtitle}>
                        在这里用 2-3 句话描述你希望的整体剧情走向（如章节数、高潮位置、主线/支线节奏），AI 会生成结构化的
                        story-structure 与 dynamicEntries。
                    </p>
                </div>
                {showPrompt ? (
                    <button
                        type="button"
                        className={worldPanelStyles.primary}
                        onClick={onGenerate}
                        disabled={isGeneratingStory || !canGenerate}
                    >
                        {isGeneratingStory ? '生成中...' : '生成故事结构'}
                    </button>
                ) : (
                    <button
                        type="button"
                        className={worldPanelStyles.ghostSmall}
                        onClick={() => setShowPrompt(true)}
                        disabled={isGeneratingStory}
                    >
                        重新生成 story-structure
                    </button>
                )}
            </div>

            {showPrompt && (
                <div className={styles.storyPromptBox}>
                    <label>
                        <span className={worldPanelStyles.fieldLabel}>
                            生成 story-structure 的描述
                        </span>
                        <span className={worldPanelStyles.fieldHint}>
                            例如：&quot;6 phases: daily life → inciting incident → investigation → conflict escalation → climax → epilogue&quot;。
                            字段名保持英文（phase, flags 等），只需要自然语言描述结构即可。
                        </span>
                        <textarea
                            rows={3}
                            value={storyPrompt}
                            onChange={(e) => setStoryPrompt(e.target.value)}
                            placeholder="Describe your desired phase structure in natural language, e.g. number of phases, when conflicts rise, where endings branch..."
                            disabled={isGeneratingStory}
                        />
                    </label>
                </div>
            )}

            {isGeneratingStory && (
                <div className={styles.generationProgress}>
                    <div className={styles.progressSpinner}>
                        <div className={styles.spinnerCircle}></div>
                    </div>
                    <div className={styles.progressInfo}>
                        <div className={styles.progressText}>
                            {generationStage || '正在生成故事结构和动态条目...'}
                        </div>
                        {generationProgress > 0 && (
                            <div className={styles.progressPercent}>
                                {Math.round(generationProgress)}%
                            </div>
                        )}
                    </div>
                </div>
            )}

            {advancedError && (
                <p className={worldPanelStyles.errorText}>{advancedError}</p>
            )}

            {!isGeneratingStory && (
                <>
            {/* 子 Tab：story-structure / dynamicEntries */}
            <div className={styles.subTabRow}>
                <div className={styles.subTabGroup}>
                    <button
                        type="button"
                        className={`${styles.subTab} ${activeSubTab === 'story' ? styles.subTabActive : ''}`}
                        onClick={() => setActiveSubTab('story')}
                    >
                        story-structure
                    </button>
                    <button
                        type="button"
                        className={`${styles.subTab} ${activeSubTab === 'dynamic' ? styles.subTabActive : ''}`}
                        onClick={() => setActiveSubTab('dynamic')}
                    >
                        dynamicEntries
                    </button>
                </div>
                {activeSubTab === 'story' && (
                    <button
                        type="button"
                        className={worldPanelStyles.ghostSmall}
                        onClick={() => setIsAddPhaseModalOpen(true)}
                    >
                        + 新增 phase
                    </button>
                )}
                {activeSubTab === 'dynamic' && (
                    <button
                        type="button"
                        className={worldPanelStyles.ghostSmall}
                        onClick={() => setIsAddDynamicModalOpen(true)}
                    >
                        + 新增 dynamicEntry
                    </button>
                )}
            </div>

            {/* story-structure 区块 */}
            {activeSubTab === 'story' && (
                <>
                    <div className={styles.sectionDivider} />
                    <div className={styles.phaseHeaderRow}>
                        <span className={worldPanelStyles.fieldLabel}>story-structure（阶段结构）</span>
                        <span className={worldPanelStyles.fieldHint}>
                            控制整体章节流转逻辑，字段名保持英文，便于与后端/引擎对齐。
                        </span>
                    </div>

                    {(!storyStructure && !isGeneratingStory) && (
                        <p className={styles.emptyHint}>
                            还没有 story-structure，可先填写上方描述并点击「生成故事结构」。
                        </p>
                    )}
                </>
            )}

            {activeSubTab === 'story' && storyStructure && (
                <div className={styles.advancedSection}>
                    <div className={styles.storyMetaRow}>
                        <label className={styles.storyMetaItem}>
                            <span className={worldPanelStyles.fieldLabel}>defaultPhase (默认起始阶段 ID)</span>
                            <input
                                type="text"
                                value={storyStructure.defaultPhase}
                                onChange={(e) =>
                                    setStoryStructure(prev =>
                                        prev
                                            ? { ...prev, defaultPhase: e.target.value }
                                            : prev,
                                    )
                                }
                            />
                        </label>
                        <label className={styles.storyMetaToggle}>
                            <input
                                type="checkbox"
                                checked={storyStructure.enabled}
                                onChange={(e) =>
                                    handleStoryEnabledChange(e.target.checked)
                                }
                            />
                            <span>enabled（启用 story-structure ）</span>
                        </label>
                    </div>

                    <div className={styles.phaseList}>
                        {storyStructure.phases.map(phase => (
                            <div key={phase.id} className={styles.phaseCard}>
                                <div
                                    className={styles.phaseMetaRow}
                                    onClick={() =>
                                        setCollapsedPhases(prev => ({
                                            ...prev,
                                            [phase.id]: !prev[phase.id],
                                        }))
                                    }
                                    style={{ cursor: 'pointer' }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <MdArrowDropDown 
                                            size={20} 
                                            style={{ 
                                                transform: collapsedPhases[phase.id] ? 'rotate(-90deg)' : 'rotate(0deg)',
                                                transition: 'transform 0.2s ease',
                                                flexShrink: 0
                                            }} 
                                        />
                                        <span className={styles.phaseIdPill}>
                                            phase.id：{phase.id}
                                        </span>
                                    </div>
                                    <label 
                                        className={styles.phaseToggle}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={phase.activeByDefault}
                                            onChange={(e) => {
                                                e.stopPropagation();
                                                handlePhaseToggleChange(
                                                    phase.id,
                                                    'activeByDefault',
                                                    e.target.checked,
                                                );
                                            }}
                                        />
                                        <span>activeByDefault</span>
                                    </label>
                                    <label 
                                        className={styles.phaseToggle}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={phase.isFinalPhase}
                                            onChange={(e) => {
                                                e.stopPropagation();
                                                handlePhaseToggleChange(
                                                    phase.id,
                                                    'isFinalPhase',
                                                    e.target.checked,
                                                );
                                            }}
                                        />
                                        <span>isFinalPhase</span>
                                    </label>
                                    <div className={styles.phaseActions}>
                                        <button
                                            type="button"
                                            className={worldPanelStyles.ghostTiny}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setPhaseToDelete(phase.id);
                                            }}
                                        >
                                            删除
                                        </button>
                                        <button
                                            type="button"
                                            className={worldPanelStyles.ghostTiny}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleSavePhase(phase.id);
                                            }}
                                        >
                                            保存
                                        </button>
                                    </div>
                                </div>

                                {!collapsedPhases[phase.id] && (
                                    <div className={styles.phaseFields}>
                                        <label>
                                            <span className={worldPanelStyles.fieldLabel}>name</span>
                                            <input
                                                type="text"
                                                value={phase.name}
                                                onChange={(e) =>
                                                    handlePhaseFieldChange(
                                                        phase.id,
                                                        'name',
                                                        e.target.value,
                                                    )
                                                }
                                            />
                                        </label>
                                        <label>
                                            <span className={worldPanelStyles.fieldLabel}>description</span>
                                            <textarea
                                                rows={2}
                                                value={phase.description}
                                                onChange={(e) =>
                                                    handlePhaseFieldChange(
                                                        phase.id,
                                                        'description',
                                                        e.target.value,
                                                    )
                                                }
                                            />
                                        </label>
                                        <label>
                                            <span className={worldPanelStyles.fieldLabel}>context</span>
                                            <textarea
                                                rows={3}
                                                value={phase.context}
                                                onChange={(e) =>
                                                    handlePhaseFieldChange(
                                                        phase.id,
                                                        'context',
                                                        e.target.value,
                                                    )
                                                }
                                            />
                                        </label>
                                        <div className={styles.phaseFlagsRow}>
                                            <label>
                                                <span className={worldPanelStyles.fieldLabel}>setFlags（comma separated）</span>
                                                <input
                                                    type="text"
                                                    value={(phase.setFlags || []).join(', ')}
                                                    onChange={(e) =>
                                                        handlePhaseSetFlagsChange(
                                                            phase.id,
                                                            e.target.value,
                                                        )
                                                    }
                                                />
                                            </label>
                                            <div className={styles.transitionList}>
                                                {(phase.transitions || []).map((t, index) => (
                                                    <div
                                                        key={index}
                                                        className={styles.transitionCard}
                                                    >
                                                        <div className={styles.transitionMetaRow}>
                                                            <span className={styles.phaseIdPill}>
                                                                transition #{index + 1}
                                                            </span>
                                                            <label className={styles.phaseToggle}>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={t.automatic}
                                                                    onChange={(e) =>
                                                                        handleTransitionFieldChange(
                                                                            phase.id,
                                                                            index,
                                                                            'automatic',
                                                                            e.target.checked,
                                                                        )
                                                                    }
                                                                />
                                                                <span>automatic</span>
                                                            </label>
                                                        </div>
                                                        <div className={styles.phaseFields}>
                                                            <label>
                                                                <span className={worldPanelStyles.fieldLabel}>targetPhase</span>
                                                                <input
                                                                    type="text"
                                                                    value={t.targetPhase}
                                                                    onChange={(e) =>
                                                                        handleTransitionFieldChange(
                                                                            phase.id,
                                                                            index,
                                                                            'targetPhase',
                                                                            e.target.value,
                                                                        )
                                                                    }
                                                                />
                                                            </label>
                                                            <label>
                                                                <span className={worldPanelStyles.fieldLabel}>condition.minTurns</span>
                                                                <input
                                                                    type="number"
                                                                    value={(t.condition?.minTurns ?? 0)}
                                                                    onChange={(e) =>
                                                                        handleTransitionFieldChange(
                                                                            phase.id,
                                                                            index,
                                                                            'minTurns',
                                                                            e.target.value,
                                                                        )
                                                                    }
                                                                />
                                                            </label>
                                                            <label>
                                                                <span className={worldPanelStyles.fieldLabel}>condition.flags.required</span>
                                                                <input
                                                                    type="text"
                                                                    value={(t.condition?.flags?.required ?? []).join(', ')}
                                                                    onChange={(e) =>
                                                                        handleTransitionFieldChange(
                                                                            phase.id,
                                                                            index,
                                                                            'required',
                                                                            e.target.value,
                                                                        )
                                                                    }
                                                                />
                                                            </label>
                                                            <label>
                                                                <span className={worldPanelStyles.fieldLabel}>condition.flags.anyOf</span>
                                                                <input
                                                                    type="text"
                                                                    value={(t.condition?.flags?.anyOf ?? []).join(', ')}
                                                                    onChange={(e) =>
                                                                        handleTransitionFieldChange(
                                                                            phase.id,
                                                                            index,
                                                                            'anyOf',
                                                                            e.target.value,
                                                                        )
                                                                    }
                                                                />
                                                            </label>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* dynamicEntries 区块 */}
            {activeSubTab === 'dynamic' && (
                <>
                    <div className={styles.sectionDivider} />
                    <div className={styles.phaseHeaderRow}>
                        <span className={worldPanelStyles.fieldLabel}>dynamicEntries（动态文本条目）</span>
                        <span className={worldPanelStyles.fieldHint}>
                            控制在特定 flags / 条件下触发的动态文本。字段名（activationConditions, probability 等）保持英文，以便与引擎一致。
                        </span>
                    </div>
                <div className={styles.dynamicList}>
                    {dynamicEntries.length === 0 ? (
                        <p className={styles.emptyHint}>
                            当前没有 dynamicEntries。生成 story-structure 时，后端可能会一并返回推荐的动态条目。
                        </p>
                    ) : (
                        dynamicEntries.map(entry => (
                            <div
                                key={entry.id}
                                className={styles.dynamicCard}
                            >
                                <div
                                    className={styles.dynamicHeader}
                                    onClick={() =>
                                        setCollapsedDynamics(prev => ({
                                            ...prev,
                                            [entry.id]: !prev[entry.id],
                                        }))
                                    }
                                    style={{ cursor: 'pointer' }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <MdArrowDropDown 
                                            size={20} 
                                            style={{ 
                                                transform: collapsedDynamics[entry.id] ? 'rotate(-90deg)' : 'rotate(0deg)',
                                                transition: 'transform 0.2s ease',
                                                flexShrink: 0
                                            }} 
                                        />
                                        <span className={styles.phaseIdPill}>
                                            id：{entry.id}
                                        </span>
                                    </div>
                                    <label 
                                        className={styles.phaseToggle}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={entry.enabled}
                                            onChange={(e) => {
                                                e.stopPropagation();
                                                handleDynamicEntryChange(
                                                    entry.id,
                                                    'enabled',
                                                    e.target.checked,
                                                );
                                            }}
                                        />
                                        <span>enabled</span>
                                    </label>
                                    <div className={styles.phaseActions}>
                                        <button
                                            type="button"
                                            className={worldPanelStyles.ghostTiny}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setDynamicToDelete(entry.id);
                                            }}
                                        >
                                            删除
                                        </button>
                                        <button
                                            type="button"
                                            className={worldPanelStyles.ghostTiny}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleSaveDynamicEntry(entry.id);
                                            }}
                                        >
                                            保存
                                        </button>
                                    </div>
                                </div>
                                {!collapsedDynamics[entry.id] && (
                                <div className={styles.phaseFields}>
                                    <label>
                                        <span className={worldPanelStyles.fieldLabel}>category</span>
                                        <input
                                            type="text"
                                            value={entry.category}
                                            onChange={(e) =>
                                                handleDynamicEntryChange(
                                                    entry.id,
                                                    'category',
                                                    e.target.value,
                                                )
                                            }
                                        />
                                    </label>
                                    <label>
                                        <span className={worldPanelStyles.fieldLabel}>content</span>
                                        <textarea
                                            rows={3}
                                            value={entry.content}
                                            onChange={(e) =>
                                                handleDynamicEntryChange(
                                                    entry.id,
                                                    'content',
                                                    e.target.value,
                                                )
                                            }
                                        />
                                    </label>
                                    <label>
                                        <span className={worldPanelStyles.fieldLabel}>activationConditions.flags.required</span>
                                        <input
                                            type="text"
                                            value={(entry.activationConditions?.flags?.required ?? []).join(', ')}
                                            onChange={(e) =>
                                                handleDynamicActivationFlagsChange(
                                                    entry.id,
                                                    e.target.value,
                                                )
                                            }
                                        />
                                    </label>
                                    <label>
                                        <span className={worldPanelStyles.fieldLabel}>activationConditions.probability</span>
                                        <input
                                            type="number"
                                            value={entry.activationConditions?.probability ?? 0}
                                            onChange={(e) =>
                                                handleDynamicNumberFieldChange(
                                                    entry.id,
                                                    'probability',
                                                    e.target.value,
                                                )
                                            }
                                        />
                                    </label>
                                    <label>
                                        <span className={worldPanelStyles.fieldLabel}>activationConditions.maxActivations</span>
                                        <input
                                            type="number"
                                            value={entry.activationConditions?.maxActivations ?? 0}
                                            onChange={(e) =>
                                                handleDynamicNumberFieldChange(
                                                    entry.id,
                                                    'maxActivations',
                                                    e.target.value,
                                                )
                                            }
                                        />
                                    </label>
                                    <label>
                                        <span className={worldPanelStyles.fieldLabel}>setFlags</span>
                                        <input
                                            type="text"
                                            value={(entry.setFlags || []).join(', ')}
                                            onChange={(e) =>
                                                handleDynamicSetFlagsChange(
                                                    entry.id,
                                                    e.target.value,
                                                )
                                            }
                                        />
                                    </label>
                                    <div className={styles.dynamicNumberRow}>
                                        <label>
                                            <span className={worldPanelStyles.fieldLabel}>sticky</span>
                                            <input
                                                type="number"
                                                value={entry.sticky}
                                                onChange={(e) =>
                                                    handleDynamicNumberFieldChange(
                                                        entry.id,
                                                        'sticky',
                                                        e.target.value,
                                                    )
                                                }
                                            />
                                        </label>
                                        <label>
                                            <span className={worldPanelStyles.fieldLabel}>cooldown</span>
                                            <input
                                                type="number"
                                                value={entry.cooldown}
                                                onChange={(e) =>
                                                    handleDynamicNumberFieldChange(
                                                        entry.id,
                                                        'cooldown',
                                                        e.target.value,
                                                    )
                                                }
                                            />
                                        </label>
                                        <label>
                                            <span className={worldPanelStyles.fieldLabel}>order</span>
                                            <input
                                                type="number"
                                                value={entry.order}
                                                onChange={(e) =>
                                                    handleDynamicNumberFieldChange(
                                                        entry.id,
                                                        'order',
                                                        e.target.value,
                                                    )
                                                }
                                            />
                                        </label>
                                    </div>
                                </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
                </>
            )}

            {/* 删除 phase 确认弹窗 */}
            <ConfirmModal
                isOpen={!!phaseToDelete}
                onConfirm={async () => {
                    if (phaseToDelete) {
                        await doDeletePhase(phaseToDelete);
                    }
                    setPhaseToDelete(null);
                }}
                onCancel={() => setPhaseToDelete(null)}
                title="删除章节"
                message="确定要删除当前章节（phase）吗？此操作不可撤销。"
                confirmButtonText="删除"
                cancelButtonText="取消"
            />

            {/* 删除 dynamicEntry 确认弹窗 */}
            <ConfirmModal
                isOpen={!!dynamicToDelete}
                onConfirm={async () => {
                    if (dynamicToDelete) {
                        await doDeleteDynamicEntry(dynamicToDelete);
                    }
                    setDynamicToDelete(null);
                }}
                onCancel={() => setDynamicToDelete(null)}
                title="删除动态条目"
                message="确定要删除当前 dynamicEntry 吗？此操作不可撤销。"
                confirmButtonText="删除"
                cancelButtonText="取消"
            />

            {/* 新增 phase 弹窗 */}
            {isAddPhaseModalOpen && (
                <div className={styles.inlineModalOverlay}>
                    <div className={styles.inlineModal}>
                        <h3 className={styles.inlineModalTitle}>新增 phase</h3>
                        <div className={styles.inlineModalBody}>
                            <div className={styles.inlineTwoCol}>
                                <label>
                                    <span className={worldPanelStyles.fieldLabel}>name</span>
                                    <input
                                        type="text"
                                        value={newPhase.name}
                                        onChange={(e) =>
                                            setNewPhase(prev => ({ ...prev, name: e.target.value }))
                                        }
                                    />
                                </label>
                                <label>
                                    <span className={worldPanelStyles.fieldLabel}>activeFlags（逗号分隔）</span>
                                    <input
                                        type="text"
                                        value={newPhase.activeFlags}
                                        onChange={(e) =>
                                            setNewPhase(prev => ({
                                                ...prev,
                                                activeFlags: e.target.value,
                                            }))
                                        }
                                    />
                                </label>
                            </div>
                            <label>
                                <span className={worldPanelStyles.fieldLabel}>description</span>
                                <textarea
                                    rows={2}
                                    value={newPhase.description}
                                    onChange={(e) =>
                                        setNewPhase(prev => ({ ...prev, description: e.target.value }))
                                    }
                                />
                            </label>
                            <label>
                                <span className={worldPanelStyles.fieldLabel}>context</span>
                                <textarea
                                    rows={3}
                                    value={newPhase.context}
                                    onChange={(e) =>
                                        setNewPhase(prev => ({ ...prev, context: e.target.value }))
                                    }
                                />
                            </label>
                            <label className={styles.inlineCheckboxRow}>
                                <input
                                    type="checkbox"
                                    checked={newPhase.activeByDefault}
                                    onChange={(e) =>
                                        setNewPhase(prev => ({
                                            ...prev,
                                            activeByDefault: e.target.checked,
                                        }))
                                    }
                                />
                                <span>activeByDefault（默认可进入）</span>
                            </label>
                            <label className={styles.inlineCheckboxRow}>
                                <input
                                    type="checkbox"
                                    checked={newPhase.isFinalPhase}
                                    onChange={(e) =>
                                        setNewPhase(prev => ({
                                            ...prev,
                                            isFinalPhase: e.target.checked,
                                        }))
                                    }
                                />
                                <span>isFinalPhase（是否终章）</span>
                            </label>
                        </div>
                        <div className={styles.inlineModalActions}>
                            <button
                                type="button"
                                className={worldPanelStyles.ghostSmall}
                                onClick={() => setIsAddPhaseModalOpen(false)}
                            >
                                取消
                            </button>
                            <button
                                type="button"
                                className={worldPanelStyles.primary}
                                onClick={handleAddPhase}
                            >
                                确认新增
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 新增 dynamicEntry 弹窗 */}
            {isAddDynamicModalOpen && (
                <div className={styles.inlineModalOverlay}>
                    <div className={styles.inlineModal}>
                        <h3 className={styles.inlineModalTitle}>新增 dynamicEntry</h3>
                        <div className={styles.inlineModalBody}>
                            <div className={styles.inlineTwoCol}>
                                <label>
                                    <span className={worldPanelStyles.fieldLabel}>category</span>
                                    <input
                                        type="text"
                                        value={newDynamic.category}
                                        onChange={(e) =>
                                            setNewDynamic(prev => ({ ...prev, category: e.target.value }))
                                        }
                                    />
                                </label>
                                <label>
                                    <span className={worldPanelStyles.fieldLabel}>enabled</span>
                                    <div className={styles.inlineCheckboxRow}>
                                        <input
                                            type="checkbox"
                                            checked={newDynamic.enabled}
                                            onChange={(e) =>
                                                setNewDynamic(prev => ({
                                                    ...prev,
                                                    enabled: e.target.checked,
                                                }))
                                            }
                                        />
                                        <span>是否启用</span>
                                    </div>
                                </label>
                            </div>
                            <label>
                                <span className={worldPanelStyles.fieldLabel}>content</span>
                                <textarea
                                    rows={4}
                                    value={newDynamic.content}
                                    onChange={(e) =>
                                        setNewDynamic(prev => ({ ...prev, content: e.target.value }))
                                    }
                                />
                            </label>
                            <label>
                                <span className={worldPanelStyles.fieldLabel}>activationConditions.flags.required（逗号分隔）</span>
                                <input
                                    type="text"
                                    value={newDynamic.requiredFlags}
                                    onChange={(e) =>
                                        setNewDynamic(prev => ({
                                            ...prev,
                                            requiredFlags: e.target.value,
                                        }))
                                    }
                                />
                            </label>
                            <div className={styles.dynamicNumberRow}>
                                <label>
                                    <span className={worldPanelStyles.fieldLabel}>probability</span>
                                    <input
                                        type="number"
                                        value={newDynamic.probability}
                                        onChange={(e) =>
                                            setNewDynamic(prev => ({
                                                ...prev,
                                                probability: Number(e.target.value) || 0,
                                            }))
                                        }
                                    />
                                </label>
                                <label>
                                    <span className={worldPanelStyles.fieldLabel}>maxActivations</span>
                                    <input
                                        type="number"
                                        value={newDynamic.maxActivations}
                                        onChange={(e) =>
                                            setNewDynamic(prev => ({
                                                ...prev,
                                                maxActivations: Number(e.target.value) || 0,
                                            }))
                                        }
                                    />
                                </label>
                            </div>
                            <div className={styles.dynamicNumberRow}>
                                <label>
                                    <span className={worldPanelStyles.fieldLabel}>sticky</span>
                                    <input
                                        type="number"
                                        value={newDynamic.sticky}
                                        onChange={(e) =>
                                            setNewDynamic(prev => ({
                                                ...prev,
                                                sticky: Number(e.target.value) || 0,
                                            }))
                                        }
                                    />
                                </label>
                                <label>
                                    <span className={worldPanelStyles.fieldLabel}>cooldown</span>
                                    <input
                                        type="number"
                                        value={newDynamic.cooldown}
                                        onChange={(e) =>
                                            setNewDynamic(prev => ({
                                                ...prev,
                                                cooldown: Number(e.target.value) || 0,
                                            }))
                                        }
                                    />
                                </label>
                                <label>
                                    <span className={worldPanelStyles.fieldLabel}>order</span>
                                    <input
                                        type="number"
                                        value={newDynamic.order}
                                        onChange={(e) =>
                                            setNewDynamic(prev => ({
                                                ...prev,
                                                order: Number(e.target.value) || 0,
                                            }))
                                        }
                                    />
                                </label>
                            </div>
                        </div>
                        <div className={styles.inlineModalActions}>
                            <button
                                type="button"
                                className={worldPanelStyles.ghostSmall}
                                onClick={() => setIsAddDynamicModalOpen(false)}
                            >
                                取消
                            </button>
                            <button
                                type="button"
                                className={worldPanelStyles.primary}
                                onClick={handleAddDynamicEntry}
                            >
                                确认新增
                            </button>
                        </div>
                    </div>
                </div>
            )}
                </>
            )}
        </div>
    );
};

export default StoryStructureAdvanced;
