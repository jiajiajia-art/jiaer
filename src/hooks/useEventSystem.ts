import { useState, useEffect } from 'react';
import { useGameData } from './useGameData';

interface EventOption {
    text: string;
    effects?: any;
    nextEvent?: string | null;
}

interface EventDef {
    id: string;
    title: string;
    image: string;
    description: string;
    options: EventOption[];
    conditions?: any;
}

export const useEventSystem = () => {
    const [events, setEvents] = useState<Record<string, EventDef>>({});
    const [activeEvent, setActiveEvent] = useState<EventDef | null>(null);
    const [eventHistory, setEventHistory] = useState<Array<{ id: string; title?: string; timestamp: number }>>([]);
    const [initialEventShown, setInitialEventShown] = useState(false);
    
    // 获取后端数据
    const { backendEvents, backendDataLoaded } = useGameData();

    // 载入事件表
    const ensureLoadEvents = async () => {
        if (Object.keys(events).length > 0) return;
        
        // 优先使用后端转换的事件数据
        if (backendDataLoaded && Object.keys(backendEvents).length > 0) {
            console.log('✅ 使用后端转换的事件数据:', backendEvents);
            setEvents(backendEvents as Record<string, EventDef>);
            return;
        }
        
        try {
            const res = await fetch('/data/events.json');
            if (res.ok) {
                const ev = (await res.json()) as Record<string, EventDef>;
                setEvents(ev);
            } else {
                // 默认 welcome 事件
                const fallback: Record<string, EventDef> = {
                    welcome_event: {
                        id: 'welcome_event',
                        title: '明末人生模拟器',
                        image: '/data/events/welcome.jpg',
                        description: '天启七年正月十五（1627年2月），你叫陈石，是北直隶顺天府郊外一个佃农之子。时值寒冬，村中炊烟稀落，土地贫瘠，官道上有流民缓缓南迁。朝廷阉党专权，边关烽火不断，山海关外后金铁骑虎视眈眈。\n\n作为家中长子，你深知生活不易。父亲偶尔讲述的军旅故事，在你心中埋下了对外面世界既恐惧又好奇的种子。\n\n在这个动荡的时代，你将如何选择自己的人生道路？',
                        options: [
                            { text: '我要改变命运！', effects: { experience: 10 }, nextEvent: null },
                            { text: '先了解当前局势', effects: { experience: 5 }, nextEvent: null },
                            { text: '我需要更多准备', effects: {}, nextEvent: null },
                        ],
                    },
                };
                setEvents(fallback);
            }
        } catch {
            const fallback: Record<string, EventDef> = {
                welcome_event: {
                    id: 'welcome_event',
                    title: '明末人生模拟器',
                    image: '/data/events/welcome.jpg',
                    description: '天启七年正月十五（1627年2月），你叫陈石，是北直隶顺天府郊外一个佃农之子。时值寒冬，村中炊烟稀落，土地贫瘠，官道上有流民缓缓南迁。朝廷阉党专权，边关烽火不断，山海关外后金铁骑虎视眈眈。\n\n作为家中长子，你深知生活不易。父亲偶尔讲述的军旅故事，在你心中埋下了对外面世界既恐惧又好奇的种子。\n\n在这个动荡的时代，你将如何选择自己的人生道路？',
                    options: [
                        { text: '我要改变命运！', effects: { experience: 10 }, nextEvent: null },
                        { text: '先了解当前局势', effects: { experience: 5 }, nextEvent: null },
                        { text: '我需要更多准备', effects: {}, nextEvent: null },
                    ],
                },
            };
            setEvents(fallback);
        }
    };

    // 触发事件
    const triggerEventById = async (eventId: string) => {
        await ensureLoadEvents();
        const ev = events[eventId];
        if (ev) {
            setActiveEvent(ev);
            setEventHistory((h) => [...h, { id: ev.id, title: ev.title, timestamp: Date.now() }]);
        } else if (eventId === 'welcome_event') {
            // 如果异步刚加载还未 set 到 state，延迟一点再取
            setTimeout(() => {
                const ev2 = events['welcome_event'];
                if (ev2) {
                    setActiveEvent(ev2);
                    setEventHistory((h) => [...h, { id: ev2.id, title: ev2.title, timestamp: Date.now() }]);
                }
            }, 100);
        }
    };

    // 关闭事件
    const closeEvent = () => {
        setActiveEvent(null);
    };

    // 监听后端事件数据变化
    useEffect(() => {
        if (backendDataLoaded && Object.keys(backendEvents).length > 0) {
            console.log('🔄 后端事件数据已加载，更新事件表');
            setEvents(backendEvents as Record<string, EventDef>);
        }
    }, [backendDataLoaded, backendEvents]);

    // 进入页面自动弹出初始故事事件
    useEffect(() => {
        if (initialEventShown) return;
        (async () => {
            await ensureLoadEvents();
            if (Object.keys(events).length > 0 && !initialEventShown) {
                const ev = events['welcome_event'];
                if (ev) {
                    setActiveEvent(ev);
                    setEventHistory((h) => [...h, { id: ev.id, title: ev.title, timestamp: Date.now() }]);
                    setInitialEventShown(true);
                }
            }
        })();
    }, [events, initialEventShown]);

    return {
        events,
        activeEvent,
        setActiveEvent,
        eventHistory,
        setEventHistory,
        triggerEventById,
        closeEvent,
        ensureLoadEvents
    };
};
