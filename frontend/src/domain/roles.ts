import type { EntityKind } from './scenario';

export const ROLE_COLORS: Record<EntityKind, string> = {
  shooter: '#f5b400',
  defender: '#3b82f6',
  teammate: '#f1f5f9',
  goalkeeper: '#22c55e',
};

export const ROLE_LABELS: Record<EntityKind, string> = {
  shooter: 'S',
  defender: 'D',
  teammate: 'T',
  goalkeeper: 'GK',
};
