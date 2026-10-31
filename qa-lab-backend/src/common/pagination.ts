export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 100;

export function clampTake(take?: number): number {
  if (take == null || Number.isNaN(take)) return DEFAULT_PAGE_SIZE;
  return Math.min(Math.max(1, Math.floor(take)), MAX_PAGE_SIZE);
}
