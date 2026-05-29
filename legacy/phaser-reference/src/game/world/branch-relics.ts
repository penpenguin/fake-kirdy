export const BRANCH_RELIC_ITEM_IDS = [
  'forest-keystone',
  'ice-keystone',
  'fire-keystone',
  'cave-keystone',
] as const;

export type BranchRelicItemId = (typeof BRANCH_RELIC_ITEM_IDS)[number];
