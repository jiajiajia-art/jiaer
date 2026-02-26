export type ScriptButtonType =
    | 'auto'
    | 'text'
    | 'history'
    | 'share_replay'
    | 'share_replay_create'
    | 'settings_restart'
    | 'history_edit'
    | 'history_regenerate'
    | 'settings_toggle_bgm';

export interface ScriptButtonEventPayload {
    buttonType: ScriptButtonType;
    fileId?: string;
}

