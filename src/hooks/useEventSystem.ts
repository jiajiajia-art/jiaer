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
    
    // 获取后端数据
    const { backendEvents, backendDataLoaded } = useGameData();

    // 载入事件表（仅使用后端数据）
    const ensureLoadEvents = async () => {
        if (Object.keys(events).length > 0) return;
        
        // 只使用后端转换的事件数据
        if (backendDataLoaded && Object.keys(backendEvents).length > 0) {
            console.log('✅ 使用后端转换的事件数据:', backendEvents);
            setEvents(backendEvents as Record<string, EventDef>);
        }
    };

    // 触发事件
    const triggerEventById = async (eventId: string) => {
        await ensureLoadEvents();
        const ev = events[eventId];
        if (ev) {
            setActiveEvent(ev);
            setEventHistory((h) => [...h, { id: ev.id, title: ev.title, timestamp: Date.now() }]);
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
