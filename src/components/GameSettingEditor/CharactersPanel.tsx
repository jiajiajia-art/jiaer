import React, { useState } from 'react';
import styles from './CharactersPanel.module.css';

interface Relationship {
    id: string;
    name: string;
    description: string;
}

interface Variation {
    id: string;
    label: string;
    img: string;
}

interface Character {
    id: string;
    name: string;
    callName: string;
    gender: string;
    role: string;
    identity: string;
    personality: string[];
    speech: string;
    appearance: string;
    portrait: string;
    background: string;
    growth: string;
    goalShort: string;
    goalLong: string;
    secret: string;
    relationships: Relationship[];
    variations: Variation[];
}

const CharactersPanel: React.FC = () => {
    const [activeCharacterId, setActiveCharacterId] = useState<string>('mc');

    const [characterData, setCharacterData] = useState<Character[]>([
        {
            id: 'mc',
            name: '林星野',
            callName: '星野',
            gender: '♀',
            role: '主角',
            identity: '量子航迹科 · 转校生',
            personality: ['坚韧', '冷静', '隐忍'],
            speech: '语气偏冷静，会用物理术语隐喻情绪。',
            appearance: '短发 · 深蓝校服 · 挂量子扫描器 · 沉稳目光',
            portrait: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=600&q=80',
            background: '成长于边境殖民地，父母是量子航迹工程师。因为一次跃迁事故失去姐姐，决定来到星航学院查明真相。',
            growth: '幼年与姐姐在废弃船坞做实验 → 被军方救援收为特别学生 → 多次跳级进入量子航迹科 → 在学院遭遇抵触。',
            goalShort: '证明事故并非姐姐的操作失误，争取导师推荐加入核心项目。',
            goalLong: '重建更安全的跃迁协议，阻止人类与辉潮之间的战争。',
            secret: '曾经被辉潮意识侵扰，偶尔能预感共鸣走向但不敢告诉别人。',
            relationships: [
                { id: 'r1', name: '星海 · 玲', description: '表面互相针锋相对，实际在技术上互补；玲的冒险精神刺激星野拾回激情。' },
                { id: 'r2', name: '真砂老师', description: '导师兼监护人，知晓她被辉潮影响的秘密。' },
            ],
            variations: [
                { id: 'v1', label: '平静', img: 'https://picsum.photos/seed/xingye-calm/240/320' },
                { id: 'v2', label: '害羞', img: 'https://picsum.photos/seed/xingye-shy/240/320' },
                { id: 'v3', label: '震惊', img: 'https://picsum.photos/seed/xingye-shock/240/320' },
            ],
        },
        {
            id: 'heroine',
            name: '星海 · 玲',
            callName: '玲',
            gender: '♀',
            role: '女主角',
            identity: '星舰舰长之女 · 能源调谐员',
            personality: ['元气', '傲娇', '校花'],
            speech: '句尾常带"嘛"，紧张时会拿星舰部件做比喻。',
            appearance: '粉蓝渐变长发 · 旗舰制服 · 能源扇形装置',
            portrait: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=600&q=80',
            background: '出生在旗舰舰长家庭，自幼在星舰上长大，热爱亮闪闪的能源调谐器却被迫背负政治联姻。',
            growth: '小学阶段跟随父亲巡航 → 因共鸣失控被迫留校 → 与陆岚竞争第一名 → 在主角转学前夕被安排继承人考核。',
            goalShort: '证明自己能独立通过星际考核，不依赖家族特权。',
            goalLong: '打造属于学生自治的星舰小队，打破家族对学院的操控。',
            secret: '在匿名频道里写情绪日志，担心被发现真实脆弱。',
            relationships: [
                { id: 'r1', name: '林星野', description: '从对手到搭档，欣赏星野的冷静；会假装不在意但正在逐渐信任。' },
                { id: 'r2', name: '陆岚', description: '曾经最好的朋友，如今因家族派系不同产生裂痕。' },
            ],
            variations: [
                { id: 'v1', label: '开心', img: 'https://picsum.photos/seed/xinghai-happy/240/320' },
                { id: 'v2', label: '害羞', img: 'https://picsum.photos/seed/xinghai-shy/240/320' },
            ],
        },
        {
            id: 'npc01',
            name: '真砂老师',
            callName: '真砂教官',
            gender: '♂',
            role: '导师 NPC',
            identity: 'AI 推演课程负责人',
            personality: ['温柔', '戏谑'],
            speech: '喜欢提问后留空白，让 AI 自己补完。',
            appearance: '白衬衫 · 长外套 · 漂浮资料屏幕',
            portrait: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80',
            background: '退役的 AI 推演专家，被学院请回授课。对学生宽容，是少数支持自由推演的导师。',
            growth: '参与第一代量子跃迁测试 → 在事故中失去同伴 → 决意将经验传给下一代 → 暗中调查辉潮。',
            goalShort: '让班级通过学院的实时推演考核。',
            goalLong: '建立可审计的 AI 推演体系，避免历史悲剧重演。',
            secret: '怀疑学院高层操纵数据，手上握有未公开的黑匣子记录。',
            relationships: [
                { id: 'r1', name: '林星野', description: '半导师半父亲的存在，负责压制她的情绪波动。' },
                { id: 'r2', name: '陆岚', description: '欣赏她的执行力，却担心她过度极端。' },
            ],
            variations: [
                { id: 'v1', label: '认真', img: 'https://picsum.photos/seed/masharu-serious/240/320' },
            ],
        },
        {
            id: 'npc02',
            name: '陆岚',
            callName: '陆岚',
            gender: '♀',
            role: '对手 NPC',
            identity: '策略组第一名',
            personality: ['果断', '毒舌'],
            speech: '回答会附带数据百分比。',
            appearance: '黑长直 · 战术披风 · AR 眼镜',
            portrait: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=600&q=80',
            background: '来自策略组第一名的天才，家族与学院高层关系密切，却偏偏崇尚效率至上的军队文化。',
            growth: '幼年被投入模拟战场训练 → 与星海·玲一起成长 → 因理念不同转向策略组 → 暗中调查主角的来历。',
            goalShort: '在考核中击败星野，证明自己的最优策略。',
            goalLong: '让学院回归军事化管理，以抵抗辉潮威胁。',
            secret: '害怕感情干扰判断，曾拒绝星海的求助导致友谊破裂。',
            relationships: [
                { id: 'r1', name: '星海 · 玲', description: '复杂的旧友，既想守护又想打败。' },
                { id: 'r2', name: '林星野', description: '通过她观察学院的真实目的，视为潜在威胁。' },
            ],
            variations: [
                { id: 'v1', label: '挑衅', img: 'https://picsum.photos/seed/lulan-sneer/240/320' },
                { id: 'v2', label: '罕见微笑', img: 'https://picsum.photos/seed/lulan-smile/240/320' },
            ],
        },
    ]);

    const activeCharacter = characterData.find(c => c.id === activeCharacterId) || characterData[0];

    // 更新角色字段
    const updateField = (field: keyof Character, value: string | string[]) => {
        setCharacterData(prev =>
            prev.map(char =>
                char.id === activeCharacterId ? { ...char, [field]: value } : char
            )
        );
    };

    const handleFieldChange = (field: keyof Character, value: string) => {
        if (field === 'personality') {
            const tags = value.split(/[，,\/、\s]+/).map(tag => tag.trim()).filter(Boolean);
            updateField(field, tags);
        } else {
            updateField(field, value);
        }
    };

    // 关系管理
    const addRelationship = () => {
        const newRel: Relationship = { id: `r-${Date.now()}`, name: '', description: '' };
        setCharacterData(prev =>
            prev.map(char =>
                char.id === activeCharacterId
                    ? { ...char, relationships: [...char.relationships, newRel] }
                    : char
            )
        );
    };

    const updateRelationship = (relId: string, key: 'name' | 'description', value: string) => {
        setCharacterData(prev =>
            prev.map(char =>
                char.id === activeCharacterId
                    ? {
                        ...char,
                        relationships: char.relationships.map(r =>
                            r.id === relId ? { ...r, [key]: value } : r
                        ),
                    }
                    : char
            )
        );
    };

    const removeRelationship = (relId: string) => {
        setCharacterData(prev =>
            prev.map(char =>
                char.id === activeCharacterId
                    ? { ...char, relationships: char.relationships.filter(r => r.id !== relId) }
                    : char
            )
        );
    };

    // 差分管理
    const addVariation = () => {
        const label = prompt('输入差分标签', '新差分');
        if (!label) return;
        const newVar: Variation = { id: `v-${Date.now()}`, label, img: '' };
        setCharacterData(prev =>
            prev.map(char =>
                char.id === activeCharacterId
                    ? { ...char, variations: [...char.variations, newVar] }
                    : char
            )
        );
    };

    return (
        <div className={styles.panelContent}>
            <div className={styles.panelHeader}>
                <div>
                    <p className={styles.eyebrow}>Step 3</p>
                    <h2>角色档案 & 立绘差分</h2>
                    <p className={styles.subtitle}>解析出的角色自动列出，可逐项确认姓名、称呼、口癖与立绘</p>
                </div>
                <button className={styles.ghost}>导出角色 JSON</button>
            </div>

            <div className={styles.characterLayout}>
                {/* 左栏 - 角色列表 */}
                <div className={styles.card}>
                    <h3>解析出的角色</h3>
                    <div className={styles.characterRoster}>
                        {characterData.map((character) => (
                            <article
                                key={character.id}
                                className={`${styles.characterRow} ${character.id === activeCharacterId ? styles.active : ''}`}
                                onClick={() => setActiveCharacterId(character.id)}
                            >
                                <div
                                    className={styles.characterThumb}
                                    style={{ backgroundImage: `url('${character.portrait}')` }}
                                />
                                <div className={styles.characterMeta}>
                                    <strong>{character.name}</strong>
                                    <p className={styles.mutedSmall}>{character.role} · {character.identity}</p>
                                    <div className={styles.tagRow}>
                                        {character.personality.map((tag) => (
                                            <span key={tag} className={styles.tag}>{tag}</span>
                                        ))}
                                    </div>
                                </div>
                            </article>
                        ))}
                    </div>
                </div>

                {/* 右栏 - 角色详情 */}
                <div className={styles.card}>
                    {/* 立绘 */}
                    <div
                        className={styles.portraitLarge}
                        style={{ backgroundImage: `url('${activeCharacter.portrait}')` }}
                    >
                        <span className={styles.portraitHint}>点击替换角色基础立绘</span>
                    </div>

                    {/* 基础信息表单 */}
                    <div className={styles.formGrid}>
                        <label>
                            <span>姓名</span>
                            <input type="text" value={activeCharacter.name} onChange={(e) => handleFieldChange('name', e.target.value)} />
                        </label>
                        <label>
                            <span>称呼 / 昵称</span>
                            <input type="text" value={activeCharacter.callName} onChange={(e) => handleFieldChange('callName', e.target.value)} />
                        </label>
                        <label>
                            <span>性别 / 形体</span>
                            <input type="text" value={activeCharacter.gender} onChange={(e) => handleFieldChange('gender', e.target.value)} />
                        </label>
                        <label>
                            <span>身份 / 当前身份</span>
                            <input type="text" value={activeCharacter.identity} onChange={(e) => handleFieldChange('identity', e.target.value)} />
                        </label>
                        <label className={styles.wide}>
                            <span>性格标签</span>
                            <input type="text" value={activeCharacter.personality.join(' / ')} onChange={(e) => handleFieldChange('personality', e.target.value)} />
                        </label>
                        <label className={styles.wide}>
                            <span>口癖 / 语气</span>
                            <textarea rows={3} value={activeCharacter.speech} onChange={(e) => handleFieldChange('speech', e.target.value)} />
                        </label>
                        <label className={styles.wide}>
                            <span>外貌描述 / Prompt</span>
                            <textarea rows={3} value={activeCharacter.appearance} onChange={(e) => handleFieldChange('appearance', e.target.value)} />
                        </label>
                    </div>

                    {/* 人物背景 & 动机 */}
                    <div className={styles.detailBlock}>
                        <div className={styles.cardHead}>
                            <strong>人物背景 & 动机</strong>
                            <span className={styles.mutedSmall}>不限格式，所有内容均是选填</span>
                        </div>
                        <div className={styles.formGrid}>
                            <label className={styles.wide}>
                                <span>人物背景故事</span>
                                <textarea rows={4} value={activeCharacter.background} onChange={(e) => handleFieldChange('background', e.target.value)} />
                            </label>
                            <label className={styles.wide}>
                                <span>成长经历 / 转折</span>
                                <textarea rows={4} value={activeCharacter.growth} onChange={(e) => handleFieldChange('growth', e.target.value)} />
                            </label>
                            <label>
                                <span>短期目标</span>
                                <input type="text" value={activeCharacter.goalShort} onChange={(e) => handleFieldChange('goalShort', e.target.value)} />
                            </label>
                            <label>
                                <span>长期愿景</span>
                                <input type="text" value={activeCharacter.goalLong} onChange={(e) => handleFieldChange('goalLong', e.target.value)} />
                            </label>
                            <label className={styles.wide}>
                                <span>隐藏秘密 / 禁忌</span>
                                <textarea rows={3} value={activeCharacter.secret} onChange={(e) => handleFieldChange('secret', e.target.value)} />
                            </label>
                        </div>
                    </div>

                    {/* 人物关系 */}
                    <div className={styles.detailBlock}>
                        <div className={styles.cardHead}>
                            <strong>人物关系</strong>
                            <button className={styles.ghostTiny} onClick={addRelationship}>+ 添加关系</button>
                        </div>
                        <div className={styles.relationshipList}>
                            {activeCharacter.relationships.length === 0 ? (
                                <p className={styles.mutedSmall}>暂无关系。可添加与其他 NPC 的亲疏、不同身份下的角色差异等信息。</p>
                            ) : (
                                activeCharacter.relationships.map((rel) => (
                                    <div key={rel.id} className={styles.relationshipRow}>
                                        <label>
                                            <span>对象 / 称呼</span>
                                            <input type="text" value={rel.name} onChange={(e) => updateRelationship(rel.id, 'name', e.target.value)} />
                                        </label>
                                        <label className={styles.wide}>
                                            <span>关系描述</span>
                                            <textarea rows={3} value={rel.description} onChange={(e) => updateRelationship(rel.id, 'description', e.target.value)} />
                                        </label>
                                        <button className={styles.ghostTiny} onClick={() => removeRelationship(rel.id)}>删除</button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* 立绘差分 */}
                    <div className={styles.detailBlock}>
                        <div className={styles.cardHead}>
                            <strong>立绘差分</strong>
                            <span className={styles.mutedSmall}>默认 + {activeCharacter.variations.length} 个差分</span>
                        </div>
                        <div className={styles.variationGrid}>
                            {activeCharacter.variations.map((variation) => (
                                <div key={variation.id} className={styles.variationCard}>
                                    <div
                                        className={`${styles.variationThumb} ${!variation.img ? styles.empty : ''}`}
                                        style={variation.img ? { backgroundImage: `url('${variation.img}')` } : {}}
                                    >
                                        {!variation.img && <span className={styles.mutedSmall}>等待图片</span>}
                                    </div>
                                    <p>{variation.label}</p>
                                    <div className={styles.variationActions}>
                                        <button className={styles.ghostTiny}>上传图片</button>
                                        <button className={styles.ghostTiny}>AI 生成</button>
                                    </div>
                                </div>
                            ))}
                            <button className={styles.addCard} onClick={addVariation}>+ 新差分</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CharactersPanel;
