import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FiX } from 'react-icons/fi';
import type { AiModelCapability } from '../../lib/aiModelCatalog';
import styles from './modelCatalog.module.css';

interface Props {
  capability: AiModelCapability;
  modelIds: string[];
  importedModelIds: string[];
  onImport: (modelIds: string[]) => Promise<void>;
  onClose: () => void;
}

const ModelImportDialog: React.FC<Props> = ({
  capability,
  modelIds,
  importedModelIds,
  onImport,
  onClose,
}) => {
  const { t } = useTranslation();
  const capabilityLabel = capability === 'text'
    ? t('aiModelCenter.catalog.capabilityText')
    : t('aiModelCenter.catalog.capabilityImage');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const imported = useMemo(() => new Set(importedModelIds.map((id) => id.toLowerCase())), [importedModelIds]);
  const filtered = useMemo(() => modelIds.filter((id) => id.toLowerCase().includes(query.trim().toLowerCase())), [modelIds, query]);

  const submit = async () => {
    if (!selected.length) { setError(t('aiModelCenter.catalog.pickAtLeastOne')); return; }
    setSubmitting(true); setError('');
    try {
      await onImport(selected);
      onClose();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t('aiModelCenter.catalog.importFailed'));
    } finally { setSubmitting(false); }
  };

  return (
    <div className={styles.overlay} role="presentation">
      <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="import-dialog-title">
        <header className={styles.dialogHeader}>
          <div><h3 id="import-dialog-title">{t('aiModelCenter.catalog.importTitle', { capability: capabilityLabel })}</h3><p>{t('aiModelCenter.catalog.importHint')}</p></div>
          <button type="button" className={styles.iconButton} aria-label={t('aiModelCenter.catalog.closeImportAria')} onClick={onClose}><FiX aria-hidden /></button>
        </header>
        <div className={styles.dialogBody}>
          <input className={styles.searchInput} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('aiModelCenter.catalog.searchModelId')} aria-label={t('aiModelCenter.catalog.searchModelIdAria')} />
          {error ? <div className={styles.error} role="alert">{error}</div> : null}
          <div className={styles.importList}>
            {filtered.map((id) => {
              const disabled = imported.has(id.toLowerCase());
              return <label className={styles.importRow} key={id}><input type="checkbox" checked={selected.includes(id)} disabled={disabled || submitting} onChange={(e) => setSelected((current) => e.target.checked ? [...current, id] : current.filter((item) => item !== id))} /><code>{id}</code>{disabled ? <span>{t('aiModelCenter.catalog.alreadyImported')}</span> : null}</label>;
            })}
            {!filtered.length ? <div className={styles.empty}>{t('aiModelCenter.catalog.noMatchingModels')}</div> : null}
          </div>
          <div className={styles.dialogActions}><button type="button" className={styles.secondary} onClick={onClose} disabled={submitting}>{t('aiModelCenter.catalog.cancel')}</button><button type="button" className={styles.primary} onClick={() => void submit()} disabled={submitting}>{submitting ? t('aiModelCenter.catalog.importing') : t('aiModelCenter.catalog.importCount', { count: selected.length })}</button></div>
        </div>
      </section>
    </div>
  );
};

export default ModelImportDialog;
