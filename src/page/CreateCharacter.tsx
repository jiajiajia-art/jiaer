import React, { useState, useEffect, useRef } from "react";
import styles from './CreateCharacter.module.css';
import { Link } from "react-router-dom";

const CreateCharacter: React.FC = () => {
    const [showCustomJob, setShowCustomJob] = useState(false);
    const [formSubmitted, setFormSubmitted] = useState(false);
    const customJobRef = useRef<HTMLInputElement>(null);

    // 处理职业选择变化
    useEffect(() => {
        const handleJobChange = (event: Event) => {
            const target = event.target as HTMLInputElement;
            if (target.value === 'custom') {
                setShowCustomJob(true);
                if (customJobRef.current) {
                    customJobRef.current.required = true;
                }
            } else {
                setShowCustomJob(false);
                if (customJobRef.current) {
                    customJobRef.current.required = false;
                }
            }
        };

        // 添加事件监听器
        const jobRadios = document.querySelectorAll('input[name="job"]');
        jobRadios.forEach(radio => {
            radio.addEventListener('change', handleJobChange);
        });

        // 清理事件监听器
        return () => {
            jobRadios.forEach(radio => {
                radio.removeEventListener('change', handleJobChange);
            });
        };
    }, []);

    // 处理表单提交
    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        const form = e.currentTarget;
        const formData = new FormData(form);

        const name = formData.get('name') as string;
        const gender = formData.get('gender') as string;
        const age = parseInt(formData.get('age') as string);
        let job = formData.get('job') as string;
        const description = formData.get('description') as string;

        // 如果选择了自定义职业
        if (job === 'custom') {
            const customJob = customJobRef.current?.value.trim();
            if (!customJob) {
                alert('请输入自定义职业名称');
                return;
            }
            job = customJob;
        }

        // 创建玩家数据对象
        const playerData = {
            profile: {
                avatar: "data/avatars/player.png",
                name: name,
                age: age,
                gender: gender,
                job: job,
                description: description || `一位${age}岁的${gender}性${job}，踏上了冒险之旅。`
            },
            stats: {
                level: 1,
                health: 100,
                maxHealth: 100,
                attack: 10,
                defense: 5,
                speed: 8
            },
            experience: {
                current: 0,
                required: 100
            },
            currency: {
                gold: 100
            },
            inventory: {
                equipment: {
                    head: null,
                    body: null,
                    legs: null,
                    hands: null,
                    feet: null,
                    back: null,
                    leftHand: null,
                    rightHand: null
                },
                items: [
                    {
                        id: "health_potion",
                        name: "生命药水",
                        description: "恢复50点生命值的红色药水",
                        icon: "data/icons/health_potion.png",
                        type: "consumable",
                        usable: true,
                        stackable: true,
                        effects: {
                            health: 50
                        },
                        quantity: 3
                    },
                    {
                        id: "forest_berries",
                        name: "森林浆果",
                        description: "甜美的野生浆果，可以恢复少量体力",
                        icon: "data/icons/berries.png",
                        type: "consumable",
                        usable: true,
                        stackable: true,
                        effects: {
                            health: 10
                        },
                        quantity: 5
                    }
                ]
            }
        };

        // 保存到 localStorage
        localStorage.setItem('playerData', JSON.stringify(playerData));
        localStorage.setItem('characterCreated', 'true');

        // 显示成功消息
        setFormSubmitted(true);
    };

    // 处理表单重置
    const handleReset = () => {
        setShowCustomJob(false);
        setFormSubmitted(false);
        if (customJobRef.current) {
            customJobRef.current.required = false;
        }
    };

    // 预加载默认值
    useEffect(() => {
        const savedData = localStorage.getItem('playerData');
        if (savedData) {
            // 可选：预填充表单
            // const data = JSON.parse(savedData) as PlayerData;
            // 可以在这里设置表单的默认值
        }
    }, []);

    return (
        <div className={styles.bodyContainer}>
            <div className={styles.container}>
                <h1>⚔️ 创建你的角色</h1>
                <p className={styles.subtitle}>开始你的冒险之旅</p>

                <div className={styles.avatarPreview}>
                    <img id="avatarPreview" src="/data/avatars/player.png" alt="角色头像" />
                </div>

                {!formSubmitted ? (
                    <form id="characterForm" onSubmit={handleSubmit} onReset={handleReset}>
                        <div className={styles.formGroup}>
                            <label htmlFor="name">角色姓名 *</label>
                            <input
                                type="text"
                                id="name"
                                name="name"
                                placeholder="请输入角色姓名"
                                required
                            />
                            <div className={styles.hint}>例如：张三、李四、冒险者-小明</div>
                        </div>

                        <div className={styles.formGroup}>
                            <label>性别 *</label>
                            <div className={styles.genderGroup}>
                                <div className={styles.genderOption}>
                                    <input type="radio" id="male" name="gender" value="男" required />
                                    <label htmlFor="male">👨 男</label>
                                </div>
                                <div className={styles.genderOption}>
                                    <input type="radio" id="female" name="gender" value="女" />
                                    <label htmlFor="female">👩 女</label>
                                </div>
                            </div>
                        </div>

                        <div className={styles.formGroup}>
                            <label htmlFor="age">年龄 *</label>
                            <input
                                type="number"
                                id="age"
                                name="age"
                                min="1"
                                max="100"
                                placeholder="请输入年龄"
                                required
                            />
                            <div className={styles.hint}>建议范围：16-50岁</div>
                        </div>

                        <div className={styles.formGroup}>
                            <label>职业 *</label>
                            <div className={styles.jobSelect}>
                                <div className={styles.jobOption}>
                                    <input type="radio" id="job1" name="job" value="冒险者" required />
                                    <label htmlFor="job1">⚔️ 冒险者</label>
                                </div>
                                <div className={styles.jobOption}>
                                    <input type="radio" id="job2" name="job" value="战士" />
                                    <label htmlFor="job2">🛡️ 战士</label>
                                </div>
                                <div className={styles.jobOption}>
                                    <input type="radio" id="job3" name="job" value="法师" />
                                    <label htmlFor="job3">🔮 法师</label>
                                </div>
                                <div className={styles.jobOption}>
                                    <input type="radio" id="job4" name="job" value="盗贼" />
                                    <label htmlFor="job4">🗡️ 盗贼</label>
                                </div>
                                <div className={styles.jobOption}>
                                    <input type="radio" id="job5" name="job" value="游侠" />
                                    <label htmlFor="job5">🏹 游侠</label>
                                </div>
                                <div className={styles.jobOption}>
                                    <input type="radio" id="jobCustom" name="job" value="custom" />
                                    <label htmlFor="jobCustom">✏️ 自定义</label>
                                </div>
                            </div>
                            <div className={`${styles.customJob} ${showCustomJob ? styles.show : ''}`} id="customJobInput">
                                <input
                                    ref={customJobRef}
                                    type="text"
                                    id="customJob"
                                    placeholder="请输入自定义职业"
                                />
                            </div>
                        </div>

                        <div className={styles.formGroup}>
                            <label htmlFor="description">角色介绍</label>
                            <textarea
                                id="description"
                                name="description"
                                placeholder="介绍一下你的角色背景故事...（可选）"
                            ></textarea>
                            <div className={styles.hint}>简单描述你的角色性格、背景或目标</div>
                        </div>

                        <div className={styles.buttonGroup}>
                            <button type="reset" className={styles.btnReset}>重置</button>
                            <button type="submit" className={styles.btnSubmit}>创建角色</button>
                        </div>
                    </form>
                ) : (
                    <div className={`${styles.successMessage} ${styles.show}`} id="successMessage">
                        ✅ 角色创建成功！
                        <br />
                        <Link to="/main" className={styles.startGameLink}>立即开始游戏 →</Link>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CreateCharacter;