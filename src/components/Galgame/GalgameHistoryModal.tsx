import React from 'react';
import { Converter } from 'showdown';
import type { HistoryWithId } from '../../hooks/galgame/useGalgameHistory';
import { parseColorMarkup } from '../../utils/textUtils';
import styles from './GalgameHistoryModal.module.css';

interface GalgameHistoryModalProps {
    isOpen: boolean;
    history: HistoryWithId[];
    backgroundImage: string;
    onClose: () => void;
}

// 处理助手消息内容，将标签转换为可读文本，但保持整体结构
const processAssistantContent = (content: string): string => {
    if (!content) return '';
    
    let result = content;
    
    // 处理 NARRATION 标签 - 保留内容
    result = result.replace(/\[NARRATION:\s*([^\]]*(?:\[[^\]]*\][^\]]*)*)\]/gi, (_match, text) => {
        return text ? text.trim() : '';
    });
    
    // 处理 DIALOGUE 标签 - 转换为 "说话人："内容""
    result = result.replace(/\[DIALOGUE:\s*([^,]*),\s*"([\s\S]*)"\]/gi, (_match, speaker, text) => {
        if (speaker && text) {
            return `${speaker.trim()}："${text.trim()}"`;
        }
        return text ? text.trim() : '';
    });
    
    // 处理 TRANSITION 标签 - 保留内容
    result = result.replace(/\[TRANSITION:\s*([^\]]*(?:\[[^\]]*\][^\]]*)*)\]/gi, (_match, text) => {
        return text ? text.trim() : '';
    });
    
    // 处理 CHOICE 块
    result = result.replace(/\[CHOICE:([^\]]*)\]([\s\S]*?)\[END_CHOICE\]/gi, (_match, title, content) => {
        let choiceText = '';
        if (title) {
            choiceText += `【${title.trim()}】\n`;
        }
        // 移除内容中的 OPTION 标签（选项会在后面单独显示）
        let cleanedContent = content.replace(/\[OPTION:\s*([^\]]*(?:\[[^\]]*\][^\]]*)*)\]/gi, '');
        // 处理内容中的其他标签
        cleanedContent = cleanedContent.replace(/\[DIALOGUE:\s*([^,]*),\s*"([\s\S]*)"\]/gi, (_m: string, speaker: string, text: string) => {
            if (speaker && text) {
                return `${speaker.trim()}："${text.trim()}"`;
            }
            return text ? text.trim() : '';
        });
        cleanedContent = cleanedContent.replace(/\[NARRATION:\s*([^\]]*(?:\[[^\]]*\][^\]]*)*)\]/gi, (_m: string, text: string) => {
            return text ? text.trim() : '';
        });
        choiceText += cleanedContent.trim();
        return choiceText;
    });
    
    // 处理单独的 CHOICE 标签
    result = result.replace(/\[CHOICE:\s*([^\]]*(?:\[[^\]]*\][^\]]*)*)\]/gi, (_match, title) => {
        return title ? `【${title.trim()}】\n` : '';
    });
    
    // 处理 OPTION 标签（转换为选项列表格式）
    const options: string[] = [];
    result = result.replace(/\[OPTION:\s*([^\]]*(?:\[[^\]]*\][^\]]*)*)\]/gi, (_match, text) => {
        if (text) {
            options.push(text.trim());
        }
        return '';
    });
    
    result = result.replace(/\[SCENE_CHANGE:\s*([^\]]*(?:\[[^\]]*\][^\]]*)*)\]/gi, (_match, text) => {
        return text ? `场景切换：${text.trim()}` : '';
    });
    
    // 清理多余的换行和空格
    result = result.replace(/\n{3,}/g, '\n\n').replace(/[ \t]+/g, ' ').trim();
    
    // 如果有选项，添加到末尾
    if (options.length > 0) {
        result += '\n\n选项：\n';
        options.forEach((opt, index) => {
            result += `${index + 1}. ${opt}\n`;
        });
    }
    
    return result;
};

// 渲染带颜色的文本
const renderColoredText = (text: string): React.ReactNode => {
    if (!text) return null;
    
    const colorClassMap: Record<string, string> = {
        red: styles.colorRed,
        yellow: styles.colorYellow,
        green: styles.colorGreen,
        blue: styles.colorBlue,
        purple: styles.colorPurple,
    };
    
    // 先移除动画标签
    let cleanedText = text;
    cleanedText = cleanedText.replace(/<(jump|vibration|injury)>[\s\S]*?<\/\1>/gi, '');
    
    // 解析颜色标签
    const parts = parseColorMarkup(cleanedText);
    
    // 构建 HTML
    const htmlParts = parts.map(part => {
        if (part.type === 'color' && part.color) {
            return `<span class="${colorClassMap[part.color]}">${part.content}</span>`;
        }
        return part.content;
    }).join('');
    
    // 使用 showdown 处理 markdown
    const converter = new Converter();
    converter.setOption('simpleLineBreaks', true);
    converter.setOption('strikethrough', true);
    converter.setOption('tables', true);
    converter.setOption('tasklists', true);
    
    const html = converter.makeHtml(htmlParts);
    
    return <div dangerouslySetInnerHTML={{ __html: html }} />;
};

const GalgameHistoryModal = ({ isOpen, history, backgroundImage, onClose }: GalgameHistoryModalProps) => {
    if (!isOpen) return null;

    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.modalContent}
             onClick={(e) => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                    <h2 className={styles.modalTitle}>历史记录</h2>
                    <button className={styles.closeButton} onClick={onClose}>×</button>
                </div>
                <div className={styles.modalBody}>
                    {history.length === 0 ? (
                        <div className={styles.emptyState}>暂无历史记录</div>
                    ) : (
                        <div className={styles.chatMessages}>
                            {history.map((item) => {
                                const isUser = item.role === 'user';
                                
                                // 用户消息 - 右侧气泡
                                if (isUser) {
                                    return (
                                        <div key={item.id} className={styles.messageWrapper}>
                                            <div className={styles.userBubble}>
                                                {item.content}
                                            </div>
                                        </div>
                                    );
                                }
                                
                                // 助手消息 - 左侧气泡，处理内容但保持整体
                                const processedContent = processAssistantContent(item.content || '');
                                
                                return (
                                    <div key={item.id} className={styles.messageWrapper}>
                                        <div className={styles.assistantBubble}>
                                            {renderColoredText(processedContent)}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default GalgameHistoryModal;
