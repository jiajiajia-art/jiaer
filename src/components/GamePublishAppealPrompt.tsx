import React from 'react';
import { useNavigate } from 'react-router-dom';
import ConfirmModal from './CommonModal/ConfirmModal';
import type { GamePublishAppealBlock } from '../utils/gamePublishAppeal';

interface GamePublishAppealPromptProps {
  block: GamePublishAppealBlock | null;
  onClose: () => void;
}

const GamePublishAppealPrompt: React.FC<GamePublishAppealPromptProps> = ({ block, onClose }) => {
  const navigate = useNavigate();

  return (
    <ConfirmModal
      variant="alert"
      tone="dark"
      isOpen={Boolean(block)}
      title="作品暂时无法发布"
      message={block?.message || ''}
      confirmButtonText="我已修改，去申诉重新发布"
      onConfirm={() => {
        if (!block) return;
        const target = `/game-publish-appeals/${encodeURIComponent(block.fileId)}`;
        onClose();
        navigate(target);
      }}
      onCancel={onClose}
    />
  );
};

export default GamePublishAppealPrompt;

