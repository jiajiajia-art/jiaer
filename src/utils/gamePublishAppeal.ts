export const GAME_ADMIN_TAKEDOWN = 'GAME_ADMIN_TAKEDOWN';

type PublishErrorData = {
  code?: unknown;
  message?: unknown;
};

export interface GamePublishAppealBlock {
  fileId: string;
  message: string;
}

const readErrorData = (error: unknown): PublishErrorData => {
  if (!error || typeof error !== 'object') return {};
  const candidate = error as {
    code?: unknown;
    message?: unknown;
    response?: { data?: PublishErrorData };
  };
  return {
    code: candidate.response?.data?.code ?? candidate.code,
    message: candidate.response?.data?.message ?? candidate.message,
  };
};

export const attachPublishErrorData = (message: string, data?: PublishErrorData) => Object.assign(
  new Error(message),
  { code: data?.code },
);

export const resolveGamePublishAppealBlock = (
  errorOrData: unknown,
  fileId: string | null | undefined,
): GamePublishAppealBlock | null => {
  const data = readErrorData(errorOrData);
  if (String(data.code || '') !== GAME_ADMIN_TAKEDOWN || !fileId) return null;
  return {
    fileId,
    message: String(data.message || '该作品已被运营下架，请修改后提交重新发布申诉。'),
  };
};

