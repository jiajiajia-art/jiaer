import { useState, useEffect } from 'react';

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

    // 载入事件表
    const ensureLoadEvents = async () => {
        if (Object.keys(events).length > 0) return;
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
                        title: '欢迎来到冒险世界',
                        image: '/data/events/welcome.jpg',
                        description: '你来到了一个神秘的世界，前方有无数冒险等待着你。作为一位新生的冒险者，你准备好踏上这段旅程了吗？',
                        options: [
                            { text: '开始冒险！', effects: { experience: 10 }, nextEvent: null },
                            { text: '先了解一下这个世界', effects: { experience: 5 }, nextEvent: null },
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
                    title: '欢迎来到冒险世界',
                    image: '/data/events/welcome.jpg',
                    description: '你来到了一个神秘的世界，前方有无数冒险等待着你。作为一位新生的冒险者，你准备好踏上这段旅程了吗？',
                    options: [
                        { text: '开始冒险！', effects: { experience: 10 }, nextEvent: null },
                        { text: '先了解一下这个世界', effects: { experience: 5 }, nextEvent: null },
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
