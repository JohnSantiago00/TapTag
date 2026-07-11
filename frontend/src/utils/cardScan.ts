import { NativeModules, Platform } from "react-native";

export type CustomCardNetwork = "Visa" | "Mastercard" | "Amex" | "Discover" | "Other";

export interface ScannedCardDetails {
  network: CustomCardNetwork;
  last4: string;
  issuer?: string;
  cardholderName?: string;
}

type TextRecognitionModule = {
  recognize: (imageUri: string) => Promise<{ text?: string }>;
};

declare const require: (name: string) => unknown;

function getTextRecognitionModule(): TextRecognitionModule | null {
  try {
    const loaded = require("@react-native-ml-kit/text-recognition") as {
      default?: TextRecognitionModule;
      recognize?: TextRecognitionModule["recognize"];
    };
    const module = loaded.default ?? loaded;
    if (module && typeof module.recognize === "function") {
      return module as TextRecognitionModule;
    }
    return null;
  } catch {
    return null;
  }
}

export function isCardScanAvailable() {
  return (
    Platform.OS !== "web" &&
    Boolean(NativeModules.TextRecognition) &&
    Boolean(getTextRecognitionModule())
  );
}

export async function recognizeCardFromImage(
  imageUri: string
): Promise<ScannedCardDetails | null> {
  const recognition = getTextRecognitionModule();
  if (!recognition || !NativeModules.TextRecognition) return null;

  const result = await recognition.recognize(imageUri);
  return parseScannedCardText(result.text ?? "");
}

export function parseScannedCardText(text: string): ScannedCardDetails | null {
  const pan = findPanCandidate(text);
  if (!pan) return null;

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const panLineIndex = lines.findIndex((line) => line.includes(pan.slice(-4)));
  const cleanLines = lines.filter((line) => !line.replace(/\D/g, "").includes(pan));
  const issuer = findReadableLine(cleanLines.slice(0, Math.max(panLineIndex, 0)));
  const cardholderName = findReadableLine(
    cleanLines.slice(Math.max(panLineIndex + 1, 0)).reverse()
  );

  return {
    network: networkFromPan(pan),
    last4: pan.slice(-4),
    issuer,
    cardholderName,
  };
}

function findPanCandidate(text: string) {
  const candidates = text.match(/(?:\d[\s-]?){15,16}/g) ?? [];

  for (const candidate of candidates) {
    const digits = candidate.replace(/\D/g, "");
    if ((digits.length === 15 || digits.length === 16) && passesLuhn(digits)) {
      return digits;
    }
  }

  return null;
}

function passesLuhn(value: string) {
  let sum = 0;
  let shouldDouble = false;

  for (let index = value.length - 1; index >= 0; index -= 1) {
    let digit = Number(value[index]);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum > 0 && sum % 10 === 0;
}

function networkFromPan(pan: string): CustomCardNetwork {
  const first = pan[0];
  const firstTwo = Number(pan.slice(0, 2));
  const firstFour = Number(pan.slice(0, 4));

  if (first === "4") return "Visa";
  if ((firstTwo >= 51 && firstTwo <= 55) || (firstFour >= 2221 && firstFour <= 2720)) {
    return "Mastercard";
  }
  if (firstTwo === 34 || firstTwo === 37) return "Amex";
  if (pan.startsWith("6011") || firstTwo === 65) return "Discover";
  return "Other";
}

function findReadableLine(lines: string[]) {
  return lines.find((line) => {
    if (/\d{3,}/.test(line)) return false;
    if (line.length < 4 || line.length > 48) return false;
    if (/VALID|THRU|EXPIRES|CARD|DEBIT|CREDIT|MEMBER/i.test(line)) return false;
    return /[A-Za-z]/.test(line);
  });
}
