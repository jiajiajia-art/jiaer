import type { GameLore, PlayerData } from "./gameData.type";

interface SkipEraRequest {
    sessionId: string;
}

interface SkipEraResponse {
    success: boolean;
    message: string;
    previousEra: {
        index: string;
        title: string;
        year: string;
    };
    currentEra: {
        index: string;
        title: string;
        year: string;
        description: string;
    };
    timeChange: {
        yearsPassed: number;
        previousDate: string;
        newDate: string;
    };
    narrative: string;
    playerChanges: playerChanges;
    updatedFiles: {
        lore: GameLore;
        player: PlayerData;
    };
    timestamp: string;
}

interface playerChanges{
    ageIncrease: number;
    newAge: number;
    statsGrowth:{
        level: number;
        health: number;
        maxHealth: number;
        attack: number;
        defense: number;
        speed: number;
    };
    goldGained: number;
}
export type { SkipEraRequest, SkipEraResponse };