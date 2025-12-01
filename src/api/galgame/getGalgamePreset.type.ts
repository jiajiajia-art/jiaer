export interface GetGalgamePresetResponse {
    success: boolean
    presetId: string
    worldSetting: WorldSetting
    npcSetting: NpcSetting
    sceneSetting: SceneSetting
    [key: string]: unknown
  }
  
  export interface WorldSetting {
    title: string
    summary: string
    background: string
    Theme: string[]
    preamble: string
    initialPlot: string
    literary: string
    keyEvents: KeyEvent[]
    WorldRules?: WorldRules
    player: PlayerCharacter
    [key: string]: unknown
  }
  
  export interface KeyEvent {
    title: string
    description: string
  }
  
  export interface WorldRules {
    magic?: string
    races?: string
    language?: string
    geography?: string
    danger?: string
    [key: string]: string | undefined
  }
  
  export interface PlayerCharacter {
    name: string
    age: number
    gender: string
    race?: string
    personality?: string
    appearance?: string
    tone?: string
    images: string
    [key: string]: string | number | undefined
  }
  
  export interface NpcSetting {
    npcs: NPC[]
    [key: string]: unknown
  }
  
  export interface NPC {
    id: string
    name: string
    age: number
    gender: string
    job?: string
    race?: string
    description?: string
    appearance?: string
    personality?: string
    tone?: string
    relationship?: string
    abilities?: string[]
    dialogue?: string[]
    images?: NPCImages
    [key: string]: unknown
  }
  
  export interface NPCImages {
    base?: string
    happy?: string
    angry?: string
    serious?: string
    battle?: string
    alert?: string
    aiming?: string
    determined?: string
    worried?: string
    obsessed?: string
    pitiful?: string
    evil?: string
    [key: string]: string | undefined
  }
  
  export interface SceneSetting {
    scenes: Scene[]
    [key: string]: unknown
  }
  
  export interface Scene {
    id: string
    name: string
    type: string
    description: string
    atmosphere?: string
    dangerLevel?: number
    images?: string
    npcs: string[]
    enemies?: string[]
    items?: string[]
    events: string[]
    exits?: SceneExits
    soundtrack?: string
    [key: string]: unknown
  }
  
  export interface SceneExits {
    [direction: string]: string
  }
  
  export type NPCById = Record<string, NPC>
  
  export interface SceneWithFullNPCs extends Omit<Scene, 'npcs'> {
    fullNPCs: NPC[]
  }