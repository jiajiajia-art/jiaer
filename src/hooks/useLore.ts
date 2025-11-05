import { useState } from 'react';

export const useLore = () => {
    const [gameTimeText, setGameTimeText] = useState('加载中...');
    const [worldLoreHtml, setWorldLoreHtml] = useState<string>('');
    const [playerLoreHtml, setPlayerLoreHtml] = useState<string>('');
    const [loreLoaded, setLoreLoaded] = useState(false);

    // 打开世界观时首次加载
    const ensureLoadLore = async () => {
        if (loreLoaded) return;
        try {
            const res = await fetch('data/lore.json');
            if (res.ok) {
                const data = await res.json();
                if (data?.worldBackground?.content) {
                    setWorldLoreHtml(data.worldBackground.content.map((p: string) => `<p>${p}</p>`).join(''));
                }
                if (data?.playerStory?.content) {
                    setPlayerLoreHtml(data.playerStory.content.map((p: string) => `<p>${p}</p>`).join(''));
                }
            } else {
                setWorldLoreHtml('<p>这是一个充满魔法与冒险的世界...</p>');
                setPlayerLoreHtml('<p>你是一位初出茅庐的冒险者...</p>');
            }
        } catch {
            setWorldLoreHtml('<p>这是一个充满魔法与冒险的世界...</p>');
            setPlayerLoreHtml('<p>你是一位初出茅庐的冒险者...</p>');
        } finally {
            setLoreLoaded(true);
        }
    };

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

    // 从本地数据更新世界观
    const updateLoreFromLocal = async () => {
        try {
            const res = await fetch('data/lore.json');
            if (res.ok) {
                const loreData = await res.json();
                if (loreData?.gameTime) {
                    const { currentYear, yearName, currentMonth, currentDay, monthNames, season } = loreData.gameTime;
                    const monthName = monthNames?.[currentMonth - 1] || '未知月';
                    setGameTimeText(`${yearName} ${currentYear}年 ${monthName} ${currentDay}日 (${season})`);
                } else {
                    setGameTimeText('纪元元年 一月 1日');
                }
            } else {
                setGameTimeText('纪元元年 一月 1日');
            }
        } catch {
            setGameTimeText('纪元元年 一月 1日');
        }
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
        ensureLoadLore,
        updateLoreFromBackend,
        updateLoreFromLocal
    };
};
