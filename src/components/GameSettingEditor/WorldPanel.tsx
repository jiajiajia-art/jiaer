import React, { useState } from 'react';
import styles from './WorldPanel.module.css';

interface WorldField {
    id: string;
    label: string;
    type: 'text' | 'textarea';
    rows?: number;
    value: string;
    hint?: string;
}

interface StoryLine {
    id: string;
    tag: string;
    content: string;
}

const WorldPanel: React.FC = () => {
    // 所有表单字段统一管理
    const [worldFields, setWorldFields] = useState<WorldField[]>([
        { id: 'title', label: '作品标题', type: 'text', value: '星航学院' },
        { id: 'tagline', label: '一句话概述', type: 'text', value: '量子跃迁技术普及后的校园恋爱与星际冒险交织。' },
        { id: 'era', label: '时代背景 / 前情提要', type: 'textarea', rows: 6, value: '近未来 · 公元 2145 年。\n量子跃迁成为全球基础设施，但人类在与外星文明"辉潮"的关系中持续紧张。星航学院被迫接管外交、军事、情感调停等多重职责。' },
        { id: 'worldRules', label: '世界规则', type: 'textarea', rows: 4, value: '1. 星航学院负责培育跨星系外交官；2. 量子跃迁由学生亲自校准；3. 外星文明"辉潮"以情绪频率判断人类可信度。' },
        { id: 'playerRole', label: '玩家身份', type: 'text', value: '玩家将扮演转学到星航学院的量子航迹观察员  &  玩家将从第三人称视角体验游戏，观察角色和世界的发展' },
        { id: 'opening', label: '开场白', type: 'textarea', rows: 5, value: '量子跃迁穹顶透出海蓝色的光，你——新的航迹观察员——第一次踏入星航学院。所有命运枝条，正等待你轻触。', hint: '用于玩家进入游戏时的第一段旁白，可随时微调语气。' },
        { id: 'openingPlot', label: '开场剧情', type: 'textarea', rows: 5, value: '【主角抵达】→ 登记信息 → 与星海·玲擦肩而过 → 真砂老师让 AI 记录主角情绪波动 → 晚间寝室收到匿名讯息，为分支埋伏笔。', hint: '描述第一轮推演至玩家做出首个选择前的剧情骨架，用于引导 AI 理解节奏。' },
        { id: 'constraints', label: '附加约束（可选）', type: 'textarea', rows: 4, value: '示例：\n1. 立刻安抚星海 · 玲\n2. 让真砂老师出面\n3. 交给学院 AI 判断\n可根据节点补充更多备选。', hint: '在 AI 推演当中应该遵守的其他约定，这些约束将帮助 AI 生成更加符合预期的剧情。' },
        { id: 'tone', label: '文风要求（可选）', type: 'textarea', rows: 4, value: '保持青春、浪漫又带科幻硬核的叙述，角色对白混合生活化口吻与专业术语，禁止出现"魔法""斗气"等词汇。', hint: '限定语言风格、叙述视角、禁用词汇等，帮助 AI 保持统一语气。' },
    ]);

    // 故事线
    const [storylines, setStorylines] = useState<StoryLine[]>([
        { id: '1', tag: 'Day 1 下午 · 入学仪式', content: '玩家与星海·玲共同行进，需在混乱的量子共鸣中做出第一轮选择，决定两人关系基调。' },
        { id: '2', tag: '好感 60% 以上', content: '触发星舰甲板私密对话，允许玩家探索玲的真实动机；若失败则进入冷战分支。' },
    ]);

    const handleFieldChange = (fieldId: string, value: string) => {
        setWorldFields(prev => prev.map(f => f.id === fieldId ? { ...f, value } : f));
    };

    const handleStorylineChange = (id: string, key: 'tag' | 'content', value: string) => {
        setStorylines(prev => prev.map(s => s.id === id ? { ...s, [key]: value } : s));
    };

    const addStoryline = () => {
        setStorylines(prev => [...prev, {
            id: `${Date.now()}`,
            tag: `阶段 ${prev.length + 1}`,
            content: '',
        }]);
    };

    const removeStoryline = (id: string) => {
        setStorylines(prev => prev.filter(s => s.id !== id));
    };

    return (
        <div className={styles.panelContent}>
            <div className={styles.panelHeader}>
                <div>
                    <p className={styles.eyebrow}>Step 2</p>
                    <h2>世界观 & 表单化设定</h2>
                    <p className={styles.subtitle}>所有内容均来自 AI 解析，请校对这些内容</p>
                </div>
                <button className={styles.ghost}>导出为模板</button>
            </div>

            {/* 单栏表单 */}
            <div className={styles.formContainer}>
                {worldFields.map((field) => (
                    <div key={field.id} className={styles.formRow}>
                        <div className={styles.fieldHeader}>
                            <span className={styles.fieldLabel}>{field.label}</span>
                            {field.hint && <span className={styles.fieldHint}>{field.hint}</span>}
                        </div>
                        {field.type === 'textarea' ? (
                            <textarea
                                rows={field.rows || 3}
                                value={field.value}
                                onChange={(e) => handleFieldChange(field.id, e.target.value)}
                            />
                        ) : (
                            <input
                                type="text"
                                value={field.value}
                                onChange={(e) => handleFieldChange(field.id, e.target.value)}
                            />
                        )}
                    </div>
                ))}

                {/* 故事线 */}
                <div className={styles.storylineSection}>
                    <div className={styles.storylineHeader}>
                        <div>
                            <span className={styles.fieldLabel}>故事线（可选）</span>
                            <span className={styles.fieldHint}>用标签 + 内容描述关键剧情走向，方便约束 AI 推演。</span>
                        </div>
                        <button className={styles.ghostSmall} onClick={addStoryline}>+ 添加故事线</button>
                    </div>
                    <div className={styles.storylineList}>
                        {storylines.length === 0 ? (
                            <p className={styles.emptyHint}>暂未添加故事线。可按时间、好感或章节自定义标签。</p>
                        ) : (
                            storylines.map((line) => (
                                <div key={line.id} className={styles.storylineRow}>
                                    <div className={styles.storylineMeta}>
                                        <label>
                                            <span>标签</span>
                                            <input
                                                type="text"
                                                value={line.tag}
                                                onChange={(e) => handleStorylineChange(line.id, 'tag', e.target.value)}
                                            />
                                        </label>
                                    </div>
                                    <label className={styles.wide}>
                                        <span>内容</span>
                                        <textarea
                                            rows={3}
                                            value={line.content}
                                            onChange={(e) => handleStorylineChange(line.id, 'content', e.target.value)}
                                        />
                                    </label>
                                    <button
                                        className={styles.ghostTiny}
                                        onClick={() => removeStoryline(line.id)}
                                    >
                                        删除
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WorldPanel;
