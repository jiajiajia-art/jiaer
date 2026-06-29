export type ScriptButtonType =
    | 'auto'
    | 'text'
    | 'history'
    | 'share_replay'
    | 'share_replay_create'
    | 'settings_restart'
    | 'history_edit'
    | 'history_regenerate'
    | 'settings_toggle_bgm'
    | 'music_toggle_mute';

export interface ScriptButtonEventPayload {
    buttonType: ScriptButtonType;
    fileId?: string;
}

