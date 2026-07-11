import { ViewStyle } from "react-native";
import { EdgeInsets } from "react-native-safe-area-context";

export const TAB_BAR_BASE_HEIGHT = 64;

const MIN_BOTTOM_INSET = 8;
const TAB_SCREEN_BOTTOM_GAP = 16;
const STACK_SCREEN_BOTTOM_GAP = 24;
const MAX_CONTENT_WIDTH = 680;

export function getPageGutter(width: number) {
  if (width <= 360) return 14;
  if (width <= 430) return 20;
  return 24;
}

export function getTabBarBottomPadding(bottomInset: number) {
  return Math.max(bottomInset, MIN_BOTTOM_INSET);
}

export function getTabBarHeight(bottomInset: number) {
  return TAB_BAR_BASE_HEIGHT + getTabBarBottomPadding(bottomInset);
}

function getConstrainedContentStyle(width: number): ViewStyle {
  if (width < MAX_CONTENT_WIDTH + getPageGutter(width) * 2) {
    return {};
  }

  return {
    alignSelf: "center",
    maxWidth: MAX_CONTENT_WIDTH,
    width: "100%",
  };
}

export function getTabScrollContentStyle(
  width: number,
  insets: EdgeInsets
): ViewStyle {
  return {
    ...getConstrainedContentStyle(width),
    paddingHorizontal: getPageGutter(width),
    paddingTop: width <= 360 ? 12 : 16,
    paddingBottom: getTabBarBottomPadding(insets.bottom) + TAB_SCREEN_BOTTOM_GAP,
  };
}

export function getStackScrollContentStyle(
  width: number,
  insets: EdgeInsets
): ViewStyle {
  return {
    ...getConstrainedContentStyle(width),
    paddingHorizontal: getPageGutter(width),
    paddingTop: width <= 360 ? 12 : 16,
    paddingBottom:
      Math.max(insets.bottom, MIN_BOTTOM_INSET) + STACK_SCREEN_BOTTOM_GAP,
  };
}

export function getCenteredScreenContentStyle(width: number): ViewStyle {
  return {
    ...getConstrainedContentStyle(width),
    alignItems: "center",
    backgroundColor: "#000",
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: getPageGutter(width),
    paddingVertical: 20,
  };
}
