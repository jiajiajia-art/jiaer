import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import ConfirmModal from '../CommonModal/ConfirmModal';
import { getAppBasePath } from '../../lib/appBasePath';

/** 功能注释：与正本 md 文件头版本对齐；换版后须重新勾选 */
export const CREATOR_AGREEMENT_VERSION = '1.0.0';
export const WORK_REVIEW_STANDARDS_VERSION = '1.0.0';

export type CreatorPublishAgreementResult = {
  creatorAgreementVersion: string;
  workReviewStandardsVersion: string;
  agreedAt: string;
};

type Props = {
  isOpen: boolean;
  busy?: boolean;
  onCancel: () => void;
  /** 功能注释：两勾都选后才可提交；返回版本号供落库 */
  onConfirm: (agreement: CreatorPublishAgreementResult) => void;
};

/**
 * 功能注释：Romance「提交发布审核」前协议窗。
 * 保存草稿 / 私有分享不弹；默认不勾；未勾「同意并提交」不可用。
 */
const CreatorPublishAgreementModal: React.FC<Props> = ({
  isOpen,
  busy = false,
  onCancel,
  onConfirm,
}) => {
  const [agreeCreator, setAgreeCreator] = useState(false);
  const [agreeStandards, setAgreeStandards] = useState(false);
  const base = useMemo(() => getAppBasePath().replace(/\/$/, ''), []);

  const handleConfirm = () => {
    if (!agreeCreator || !agreeStandards) {
      toast.error('请先勾选《创作者协议》与《作品审核标准》');
      return;
    }
    if (busy) return;
    onConfirm({
      creatorAgreementVersion: CREATOR_AGREEMENT_VERSION,
      workReviewStandardsVersion: WORK_REVIEW_STANDARDS_VERSION,
      agreedAt: new Date().toISOString(),
    });
  };

  const handleCancel = () => {
    if (busy) return;
    setAgreeCreator(false);
    setAgreeStandards(false);
    onCancel();
  };

  return (
    <ConfirmModal
      isOpen={isOpen}
      tone="admin"
      title="提交发布审核"
      message={
        <div style={{ fontSize: 13, lineHeight: 1.55 }}>
          <p style={{ margin: '0 0 12px' }}>
            公开发布前请阅读并同意下列文件。草稿与私有分享不必同意；换版本后再次提交须重新勾选。
          </p>
          <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 10 }}>
            <input
              type="checkbox"
              checked={agreeCreator}
              disabled={busy}
              onChange={(e) => setAgreeCreator(e.target.checked)}
            />
            <span>
              我已阅读并同意
              <Link to={`${base}/legal/creator-agreement`} target="_blank" rel="noreferrer">
                《创作者协议》
              </Link>
              （v{CREATOR_AGREEMENT_VERSION}）
            </span>
          </label>
          <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <input
              type="checkbox"
              checked={agreeStandards}
              disabled={busy}
              onChange={(e) => setAgreeStandards(e.target.checked)}
            />
            <span>
              我确认作品已达到
              <Link to={`${base}/legal/work-review-standards`} target="_blank" rel="noreferrer">
                《作品审核标准》
              </Link>
              （v{WORK_REVIEW_STANDARDS_VERSION}）
            </span>
          </label>
        </div>
      }
      confirmButtonText={busy ? '提交中…' : '同意并提交'}
      cancelButtonText="取消"
      onCancel={handleCancel}
      onConfirm={handleConfirm}
    />
  );
};

export default CreatorPublishAgreementModal;
