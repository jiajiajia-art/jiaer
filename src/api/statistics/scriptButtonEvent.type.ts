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
    | 'music_toggle_mute'
    | 'export_visual_novel'
    | 'export_visual_novel_create'
    | 'export_visual_novel_overwrite'
    | 'history_back';

export interface ScriptButtonEventPayload {
    buttonType: ScriptButtonType;
    fileId?: string;
}

