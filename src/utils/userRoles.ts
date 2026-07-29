export const USER_ROLES = {
  CREATOR: 'creator',
  CREATOR_VERIFIED: 'creator_verified',
  OPERATOR: 'operator',
  ADMIN: 'admin',
  LEGACY_USER: 'user',
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];

export function normalizeUserRole(role?: string | null): UserRole | string {
  const value = String(role || '').trim();
  if (!value || value === USER_ROLES.LEGACY_USER) {
    return USER_ROLES.CREATOR;
  }
  return value;
}

export function isCreatorRole(role?: string | null): boolean {
  const normalized = normalizeUserRole(role);
  return normalized === USER_ROLES.CREATOR
    || normalized === USER_ROLES.CREATOR_VERIFIED
    || normalized === USER_ROLES.ADMIN;
}

export function isOperatorRole(role?: string | null): boolean {
  const normalized = normalizeUserRole(role);
  return normalized === USER_ROLES.OPERATOR || normalized === USER_ROLES.ADMIN;
}

export function isAdminRole(role?: string | null): boolean {
  return normalizeUserRole(role) === USER_ROLES.ADMIN;
}

export function isVerifiedCreatorRole(role?: string | null): boolean {
  return normalizeUserRole(role) === USER_ROLES.CREATOR_VERIFIED;
}
