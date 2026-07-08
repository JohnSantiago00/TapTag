import * as Notifications from "expo-notifications";
import { Href } from "expo-router";
import { Platform } from "react-native";

export const PAYMENT_PROMPT_NOTIFICATION_CATEGORY = "payment-recommendation";
const PAYMENT_PROMPT_NOTIFICATION_TYPE = "payment_prompt";

export type PaymentPromptSource = "lab" | "nearby" | "notification";

export type PaymentPromptInput = {
  source: PaymentPromptSource;
  merchantName?: string;
  merchantMcc?: number;
  normalizedCategory?: string;
  recommendedCardProductId?: string;
  recommendedCardName: string;
  rewardRate?: number;
  reason?: string;
};

export type PaymentPromptParams = Record<string, string>;

let notificationsConfigured = false;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export function buildPaymentPromptParams(input: PaymentPromptInput): PaymentPromptParams {
  return cleanParams({
    source: input.source,
    merchantName: input.merchantName,
    merchantMcc: input.merchantMcc,
    normalizedCategory: input.normalizedCategory,
    recommendedCardProductId: input.recommendedCardProductId,
    recommendedCardName: input.recommendedCardName,
    rewardRate: input.rewardRate,
    reason: input.reason,
  });
}

export function buildPaymentPromptHref(input: PaymentPromptInput): Href {
  return {
    pathname: "/pay-card",
    params: buildPaymentPromptParams(input),
  } as unknown as Href;
}

export function getWalletInstruction(cardName: string) {
  if (Platform.OS === "ios") {
    return `Double-click the side button, choose ${cardName}, then hold iPhone near the reader.`;
  }

  if (Platform.OS === "android") {
    return `Open Google Wallet, choose ${cardName}, then hold your phone near the reader.`;
  }

  return `Open your phone wallet, choose ${cardName}, then hold your phone near the reader.`;
}

export function getPaymentPromptNotificationData(input: PaymentPromptInput) {
  return {
    type: PAYMENT_PROMPT_NOTIFICATION_TYPE,
    ...buildPaymentPromptParams(input),
  };
}

export function isPaymentPromptNotificationData(
  data: Record<string, unknown>
): data is PaymentPromptParams & { type: typeof PAYMENT_PROMPT_NOTIFICATION_TYPE } {
  return (
    data.type === PAYMENT_PROMPT_NOTIFICATION_TYPE &&
    typeof data.recommendedCardName === "string" &&
    data.recommendedCardName.trim().length > 0
  );
}

export async function configurePaymentPromptNotifications() {
  if (notificationsConfigured) return;

  await Notifications.setNotificationCategoryAsync(
    PAYMENT_PROMPT_NOTIFICATION_CATEGORY,
    [
      {
        identifier: "show-card",
        buttonTitle: "Show Card",
        options: {
          opensAppToForeground: true,
        },
      },
    ]
  );

  notificationsConfigured = true;
}

export async function schedulePaymentPromptNotification(input: PaymentPromptInput) {
  await configurePaymentPromptNotifications();

  const permissions = await ensureNotificationPermissions();
  if (!permissions) {
    return false;
  }

  const merchant = input.merchantName ?? "this merchant";
  const reward =
    typeof input.rewardRate === "number" && input.normalizedCategory
      ? ` for ${input.rewardRate}x ${input.normalizedCategory}`
      : "";

  await Notifications.scheduleNotificationAsync({
    content: {
      title: `Use ${input.recommendedCardName}`,
      body: `Tap to see the payment prompt for ${merchant}${reward}.`,
      data: getPaymentPromptNotificationData(input),
      categoryIdentifier: PAYMENT_PROMPT_NOTIFICATION_CATEGORY,
    },
    trigger: null,
  });

  return true;
}

async function ensureNotificationPermissions() {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

function cleanParams(values: Record<string, unknown>): PaymentPromptParams {
  return Object.entries(values).reduce<PaymentPromptParams>((params, [key, value]) => {
    if (value === undefined || value === null || value === "") {
      return params;
    }

    params[key] = String(value);
    return params;
  }, {});
}
