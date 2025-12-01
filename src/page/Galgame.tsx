import { useState } from "react";
import { CiLocationOn } from "react-icons/ci";
import styles from './Galgame.module.css';
import { useAuthStore } from "../store/useAuthStore";
import { PiMusicNoteDuotone } from "react-icons/pi";
import { BiHistory } from "react-icons/bi";
import { LuFileText } from "react-icons/lu";
import { MdOutlineAutoStories } from "react-icons/md";
import { IoArrowDownCircleOutline } from "react-icons/io5";

type MessageType = 'character' | 'narration' | 'choice';

interface Message {
    id: number;
    type: MessageType;
    message: string;
    characterName?: string;
    characterImage?: string;
    characterPosition?: 'left' | 'right';
    options?: Array<{ id: number; text: string }>;
}

const messages: Message[] = [
    {
        id: 1,
        type: 'narration',
        message: "您已进入Galgame，请选择一个选项",
    },
    {
        id: 2,
        type: 'character',
        message: "你好，欢迎来到这个世界！",
        characterName: "角色A",
        characterImage: '/data/assets/角色立绘.png',
        characterPosition: 'right',
    },
    {
        id: 3,
        type: 'character',
        message: "我是另一个角色，很高兴认识你！",
        characterName: "角色B",
        characterImage: '/data/assets/角色立绘.png',
        characterPosition: 'left',
    },
    {
        id: 4,
        type: 'choice',
        message: "请选择你的行动",
        options: [
            { id: 1, text: "要紧牙关挺直腰板，目不斜视的听训，暗中观察周围环境和人物" },
            { id: 2, text: "选项2" },
            { id: 3, text: "选项3" },
        ],
        characterImage: '/data/assets/角色立绘.png',
    },
    {
        id: 5,
        type: 'narration',
        message: "旁白：故事继续发展...",
    },
];

const Galgame = () => {
    const { user } = useAuthStore();
    const [backgroundImage, setBackgroundImage] = useState<string>('https://img1.baidu.com/it/u=728753041,714041801&fm=253&app=138&f=JPEG?w=889&h=500');
    const [currentMessageIndex, setCurrentMessageIndex] = useState<number>(0);
    const [showCustomInput, setShowCustomInput] = useState<boolean>(false);
    const [customInputValue, setCustomInputValue] = useState<string>('');
    const currentMessage = messages[currentMessageIndex];

    // 后续根据后端返回的数据使用 setBackgroundImage 动态更新
    void setBackgroundImage;

    const handleNextMessage = () => {
        if (currentMessageIndex < messages.length - 1) {
            setCurrentMessageIndex(currentMessageIndex + 1);
            setShowCustomInput(false);
            setCustomInputValue('');
        }
    };

    const handleChoiceClick = (_optionId: number) => {
        // 选择选项后进入下一条消息
        // optionId 可用于后续记录用户选择
        handleNextMessage();
    };

    const handleCustomInputClick = () => {
        setShowCustomInput(true);
    };

    const handleCustomInputSubmit = () => {
        if (customInputValue.trim()) {
            // 处理自定义输入提交
            console.log('自定义输入:', customInputValue);
            handleNextMessage();
        }
    };

    const handleCustomInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleCustomInputSubmit();
        }
    };

    return (
        <div className={styles.pageRoot}>
            <div
                className={styles.mainContent}
                style={{
                    backgroundImage: backgroundImage ? `url(${backgroundImage})` : 'none',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat'
                }}
            >
                <div className={styles.topHeader}>
                    <CiLocationOn />
                    <span>Galgame</span>
                </div>
                {currentMessage.characterImage && (
                    <div
                        className={`${styles.characterContainer} ${currentMessage.characterPosition === 'left'
                                ? styles.characterSlideLeft
                                : styles.characterSlideRight
                            }`}
                    >
                        <img
                            src={`${import.meta.env.BASE_URL}${currentMessage.characterImage}`}
                            alt="角色立绘"
                            className={styles.characterImage}
                        />
                    </div>
                )}
                <div className={styles.gameContentWrapper}>
                    <div className={styles.messageContainer}>
                        {currentMessage.type === 'narration' && (
                            <div className={styles.narrationContainer}>
                                <div className={styles.narrationMessage}>
                                    <span>{currentMessage.message}</span>
                                </div>
                                <div className={styles.nextButtonContainer}>
                                    <button
                                        className={styles.nextButton}
                                        onClick={handleNextMessage}
                                    >
                                        <IoArrowDownCircleOutline />
                                    </button>
                                </div>
                            </div>
                        )}
                        {currentMessage.type === 'character' && (
                            <>
                                <div className={styles.characterMessage}>
                                    <div className={styles.characterName}>{currentMessage.characterName}</div>
                                    <div className={styles.characterDivider}></div>
                                    <div className={styles.characterText}>{currentMessage.message}</div>
                                </div>
                                <div className={styles.nextButtonContainer}>
                                    <button
                                        className={styles.nextButton}
                                        onClick={handleNextMessage}
                                    >
                                        <IoArrowDownCircleOutline />
                                    </button>
                                </div>
                            </>
                        )}
                        {currentMessage.type === 'choice' && currentMessage.options && (
                            <div className={styles.choiceContainer}>
                                {currentMessage.options.map((option) => (
                                    <div
                                        key={option.id}
                                        className={styles.choiceOption}
                                        onClick={() => handleChoiceClick(option.id)}
                                    >
                                        <span className={styles.choiceText}>{option.text}</span>
                                        <div className={styles.choicePrice}>
                                            <img src={`${import.meta.env.BASE_URL}data/assets/金币.png`} alt="金币" />
                                            <span>2</span>
                                        </div>
                                    </div>
                                ))}
                                {!showCustomInput ? (
                                    <div
                                        className={styles.customInputText}
                                        onClick={handleCustomInputClick}
                                    >
                                        <span>自定义输入</span>
                                    </div>
                                ) : (
                                    <div className={styles.customInput}>
                                        <input
                                            type="text"
                                            placeholder="请输入..."
                                            value={customInputValue}
                                            onChange={(e) => setCustomInputValue(e.target.value)}
                                            onKeyDown={handleCustomInputKeyDown}
                                            autoFocus
                                        />
                                        <button onClick={handleCustomInputSubmit}>
                                            <span>发送</span>
                                            <div className={styles.choicePrice}>
                                                <img src={`${import.meta.env.BASE_URL}data/assets/金币.png`} alt="金币" />
                                                <span>2</span>
                                            </div>
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    <div className={styles.buttonContainer}>
                        <div className={styles.buttonItem}>
                            <div className={styles.buttonInner}>
                                <img src={`${import.meta.env.BASE_URL}data/assets/金币.png`} alt="积分" />
                                <span>{user?.user?.points}</span>
                            </div>
                        </div>
                        <div className={styles.buttonItem}>
                            <div className={styles.buttonInner}>
                                <BiHistory />
                                <span>历史</span>
                            </div>
                        </div>
                        <div className={styles.buttonItem}>
                            <div className={styles.buttonInner}>
                                <LuFileText />
                                <span>文本</span>
                            </div>
                        </div>
                        <div className={styles.buttonItem}>
                            <div className={styles.buttonInner}>
                                <MdOutlineAutoStories />
                                <span>自动</span>
                            </div>
                        </div>
                        <div className={styles.buttonItem}>
                            <div className={styles.buttonInner}>
                                <PiMusicNoteDuotone />
                                <span>音乐</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Galgame;