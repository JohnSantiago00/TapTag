import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { sendPasswordResetEmail, signInWithEmailAndPassword } from "firebase/auth";
import { useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth } from "../../src/config/firebase";
import { BrandMark } from "../../src/components/AppChrome";
import { getCenteredScreenContentStyle } from "../../src/styles/layout";
import { colors, radii, shadows, spacing } from "../../src/styles/theme";
import { validateEmail, validatePassword } from "../../src/utils/validation";

/*
  File role:
  Login is the lightweight auth entry point for returning users.

  Why it stays simple:
  Authentication is not the product differentiator here. The code is written to
  be readable, calm, and reliable rather than feature-rich.
*/

export default function Login() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // This handler keeps login logic in the screen because the behavior is small,
  // local, and tightly coupled to screen status copy.
  const handleLogin = async () => {
    if (!validateEmail(email)) return setStatus("Please enter a valid email.");
    if (!validatePassword(password))
      return setStatus("Password must be at least 6 characters.");

    try {
      setLoading(true);
      setStatus("Logging in...");
      await signInWithEmailAndPassword(auth, email.trim(), password);
      setStatus("Login successful!");
      router.replace("/(tabs)/Home");
    } catch (error: any) {
      console.error(error);
      setStatus(getFirebaseErrorMessage(error.code));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!validateEmail(email)) {
      return setStatus("Enter your email above first, then tap Forgot Password.");
    }

    try {
      setLoading(true);
      await sendPasswordResetEmail(auth, email.trim());
      // Same copy for existing and unknown emails so this screen cannot be
      // used to probe which addresses have accounts.
      setStatus("If an account exists for that email, a reset link is on its way.");
    } catch (error: any) {
      console.error(error);
      setStatus(
        error.code === "auth/too-many-requests"
          ? "Too many attempts. Try again later."
          : "Could not send the reset email. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  // Firebase error codes are mapped to calmer user-facing messages so the UI
  // stays understandable without exposing raw SDK wording.
  const getFirebaseErrorMessage = (code: string): string => {
    switch (code) {
      case "auth/invalid-credential":
      case "auth/wrong-password":
        return "Incorrect email or password.";
      case "auth/user-not-found":
        return "No account found with that email.";
      case "auth/too-many-requests":
        return "Too many attempts. Try again later.";
      case "auth/network-request-failed":
        return "Network error. Check your connection and try again.";
      default:
        return "Something went wrong. Please try again.";
    }
  };

  return (
    <SafeAreaView style={styles.flex} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={getCenteredScreenContentStyle(width)}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.brandWrap}><BrandMark /></View>
          <Text style={styles.eyebrow}>Smart wallet intelligence</Text>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>
            Sign in to get the best card for every purchase.
          </Text>
          <View style={styles.formCard}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor={colors.textMuted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
            />
            <View style={styles.passwordLabelRow}>
              <Text style={styles.label}>Password</Text>
              <TouchableOpacity onPress={handleForgotPassword} disabled={loading}><Text style={styles.forgotText}>Forgot password?</Text></TouchableOpacity>
            </View>
            <View style={styles.passwordRow}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Enter your password"
                placeholderTextColor={colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoComplete="password"
                returnKeyType="done"
                onSubmitEditing={() => { Keyboard.dismiss(); handleLogin(); }}
              />
              <TouchableOpacity style={styles.eyeButton} onPress={() => setShowPassword((current) => !current)} accessibilityLabel={showPassword ? "Hide password" : "Show password"}>
                <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {status ? <View style={styles.statusCard}><Text style={styles.status}>{status}</Text></View> : null}
            <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleLogin} disabled={loading}>
              {loading ? <ActivityIndicator color={colors.accentInk} /> : <><Text style={styles.buttonText}>Sign in</Text><Ionicons name="arrow-forward" size={18} color={colors.accentInk} /></>}
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.signupLink} onPress={() => router.push("/(auth)/SignUp")}>
            <Text style={styles.signupCopy}>New to TapTag? <Text style={styles.signupAccent}>Create an account</Text></Text>
          </TouchableOpacity>
          <View style={styles.privacyRow}><Ionicons name="shield-checkmark-outline" size={16} color={colors.accent} /><Text style={styles.privacyText}>Payment credentials never touch TapTag.</Text></View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  brandWrap: { alignSelf: "flex-start", marginBottom: spacing.xxl },
  eyebrow: { alignSelf: "flex-start", color: colors.accent, fontSize: 12, fontWeight: "800", letterSpacing: 1.1, marginBottom: spacing.sm, textTransform: "uppercase" },
  title: {
    alignSelf: "flex-start", color: colors.text, fontSize: 34, fontWeight: "900", letterSpacing: -1.2, marginBottom: spacing.sm,
  },
  subtitle: {
    alignSelf: "flex-start", color: colors.textSecondary, fontSize: 15, lineHeight: 22, marginBottom: spacing.xl, textAlign: "left",
  },
  formCard: { backgroundColor: colors.surface, borderColor: colors.borderSoft, borderRadius: radii.xlarge, borderWidth: 1, padding: spacing.lg, width: "100%", ...shadows.soft },
  label: { color: colors.textSecondary, fontSize: 13, fontWeight: "700", marginBottom: 7 },
  input: {
    backgroundColor: colors.surfaceSoft, borderColor: colors.border, borderRadius: radii.medium, borderWidth: 1, color: colors.text, fontSize: 15, marginBottom: spacing.md, minHeight: 52, paddingHorizontal: spacing.md, width: "100%",
  },
  passwordLabelRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  forgotText: { color: colors.accent, fontSize: 12, fontWeight: "800", marginBottom: 7 },
  passwordRow: {
    alignItems: "center", backgroundColor: colors.surfaceSoft, borderColor: colors.border, borderRadius: radii.medium, borderWidth: 1, flexDirection: "row", marginBottom: spacing.md, width: "100%",
  },
  passwordInput: { color: colors.text, flex: 1, fontSize: 15, minHeight: 52, paddingHorizontal: spacing.md },
  eyeButton: { paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  statusCard: { backgroundColor: colors.surfaceRaised, borderRadius: radii.small, marginBottom: spacing.md, padding: spacing.sm },
  status: { color: colors.textSecondary, fontSize: 13, lineHeight: 18, textAlign: "center" },
  button: {
    alignItems: "center", backgroundColor: colors.accent, borderRadius: radii.medium, flexDirection: "row", gap: spacing.sm, justifyContent: "center", minHeight: 52, marginTop: spacing.xs,
  },
  buttonDisabled: { opacity: 0.55 },
  buttonText: { color: colors.accentInk, fontSize: 15, fontWeight: "900" },
  signupLink: { marginTop: spacing.lg, padding: spacing.sm },
  signupCopy: { color: colors.textSecondary, fontSize: 14 },
  signupAccent: { color: colors.accent, fontWeight: "800" },
  privacyRow: { alignItems: "center", flexDirection: "row", gap: 7, marginTop: spacing.lg },
  privacyText: { color: colors.textMuted, fontSize: 12 },
});
