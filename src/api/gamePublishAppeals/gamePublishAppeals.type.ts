export type GamePublishAppealStatus = 'pending' | 'approved' | 'rejected';

export interface GamePublishAppeal {
  id: number;
  fileId: string;
  userId: string;
  gameTitle: string;
  gameEngine: string;
  coverUrl: string | null;
  portraitCoverUrl: string | null;
  takedownReason: string | null;
  takedownAt: string | null;
  gameUpdatedAt: string | null;
  appealReason: string;
  status: GamePublishAppealStatus;
  reviewRemark: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  creator?: {
    userCode: string;
    phoneNumber: string;
    nickname: string;
  };
  currentTakedownReason?: string | null;
  currentTakedownAt?: string | null;
  isPublic?: number;
}

export interface GamePublishAppealContext {
  game: {
    fileId: string;
    title: string;
    engine: string;
    coverUrl: string | null;
    portraitCoverUrl: string | null;
    isPublic: number;
    takedownReason: string | null;
    takedownAt: string | null;
    updatedAt: string | null;
    isPublishBlocked: boolean;
    isDeleted: boolean;
  };
  pendingAppeal: GamePublishAppeal | null;
  appeals: GamePublishAppeal[];
  canSubmit: boolean;
}

export interface AdminGamePublishAppealResult {
  list: GamePublishAppeal[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  pendingCount: number;
}

