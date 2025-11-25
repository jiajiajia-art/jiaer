import { useState, useCallback } from 'react';

export const useMobilePanels = () => {
    const [showHistory, setShowHistory] = useState(false);
    const [missionModalOpen, setMissionModalOpen] = useState(false);
    const [inventoryOpen, setInventoryOpen] = useState(false);
    const [playerOpen, setPlayerOpen] = useState(false);

    const toggleHistory = useCallback(() => {
        setShowHistory(prev => !prev);
    }, []);

    const toggleMission = useCallback(() => {
        setMissionModalOpen(prev => !prev);
    }, []);

    const toggleInventory = useCallback(() => {
        setInventoryOpen(prev => !prev);
    }, []);

    const togglePlayer = useCallback(() => {
        setPlayerOpen(prev => !prev);
    }, []);

    const closeHistory = useCallback(() => {
        setShowHistory(false);
    }, []);

    const closeMission = useCallback(() => {
        setMissionModalOpen(false);
    }, []);

    const closeInventory = useCallback(() => {
        setInventoryOpen(false);
    }, []);

    const closePlayer = useCallback(() => {
        setPlayerOpen(false);
    }, []);

    return {
        showHistory,
        missionModalOpen,
        inventoryOpen,
        playerOpen,
        toggleHistory,
        toggleMission,
        toggleInventory,
        togglePlayer,
        closeHistory,
        closeMission,
        closeInventory,
        closePlayer
    };
};

