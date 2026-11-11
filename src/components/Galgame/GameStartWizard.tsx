/**
 * 开局向导骨架（已不再挂到新开局：产品要求直接进游戏、无弹窗）。
 * 故事线改在系统面板「目前选择路线」调整；本文件保留供后续完整 UE 向导复用。
 */
import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  isStartAdventureEnabled,
  resolveOpeningRouteSelection,
  validateGameStartConfig,
  type GameStartConfig,
  type OpeningRouteOption,
} from '../../lib/galgame/gameStartConfig';
import styles from './GameStartWizard.module.css';
import PanelSelect from './panels/PanelSelect';

interface GameStartWizardProps {
  isOpen: boolean;
  title: string;
  routes: OpeningRouteOption[];
  defaultPlayerName?: string;
  isLoading?: boolean;
  onConfirm: (config: GameStartConfig) => void;
  onCancel?: () => void;
}

const GameStartWizard: React.FC<GameStartWizardProps> = ({
  isOpen,
  title,
  routes,
  defaultPlayerName = '',
  isLoading = false,
  onConfirm,
}) => {
  const [playerName, setPlayerName] = useState(defaultPlayerName || '旅人');
  const [gender, setGender] = useState<GameStartConfig['player']['gender']>('other');
  const [routeId, setRouteId] = useState('');

  const routeOptions = useMemo(() => {
    if (routes.length > 0) return routes;
    return [{ id: 'default', title: '默认开场', openingMonologue: '' }];
  }, [routes]);

  React.useEffect(() => {
    if (routeOptions.length === 1) {
      setRouteId(routeOptions[0].id);
    }
  }, [routeOptions]);

  const draft: Partial<GameStartConfig> = {
    player: { name: playerName, gender },
    openingRouteId: routeId,
  };
  const canStart = isStartAdventureEnabled(draft);
  const selected = resolveOpeningRouteSelection(routeOptions, routeId);

  if (!isOpen) return null;

  const handleStart = () => {
    const resolved = resolveOpeningRouteSelection(routeOptions, routeId);
    if (!resolved.ok) {
      toast.error(resolved.message || '请选择故事线');
      return;
    }
    const checked = validateGameStartConfig({
      player: { name: playerName, gender },
      openingRouteId: resolved.openingRouteId,
      openingMonologue: resolved.openingMonologue,
      retainedStorylineIds: resolved.retainedStorylineIds,
    });
    if (!checked.ok) {
      toast.error(checked.message || '开局配置无效');
      return;
    }
    onConfirm(checked.data);
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.panel}>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.hint}>创建角色并选择故事线后开始冒险</p>

        <label className={styles.field}>
          <span>姓名 *</span>
          <input value={playerName} onChange={(e) => setPlayerName(e.target.value)} maxLength={40} />
        </label>
        <label className={styles.field}>
          <span>性别 *</span>
          <PanelSelect
            aria-label="性别"
            value={gender}
            onChange={(v) => setGender(v as GameStartConfig['player']['gender'])}
            options={[
              { value: 'male', label: '男' },
              { value: 'female', label: '女' },
              { value: 'other', label: '其他' },
            ]}
          />
        </label>

        <div className={styles.section}>故事线 *（必选）</div>
        <div className={styles.routeList}>
          {routeOptions.map((r) => (
            <button
              key={r.id}
              type="button"
              className={`${styles.routeCard} ${routeId === r.id ? styles.routeActive : ''}`}
              onClick={() => setRouteId(r.id)}
            >
              <div className={styles.routeTitle}>{r.title}</div>
              {r.summary ? <div className={styles.routeSummary}>{r.summary}</div> : null}
            </button>
          ))}
        </div>

        {selected.ok && selected.openingMonologue ? (
          <div className={styles.monoBox}>
            <div className={styles.section}>开场白预览</div>
            <p>{selected.openingMonologue}</p>
          </div>
        ) : null}

        <button
          type="button"
          className={styles.startBtn}
          disabled={!canStart || isLoading}
          onClick={handleStart}
        >
          {isLoading ? '进入中…' : '开始冒险'}
        </button>
      </div>
    </div>
  );
};

export default GameStartWizard;
