import type { AppStateStatus } from "react-native";

export const BACKGROUND_NOTIFICATION_DELAY_SECONDS = 8;
export const BACKGROUND_NOTIFICATION_COOLDOWN_MS = 30 * 60 * 1000;

// Foreground notifications are represented inside TapTag's UI. System banners
// are reserved for times when the user is outside the app.
export function shouldPresentPaymentNotification(
  appState: AppStateStatus | null | undefined
) {
  return appState !== "active";
}
