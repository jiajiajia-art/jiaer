import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  type OperatorStatsPreset,
  operatorPresetLabelKey,
} from '../../utils/operatorStatsRange';
import styles from '../../page/operator/OperatorStatsShared.module.css';

const MAIN_PRESETS: OperatorStatsPreset[] = ['today', 'yesterday', 'last7', 'last30'];

interface OperatorStatsPresetBarProps {
  preset: OperatorStatsPreset;
  onSelectPreset: (preset: OperatorStatsPreset) => void;
  onOpenCustom: () => void;
}

const OperatorStatsPresetBar: React.FC<OperatorStatsPresetBarProps> = ({
  preset,
  onSelectPreset,
  onOpenCustom,
}) => {
  const { t } = useTranslation();

  return (
    <div className={styles.presetRow}>
      <div className={styles.presetRowMain}>
        {MAIN_PRESETS.map((item) => (
          <button
            key={item}
            type="button"
            className={`${styles.presetButton} ${preset === item ? styles.presetButtonActive : ''}`}
            onClick={() => onSelectPreset(item)}
          >
            {t(operatorPresetLabelKey(item))}
          </button>
        ))}
      </div>
      <div className={styles.presetRowEnd}>
        <button
          type="button"
          className={`${styles.presetButton} ${preset === 'all' ? styles.presetButtonActive : ''}`}
          onClick={() => onSelectPreset('all')}
        >
          {t(operatorPresetLabelKey('all'))}
        </button>
        <button
          type="button"
          className={`${styles.presetButton} ${preset === 'custom' ? styles.presetButtonActive : ''}`}
          onClick={onOpenCustom}
        >
          {t('operator.siteStats.presetCustom')}
        </button>
      </div>
    </div>
  );
};

export default OperatorStatsPresetBar;
