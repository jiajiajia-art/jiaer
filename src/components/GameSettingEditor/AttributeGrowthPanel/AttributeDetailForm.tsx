import React from 'react';
import styles from './AttributeDetailForm.module.css';
import type { AttributeConfig, AttributeTarget } from './types';
import { useWordLimit, useWordCount } from '../../../hooks/editor/useWordLimit';

const WORD_LIMITS = {
    key: 20,
    displayName: 10,
    description: 100,
    formula: 200,
} as const;

interface AttributeDetailFormProps {
    formState: Partial<AttributeConfig> | null;
    onChange: (updates: Partial<AttributeConfig>) => void;
    onSave?: () => void;
}

const AttributeDetailForm: React.FC<AttributeDetailFormProps> = ({
    formState,
    onChange,
    onSave,
}) => {
    // 字数统计
    const keyWords = useWordCount(formState?.key ?? '');
    const displayNameWords = useWordCount(formState?.displayName ?? '');
    const descriptionWords = useWordCount(formState?.description ?? '');
    const formulaWords = useWordCount(formState?.formula ?? '');

    // 字数限制处理
    const keyLimit = useWordLimit(WORD_LIMITS.key, (value) => onChange({ key: value }));
    const displayNameLimit = useWordLimit(WORD_LIMITS.displayName, (value) => onChange({ displayName: value }));
    const descriptionLimit = useWordLimit(WORD_LIMITS.description, (value) => onChange({ description: value }));
    const formulaLimit = useWordLimit(WORD_LIMITS.formula, (value) => onChange({ formula: value }));

    if (!formState) {
        return (
            <div className={styles.rightCard}>
                <div className={styles.rightHeader}>
                    <h3 className={styles.rightTitle}>属性设置</h3>
                    <p className={styles.rightHint}>请先选择一个属性或点击「+ 添加属性」创建新属性。</p>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.rightCard}>
            <div className={styles.rightHeader}>
                <h3 className={styles.rightTitle}>属性设置</h3>
                <p className={styles.rightHint}>定义 Key、描述、默认值与上限，支持配置展示规则与计算公式。</p>
            </div>

            <div className={styles.formGrid}>
                <div className={styles.field}>
                    <div className={styles.labelRow}>
                        <span className={styles.labelMain}>
                            作用对象 <span className={styles.required}>*</span>
                        </span>
                    </div>
                    <select
                        className={styles.select}
                        value={formState.target ?? 'player'}
                        onChange={(e) => onChange({ target: e.target.value as AttributeTarget })}
                    >
                        <option value="player">玩家属性</option>
                        <option value="npc">NPC 属性</option>
                    </select>
                </div>

                <div className={styles.field}>
                    <div className={styles.labelRow}>
                        <span className={styles.labelMain}>
                            Key（唯一） <span className={styles.required}>*</span>
                        </span>
                        <span className={styles.wordCounter}>
                            {keyWords}/{WORD_LIMITS.key}
                        </span>
                    </div>
                    <input
                        className={styles.input}
                        placeholder="如 stamina"
                        value={formState.key ?? ''}
                        {...keyLimit}
                    />
                </div>

                <div className={`${styles.field} ${styles.formRowFull}`}>
                    <div className={styles.labelRow}>
                        <span className={styles.labelMain}>
                            显示名称 <span className={styles.required}>*</span>
                        </span>
                        <span className={styles.wordCounter}>
                            {displayNameWords}/{WORD_LIMITS.displayName}
                        </span>
                    </div>
                    <input
                        className={styles.input}
                        placeholder="例如：体力 / 情绪"
                        value={formState.displayName ?? ''}
                        {...displayNameLimit}
                    />
                </div>

                <div className={`${styles.field} ${styles.formRowFull}`}>
                    <div className={styles.labelRow}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                            <div>
                                <span className={styles.labelMain}>
                                    描述 <span className={styles.required}>*</span>
                                </span>
                                <span>用于拼接到 Prompt 中，说明属性含义</span>
                            </div>
                            <span className={styles.wordCounter}>
                                {descriptionWords}/{WORD_LIMITS.description}
                            </span>
                        </div>
                    </div>
                    <textarea
                        className={styles.textarea}
                        placeholder="属性含义说明，用于引导模型如何理解和使用该属性。"
                        value={formState.description ?? ''}
                        {...descriptionLimit}
                    />
                </div>

                <div className={`${styles.field} ${styles.formRowFull}`}>
                    <div className={styles.labelRow}>
                        <span className={styles.labelMain}>
                            默认值 / 上限 / 单位 <span className={styles.required}>*</span>
                        </span>
                    </div>
                    <div className={styles.inlineInputs}>
                        <input
                            className={styles.input}
                            type="number"
                            placeholder="默认值（如 50）"
                            value={formState.defaultValue ?? ''}
                            onChange={(e) => onChange({ defaultValue: Number(e.target.value) || 0 })}
                        />
                        <input
                            className={styles.input}
                            type="number"
                            placeholder="上限（如 100）"
                            value={formState.maxValue ?? ''}
                            onChange={(e) => onChange({ maxValue: Number(e.target.value) || 0 })}
                        />
                        <input
                            className={styles.input}
                            placeholder="单位（如 点 / %）"
                            value={formState.unit ?? ''}
                            onChange={(e) => onChange({ unit: e.target.value })}
                        />
                    </div>
                </div>

                <div className={`${styles.field} ${styles.formRowFull}`}>
                    <div className={styles.labelRow}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                            <div>
                                <span className={styles.labelMain}>公式 / 计算方式（可选）</span>
                                <span>示例：基础值 + 消耗 × 恢复</span>
                            </div>
                            <span className={styles.wordCounter}>
                                {formulaWords}/{WORD_LIMITS.formula}
                            </span>
                        </div>
                    </div>
                    <textarea
                        className={styles.textarea}
                        placeholder="可选：填写简单的文字公式，帮助系统和自己回忆该属性的增减逻辑。"
                        value={formState.formula ?? ''}
                        {...formulaLimit}
                    />
                </div>
            </div>

            <div className={styles.footer}>
                <div className={styles.footerLeft}>
                    <div className={styles.toggleRow}>
                        <input
                            type="checkbox"
                            className={styles.toggleInput}
                            checked={formState.visible ?? true}
                            onChange={(e) => onChange({ visible: e.target.checked })}
                        />
                        <span className={styles.toggleLabel}>是否展示（控制该属性是否在游戏测试时对玩家可见）</span>
                    </div>
                </div>
                <button type="button" className={styles.primaryBtn} onClick={onSave}>
                    保存属性设置
                </button>
            </div>
        </div>
    );
};

export default AttributeDetailForm;

