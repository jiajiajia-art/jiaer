import styles from './ChatPanel.module.css';
interface Modal {
    isOpen: boolean;
    onClose: () => void;
}

const ChatPanel: React.FC<Modal> = () => {
    return <div>
        <div id="chatPanel" className={styles.chatPanel}>
            <div className={styles.chatHeader}>
                <h3 id="chatTitle">聊天</h3>
                <button id="closeChatBtn" className={styles.closeChatBtn}>×</button>
            </div>
            <div id="chatMessages" className={styles.chatMessages}>
                <div className={`${styles.chatMessage} ${styles.system}`}>欢迎来到游戏世界！</div>
            </div>
            <div className={styles.chatInputArea}>
                <input type="text" id="chatInput" className={styles.chatInput} placeholder="输入消息..." />
                <button id="sendChatBtn" className={styles.sendChatBtn}>发送</button>
            </div>
        </div>
    </div>
}

export default ChatPanel;
