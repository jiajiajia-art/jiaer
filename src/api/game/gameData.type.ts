// 游戏核心数据类型
export interface GameSession {
    success: boolean;
    identifier: string;
    type: "session";
    files: GameFiles;
    timestamp: string;
  }
  
  // 游戏文件数据类型
  export interface GameFiles {
    lore: GameLore;
    player: PlayerData;
    items: Record<string, GameItem>;
    scenes: ScenesMap;
  }
  
  // 世界观背景数据类型
  export interface GameLore {
    worldBackground: WorldBackground;
    playerStory: PlayerStory;
    keyEvents: KeyEvent[];
    gameTime: GameTime;
  }
  
  export interface WorldBackground {
    title: string;
    content: string[];
  }
  
  export interface PlayerStory {
    title: string;
    content: string[];
  }
  
  export interface KeyEvent {
    title: string;
    year: string;
    description: string;
  }
  
  export interface GameTime {
    yearName: string;
    currentYear: number;
    currentMonth: number;
    currentDay: number;
    monthNames: string[];
    season: string;
  }
  
  // 玩家数据类型
  export interface PlayerData {
    profile: PlayerProfile;
    stats: PlayerStats;
    experience: Experience;
    currency: Currency;
    inventory: Inventory;
    location: string;
    unlockedScenes: string[];
    flags: Record<string, any>;
    relationships: Record<string, any>;
    achievements: any[];
  }
  
  export interface PlayerProfile {
    avatar: string;
    name: string;
    age: number;
    gender: "男" | "女";
    job: string;
  }
  
  export interface PlayerStats {
    level: number;
    health: number;
    maxHealth: number;
    attack: number;
    defense: number;
    speed: number;
  }
  
  export interface Experience {
    current: number;
    required: number;
  }
  
  export interface Currency {
    gold: number;
  }
  
  export interface Inventory {
    equipment: Equipment;
    items: InventoryItem[];
  }
  
  export interface Equipment {
    head: string | null;
    body: string | null;
    legs: string | null;
    hands: string | null;
    feet: string | null;
    back: string | null;
    leftHand: string | null;
    rightHand: string | null;
  }
  
  export interface InventoryItem {
    id: string;
    name: string;
    description: string;
    icon: string;
    type: string;
    usable: boolean;
    stackable: boolean;
    effects: Record<string, any>;
    quantity: number;
  }
  
  // 游戏物品数据类型
  export interface GameItem {
    id: string;
    name: string;
    description: string;
    icon: string;
    type: string;
    equippable?: boolean;
    stackable: boolean;
    usable?: boolean;
    slots?: string[];
    stats?: ItemStats;
    effects?: Record<string, any>;
  }
  
  
  export interface ItemStats {
    defense?: number;
    attack?: number;
    health?: number;
    learning?: number;
    bravery?: number;
    survival?: number;
    appearance?: number;
    luck?: number;
    disease_resist?: boolean;
    luck_buff?: boolean;
    skill_weaving?: number;
  }
  
  // 场景地图数据类型
  export interface ScenesMap {
    [key: string]: Scene;
  }
  
  export interface Scene {
    id: string;
    name: string;
    description: string;
    background: string;
    buildings: Building[];
    npcs: NPC[];
    events: string[];
    exits: SceneExits;
  }
  
  export interface Building {
    id: string;
    name: string;
    description: string;
    icon: string;
    type: string;
    eventId: string;
    features: string[];
  }
  
  
  export interface NPC {
    id: string;
    name: string;
    age: number;
    gender: "男" | "女";
    job: string;
    description: string;
    icon: string;
    type: string;
    eventId: string;
    relationships: number;
    memory: any[];
    greetings: string[];
  }
  
  
  export interface SceneExits {
    [direction: string]: string;
  }
  
  // API响应数据类型
  export interface GameFilesResponse {
    files: GameFiles;
  }
  
  export interface ScenesResponse {
    data: ScenesMap;
    scenes: ScenesMap;
  }
  
  export type ImageResponse = string | { url: string } | { imageUrl: string } | { image: string };
  
  
  // 事件相关类型
  export interface GameEvent {
    id: string;
    type: string;
    title: string;
    description: string;
    conditions?: EventCondition[];
    outcomes?: EventOutcome[];
  }
  
  export interface EventCondition {
    type: string;
    value: any;
  }
  
  export interface EventOutcome {
    type: string;
    value: any;
    target?: string;
  }
