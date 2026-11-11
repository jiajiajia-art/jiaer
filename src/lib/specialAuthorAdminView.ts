import type { AdminCreatorBenefitUser } from '../api/creatorBenefits/creatorBenefits.type';

export function isExistingSpecialAuthor(user: Pick<AdminCreatorBenefitUser, 'benefits'>): boolean {
  return user.benefits.authorType === 'contracted' || user.benefits.authorType === 'special';
}

export function clampAuthorPage(page: number, totalPages: number): number {
  return Math.min(Math.max(1, page), Math.max(1, totalPages));
}
