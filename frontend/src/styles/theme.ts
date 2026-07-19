export const colors = {
  background: "#070A12",
  backgroundElevated: "#0B1020",
  surface: "#111827",
  surfaceRaised: "#172033",
  surfaceSoft: "#0D1424",
  border: "#263248",
  borderSoft: "#1B263A",
  text: "#F7F9FC",
  textSecondary: "#A8B3C7",
  textMuted: "#6F7D95",
  accent: "#73F2C0",
  accentStrong: "#38D9A0",
  accentInk: "#05291D",
  violet: "#9B8CFF",
  blue: "#6CB6FF",
  warning: "#F6C667",
  warningSurface: "#2B2210",
  danger: "#FF7A90",
  dangerSurface: "#29141B",
  success: "#73F2C0",
  white: "#FFFFFF",
  black: "#000000",
} as const;

export const radii = {
  small: 10,
  medium: 16,
  large: 22,
  xlarge: 28,
  pill: 999,
} as const;

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 22,
  xl: 30,
  xxl: 40,
} as const;

export const shadows = {
  floating: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
    elevation: 12,
  },
  soft: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 6,
  },
} as const;
