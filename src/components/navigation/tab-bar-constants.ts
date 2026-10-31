/** Shared layout tokens for the floating glass tab bar. */
export const TAB_BAR_PILL_HEIGHT = 64;
export const TAB_BAR_INDICATOR_SIZE = 50;
export const TAB_BAR_ICON_ANCHOR_SIZE = 38;
export const TAB_BAR_ICON_TOP = 8;
export const TAB_BAR_INDICATOR_TOP =
  TAB_BAR_ICON_TOP + (TAB_BAR_ICON_ANCHOR_SIZE - TAB_BAR_INDICATOR_SIZE) / 2;
export const TAB_BAR_FLOAT_GAP = 8;

export function getTabBarOverlayHeight(bottomSafeInset: number): number {
  return TAB_BAR_PILL_HEIGHT + bottomSafeInset + TAB_BAR_FLOAT_GAP;
}
