export type CreatorBenefitWorkStatus = 'published' | 'unpublished' | 'operator_takedown' | 'deleted';

export interface CreatorBenefitWork {
  fileId: string;
  title: string;
  engine: string;
  pv: number;
  status: CreatorBenefitWorkStatus;
  included: boolean;
  keepLevelContribution: boolean;
  takedownReason: string | null;
  updatedAt: string | null;
}

export interface CreatorBenefitSummary {
  userId: string;
  isSpecialAuthor: boolean;
  label: string;
  level: number | null;
  totalPv: number;
  currentLevelMinPv: number | null;
  nextLevel: number | null;
  nextLevelPv: number | null;
  progressPv: number | null;
  requiredPv: number | null;
  progressPercent: number;
  editorShareRatio: number;
  customShareRatio: number;
  freeTxtCreation: boolean;
  specialNote: string | null;
  recommendedRanges: {
    editorShareRatio: [number, number];
    customShareRatio: [number, number];
  };
}

export interface CreatorBenefitWorksResult {
  included: CreatorBenefitWork[];
  excluded: CreatorBenefitWork[];
}

export interface AdminCreatorBenefitUser {
  userId: string;
  userCode: string;
  phoneNumber: string;
  nickname: string;
  role: string;
  benefits: CreatorBenefitSummary;
}

export interface AdminManagedGame {
  fileId: string;
  creatorUserId: string;
  title: string;
  engine: string;
  status: CreatorBenefitWorkStatus;
  isPublic: number;
  pv: number;
  creator: {
    userCode: string;
    phoneNumber: string;
    nickname: string;
  };
  takedownAt: string | null;
  takedownBy: string | null;
  takedownReason: string | null;
  keepLevelContribution: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface AdminManagedGameResult {
  list: AdminManagedGame[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface SpecialAuthorPayload {
  enabled: boolean;
  editorShareRatio?: number;
  customShareRatio?: number;
  freeTxtCreation?: boolean;
  note?: string;
}
