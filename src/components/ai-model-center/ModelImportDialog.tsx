import React, { useMemo, useState } from 'react';
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
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const imported = useMemo(() => new Set(importedModelIds.map((id) => id.toLowerCase())), [importedModelIds]);
  const filtered = useMemo(() => modelIds.filter((id) => id.toLowerCase().includes(query.trim().toLowerCase())), [modelIds, query]);

  const submit = async () => {
    if (!selected.length) { setError('请至少选择一个尚未导入的模型'); return; }
    setSubmitting(true); setError('');
    try {
      await onImport(selected);
      onClose();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '模型导入失败，请重试');
    } finally { setSubmitting(false); }
  };

  return (
    <div className={styles.overlay} role="presentation">
      <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="import-dialog-title">
        <header className={styles.dialogHeader}>
          <div><h3 id="import-dialog-title">导入{capability === 'text' ? '生文' : '生图'}模型</h3><p>只能选择本次由上游返回的模型 ID，不能手动填写。</p></div>
          <button type="button" className={styles.iconButton} aria-label="关闭模型导入" onClick={onClose}><FiX aria-hidden /></button>
        </header>
        <div className={styles.dialogBody}>
          <input className={styles.searchInput} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索模型 ID" aria-label="搜索模型 ID" />
          {error ? <div className={styles.error} role="alert">{error}</div> : null}
          <div className={styles.importList}>
            {filtered.map((id) => {
              const disabled = imported.has(id.toLowerCase());
              return <label className={styles.importRow} key={id}><input type="checkbox" checked={selected.includes(id)} disabled={disabled || submitting} onChange={(e) => setSelected((current) => e.target.checked ? [...current, id] : current.filter((item) => item !== id))} /><code>{id}</code>{disabled ? <span>已导入</span> : null}</label>;
            })}
            {!filtered.length ? <div className={styles.empty}>没有匹配的模型</div> : null}
          </div>
          <div className={styles.dialogActions}><button type="button" className={styles.secondary} onClick={onClose} disabled={submitting}>取消</button><button type="button" className={styles.primary} onClick={() => void submit()} disabled={submitting}>{submitting ? '导入中…' : `导入 ${selected.length} 个模型`}</button></div>
        </div>
      </section>
    </div>
  );
};

export default ModelImportDialog;
