import React, { useState } from 'react';
import styles from './ScenesPanel.module.css';

interface BgmItem {
    id: string;
    name: string;
    description: string;
}

interface Scene {
    id: string;
    name: string;
    type: string;
    desc: string;
    image: string;
    bgmId: string;
}

const ScenesPanel: React.FC = () => {
    const [activeSceneId, setActiveSceneId] = useState<string>('scene01');

    const [bgmLibrary, setBgmLibrary] = useState<BgmItem[]>([
        { id: 'bgm-morning', name: '晨光序曲', description: '校园 / 日常' },
        { id: 'bgm-battle', name: '量子引擎警报', description: '紧张 / 战斗准备' },
        { id: 'bgm-dream', name: '星潮呢喃', description: '浪漫 / 深夜' },
    ]);

    const [sceneData, setSceneData] = useState<Scene[]>([
        {
            id: 'scene01',
            name: '中央天幕',
            type: '校园 · 室外',
            desc: '巨型玻璃穹顶映出银河，学生在此完成星际宣誓。',
            image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80',
            bgmId: 'bgm-morning',
        },
        {
            id: 'scene02',
            name: '量子引擎仓',
            type: '科技 · 室内',
            desc: '蓝白色能量舱室，脉冲光随剧情强度闪烁。',
            image: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=900&q=80',
            bgmId: 'bgm-battle',
        },
        {
            id: 'scene03',
            name: '宿舍 · B507',
            type: '生活 · 室内',
            desc: '暖色灯带与城市夜景，适合情感铺垫与回忆杀。',
            image: 'https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=900&q=80',
            bgmId: 'bgm-dream',
        },
        {
            id: 'scene04',
            name: '星舰甲板',
            type: '太空 · 户外',
            desc: '无重力粒子雨，重大剧情节点触发地点。',
            image: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=900&q=80',
            bgmId: '',
        },
    ]);

    const activeScene = sceneData.find(s => s.id === activeSceneId) || sceneData[0];

    // 更新场景字段
    const updateSceneField = (field: keyof Scene, value: string) => {
        setSceneData(prev =>
            prev.map(scene =>
                scene.id === activeSceneId ? { ...scene, [field]: value } : scene
            )
        );
    };

    // 添加场景
    const addScene = () => {
        const name = prompt('请输入场景名称', `新场景 ${sceneData.length + 1}`) || '未命名场景';
        const newScene: Scene = {
            id: `scene-${Date.now()}`,
            name,
            type: '自定义场景',
            desc: '请补充场景描述，用于提示美术风格与剧情氛围。',
            image: '',
            bgmId: '',
        };
        setSceneData(prev => [newScene, ...prev]);
        setActiveSceneId(newScene.id);
    };

    // 更新 BGM
    const updateBgm = (bgmId: string, key: 'name' | 'description', value: string) => {
        setBgmLibrary(prev =>
            prev.map(bgm => bgm.id === bgmId ? { ...bgm, [key]: value } : bgm)
        );
    };

    // 添加 BGM
    const addBgm = () => {
        const newBgm: BgmItem = {
            id: `bgm-${Date.now()}`,
            name: '新音轨',
            description: '待补充描述',
        };
        setBgmLibrary(prev => [newBgm, ...prev]);
    };

    return (
        <div className={styles.panelContent}>
            <div className={styles.panelHeader}>
                <div>
                    <p className={styles.eyebrow}>Step 4</p>
                    <h2>场景背景 & BGM 绑定</h2>
                    <p className={styles.subtitle}>AI 生成场景描述，可直接选择上一步上传的 BGM</p>
                </div>
                <button className={styles.ghost}>导出场景脚本</button>
            </div>

            <div className={styles.sceneLayout}>
                {/* 左栏 */}
                <div className={styles.stack}>
                    {/* 场景列表 */}
                    <div className={styles.card}>
                        <div className={styles.boardHead}>
                            <div>
                                <h3>解析出的场景</h3>
                                <span className={styles.chip}>与角色档案类似的编辑体验</span>
                            </div>
                            <button className={styles.ghostSmall} onClick={addScene}>+ 新增场景</button>
                        </div>
                        <div className={styles.sceneList}>
                            {sceneData.map((scene) => (
                                <article
                                    key={scene.id}
                                    className={`${styles.sceneRow} ${scene.id === activeSceneId ? styles.active : ''}`}
                                    onClick={() => setActiveSceneId(scene.id)}
                                >
                                    <div
                                        className={`${styles.sceneThumb} ${!scene.image ? styles.empty : ''}`}
                                        style={scene.image ? { backgroundImage: `url('${scene.image}')` } : {}}
                                    >
                                        {!scene.image && <span>待上传</span>}
                                    </div>
                                    <div className={styles.sceneMeta}>
                                        <strong>{scene.name}</strong>
                                        <p className={styles.mutedSmall}>{scene.desc}</p>
                                    </div>
                                </article>
                            ))}
                        </div>
                    </div>

                    {/* BGM 素材库 */}
                    <div className={styles.card}>
                        <div className={styles.cardHead}>
                            <h3>BGM 素材库</h3>
                            <button className={styles.ghostSmall} onClick={addBgm}>上传 BGM</button>
                        </div>
                        <p className={styles.mutedSmall}>上传音频并补充描述，绑定到具体场景即可实现环境切换。</p>
                        <ul className={styles.bgmList}>
                            {bgmLibrary.map((bgm) => (
                                <li key={bgm.id} className={styles.bgmItem}>
                                    <label>
                                        <span>名称</span>
                                        <input
                                            type="text"
                                            value={bgm.name}
                                            onChange={(e) => updateBgm(bgm.id, 'name', e.target.value)}
                                        />
                                    </label>
                                    <label className={styles.wide}>
                                        <span>描述</span>
                                        <textarea
                                            rows={2}
                                            value={bgm.description}
                                            onChange={(e) => updateBgm(bgm.id, 'description', e.target.value)}
                                        />
                                    </label>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                {/* 右栏 - 场景详情 */}
                <div className={styles.card}>
                    {/* 场景背景大图 */}
                    <div
                        className={`${styles.sceneHero} ${!activeScene.image ? styles.empty : ''}`}
                        style={activeScene.image ? { backgroundImage: `url('${activeScene.image}')` } : {}}
                    >
                        {activeScene.image ? (
                            <span className={styles.heroHint}>点击替换背景</span>
                        ) : (
                            <span>点击上传背景图</span>
                        )}
                    </div>

                    <div className={styles.sceneImageActions}>
                        <button className={styles.ghostSmall}>上传背景</button>
                        <button className={styles.ghostSmall}>AI 重新生成</button>
                    </div>

                    <div className={styles.formGrid}>
                        <label>
                            <span>场景名称</span>
                            <input
                                type="text"
                                value={activeScene.name}
                                onChange={(e) => updateSceneField('name', e.target.value)}
                            />
                        </label>
                        <label className={styles.wide}>
                            <span>场景描述</span>
                            <textarea
                                rows={3}
                                value={activeScene.desc}
                                onChange={(e) => updateSceneField('desc', e.target.value)}
                            />
                        </label>
                        <label>
                            <span>特殊 BGM</span>
                            <select
                                value={activeScene.bgmId}
                                onChange={(e) => updateSceneField('bgmId', e.target.value)}
                            >
                                <option value="">不绑定特殊 BGM</option>
                                {bgmLibrary.map((bgm) => (
                                    <option key={bgm.id} value={bgm.id}>
                                        {bgm.name}{bgm.description ? ` · ${bgm.description}` : ''}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ScenesPanel;
