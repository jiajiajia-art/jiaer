import React, { useEffect, useState } from 'react';
import replayApi from '../../api/galgame/replay';
import type { ReplaySummary } from '../../api/galgame/replay';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../../store/gameStore';

interface Props {
  fileId: string;
}

const ReplayList: React.FC<Props> = ({ fileId }) => {
  const navigate = useNavigate();
  const { setFileId } = useGameStore();
  const [items, setItems] = useState<ReplaySummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const limit = 20;

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        setLoading(true);
        const resp = await replayApi.listByFileId({ fileId, offset, limit, sort: 'createdAt' });
        if (!cancelled) {
          setItems(resp.data?.items || []);
          setTotal(resp.data?.total || 0);
        }
      } catch (e) {
        if (!cancelled) setError('加载回放列表失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [fileId, offset]);

  const handlePlay = (replayId: string) => {
    setFileId(fileId);
    navigate(`/galgame?mode=replay&replayId=${encodeURIComponent(replayId)}`);
  };

  if (loading) {
    return <div style={{ padding: 12, color: '#666' }}>回放加载中…</div>;
  }
  if (error) {
    return <div style={{ padding: 12, color: '#c00' }}>{error}</div>;
  }
  if (!items.length) {
    return <div style={{ padding: 12, color: '#666' }}>暂无回放</div>;
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {items.map(it => (
        <div key={it.replayId} style={{ display: 'flex', gap: 12, border: '1px solid #eee', borderRadius: 10, padding: 12, alignItems: 'center' }}>
          {it.coverImageUrl && (
            <img src={it.coverImageUrl} alt={it.title} style={{ width: 96, height: 60, objectFit: 'cover', borderRadius: 8 }} />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.title}</div>
            <div style={{ color: '#777', fontSize: 12, marginTop: 4 }}>
              <span>{it.ownerName}</span>
              <span style={{ margin: '0 8px' }}>·</span>
              <span>{new Date(it.createdAt).toLocaleString()}</span>
              {typeof it.stepsCount === 'number' && (
                <>
                  <span style={{ margin: '0 8px' }}>·</span>
                  <span>{it.stepsCount} 步</span>
                </>
              )}
            </div>
            {it.previewText && (
              <div style={{ color: '#555', fontSize: 12, marginTop: 6, maxHeight: 36, overflow: 'hidden' }}>{it.previewText}</div>
            )}
          </div>
          <button onClick={() => handlePlay(it.replayId)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #E03D4B', background: '#E03D4B', color: '#fff', cursor: 'pointer' }}>播放</button>
        </div>
      ))}
      {total > items.length && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
          <button onClick={() => setOffset(offset + limit)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #ddd', background: '#fff', cursor: 'pointer' }}>加载更多</button>
        </div>
      )}
    </div>
  );
};

export default ReplayList;
