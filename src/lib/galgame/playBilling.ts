import type { MembershipPlanId } from '../../api/account/auth.type';

export const GALGAME_FREE_ROUNDS = 0;
export const PRESET_OPTION_KK_COST = 2;
export const CUSTOM_INPUT_KK_COST = 3;

export type PlayInteractionType = 'preset_option' | 'custom_input' | 'system' | 'retry';

export interface StreamBusinessError {
  code?: string;
  message: string;
  currency?: string;
  retryable?: boolean;
}

const EXCHANGE_DISCOUNTS: Record<MembershipPlanId, number> = {
  week: 1,
  month_v2: 1,
};

export const isInsufficientDiamondsError = (
  value: Pick<StreamBusinessError, 'code'> | null | undefined,
): boolean => value?.code === 'INSUFFICIENT_DIAMONDS';

export const isWithinGalgameFreeRounds = (assistantRoundCount: number): boolean => {
  const completedPlayerRounds = Math.max(0, Math.floor(Number(assistantRoundCount) || 0) - 1);
  return completedPlayerRounds < GALGAME_FREE_ROUNDS;
};

export const getRequiredKkCoins = (
  interactionType: PlayInteractionType,
  isFreeRound: boolean,
): number => {
  if (isFreeRound) return 0;
  if (interactionType === 'preset_option') return PRESET_OPTION_KK_COST;
  if (interactionType === 'custom_input') return CUSTOM_INPUT_KK_COST;
  return 0;
};

export const hasEnoughKkCoins = (
  balance: number,
  interactionType: PlayInteractionType,
  isFreeRound: boolean,
): boolean => Math.max(0, Number(balance) || 0) >= getRequiredKkCoins(interactionType, isFreeRound);

export const getExchangeDiscountForPlan = (
  planId?: MembershipPlanId | null,
): number => planId ? (EXCHANGE_DISCOUNTS[planId] ?? 1) : 1;
