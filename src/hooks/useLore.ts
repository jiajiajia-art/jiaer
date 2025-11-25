import { useState } from 'react';

export const useLore = () => {
    const [gameTimeText, setGameTimeText] = useState('');
    const [worldLoreHtml, setWorldLoreHtml] = useState<string>('');
    const [playerLoreHtml, setPlayerLoreHtml] = useState<string>('');
    const [loreLoaded, setLoreLoaded] = useState(false);

    // 从后端数据更新世界观
    const updateLoreFromBackend = (lore: any) => {
        if (lore.gameTime) {
            const { currentYear, yearName, currentMonth, currentDay, monthNames, season } = lore.gameTime;
            const monthName = (monthNames && monthNames[currentMonth - 1]) || '未知月';
            setGameTimeText(`${yearName} ${currentYear}年 ${monthName} ${currentDay}日 (${season})`);
        }
        if (lore.worldBackground?.content) {
            setWorldLoreHtml(lore.worldBackground.content.map((p: string) => `<p>${p}</p>`).join(''));
        }
        if (lore.playerStory?.content) {
            setPlayerLoreHtml(lore.playerStory.content.map((p: string) => `<p>${p}</p>`).join(''));
        }
        setLoreLoaded(true);
    };

    return {
        gameTimeText,
        setGameTimeText,
        worldLoreHtml,
        setWorldLoreHtml,
        playerLoreHtml,
        setPlayerLoreHtml,
        loreLoaded,
        setLoreLoaded,
        updateLoreFromBackend,
    };
};
