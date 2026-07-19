import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { colors, radii, shadows, spacing } from "../styles/theme";

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <View style={styles.brandRow}>
      <View style={[styles.mark, compact && styles.markCompact]}>
        <View style={styles.markCore} />
        <View style={styles.markSignal} />
      </View>
      {!compact ? <Text style={styles.brandName}>TapTag</Text> : null}
    </View>
  );
}

export function ScreenHeader({
  eyebrow,
  title,
  subtitle,
  right,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerCopy}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.headerTitle}>{title}</Text>
        {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  return (
    <TouchableOpacity
      style={styles.iconButton}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      activeOpacity={0.8}
    >
      <Ionicons name={icon} size={20} color={colors.text} />
    </TouchableOpacity>
  );
}

export function ActionButton({
  label,
  icon,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
}: {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  loading?: boolean;
  disabled?: boolean;
}) {
  const foreground = variant === "primary" ? colors.accentInk : variant === "danger" ? colors.danger : colors.text;
  return (
    <TouchableOpacity
      style={[
        styles.actionButton,
        styles[`${variant}Button`],
        (loading || disabled) && styles.buttonDisabled,
      ]}
      onPress={onPress}
      disabled={loading || disabled}
      activeOpacity={0.84}
      accessibilityRole="button"
    >
      {loading ? (
        <ActivityIndicator color={foreground} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={18} color={foreground} /> : null}
          <Text style={[styles.actionLabel, { color: foreground }]}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

export function SectionHeading({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action && onAction ? (
        <TouchableOpacity onPress={onAction} hitSlop={8}>
          <Text style={styles.sectionAction}>{action}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  brandRow: { alignItems: "center", flexDirection: "row", gap: spacing.sm },
  mark: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: 14,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  markCompact: { borderRadius: 11, height: 34, width: 34 },
  markCore: {
    backgroundColor: colors.accentInk,
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  markSignal: {
    borderColor: colors.accentInk,
    borderRadius: 10,
    borderWidth: 2,
    height: 22,
    position: "absolute",
    width: 22,
  },
  brandName: { color: colors.text, fontSize: 22, fontWeight: "900", letterSpacing: -0.7 },
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  headerCopy: { flex: 1 },
  eyebrow: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginBottom: spacing.xs,
    textTransform: "uppercase",
  },
  headerTitle: { color: colors.text, fontSize: 31, fontWeight: "900", letterSpacing: -1.1, lineHeight: 37 },
  headerSubtitle: { color: colors.textSecondary, fontSize: 14, lineHeight: 21, marginTop: spacing.xs },
  iconButton: {
    alignItems: "center",
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44,
    ...shadows.soft,
  },
  actionButton: {
    alignItems: "center",
    borderRadius: radii.medium,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    minHeight: 50,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
  primaryButton: { backgroundColor: colors.accent },
  secondaryButton: { backgroundColor: colors.surfaceRaised, borderColor: colors.border, borderWidth: 1 },
  dangerButton: { backgroundColor: colors.dangerSurface, borderColor: "#59303A", borderWidth: 1 },
  ghostButton: { backgroundColor: "transparent" },
  buttonDisabled: { opacity: 0.5 },
  actionLabel: { fontSize: 15, fontWeight: "800" },
  sectionHeading: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.md },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: "800", letterSpacing: -0.3 },
  sectionAction: { color: colors.accent, fontSize: 13, fontWeight: "800" },
});
