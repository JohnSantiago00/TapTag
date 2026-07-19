import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { createUserWithEmailAndPassword } from "firebase/auth";
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
import { upsertUserProfile } from "../../src/services/data/userProfile";
import { getCenteredScreenContentStyle } from "../../src/styles/layout";
import { colors, radii, shadows, spacing } from "../../src/styles/theme";
import { validateEmail, validatePassword } from "../../src/utils/validation";

/*
  File role:
  SignUp creates the minimal TapTag account, email/password auth plus a
  matching API-backed user profile with privacy-first defaults.
*/

export default function SignupScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Sign up does two things, create Firebase Auth user and ensure the matching
  // backend profile exists with TapTag defaults.
  const handleSignUp = async () => {
    if (!validateEmail(email)) return setStatus("Please enter a valid email.");
    if (!validatePassword(password))
      return setStatus("Password must be at least 6 characters.");

    try {
      setLoading(true);
      setStatus("Creating account...");

      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      // Firebase returns the new auth user immediately. We then mirror that user
      // through the backend so the rest of the app has a profile to read.
      const user = userCredential.user;

      await upsertUserProfile(user.uid, {
        displayName: user.displayName ?? undefined,
      });

      setStatus("Account created!");
      router.replace("/(tabs)/Home");
    } catch (error: any) {
      console.error(error);
      setStatus(getFirebaseErrorMessage(error.code));
    } finally {
      setLoading(false);
    }
  };

  // Friendly error translation, same idea as Login.tsx.
  const getFirebaseErrorMessage = (code: string): string => {
    switch (code) {
      case "auth/email-already-in-use":
        return "This email is already registered.";
      case "auth/invalid-email":
        return "Please enter a valid email address.";
      case "auth/weak-password":
        return "Password is too weak. Try something stronger.";
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
          <Text style={styles.eyebrow}>Start optimizing</Text>
          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.subtitle}>
            A smarter wallet starts with email—never your bank login.
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
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={styles.passwordInput}
                placeholder="At least 6 characters"
                placeholderTextColor={colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoComplete="new-password"
                returnKeyType="done"
                onSubmitEditing={() => { Keyboard.dismiss(); handleSignUp(); }}
              />
              <TouchableOpacity style={styles.eyeButton} onPress={() => setShowPassword((current) => !current)} accessibilityLabel={showPassword ? "Hide password" : "Show password"}>
                <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={styles.trustRow}><Ionicons name="lock-closed-outline" size={16} color={colors.accent} /><Text style={styles.trustText}>Your wallet metadata is encrypted in transit and isolated to your account.</Text></View>
            {status ? <View style={styles.statusCard}><Text style={styles.status}>{status}</Text></View> : null}
            <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleSignUp} disabled={loading}>
              {loading ? <ActivityIndicator color={colors.accentInk} /> : <><Text style={styles.buttonText}>Create account</Text><Ionicons name="arrow-forward" size={18} color={colors.accentInk} /></>}
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.loginLink} onPress={() => router.push("/(auth)/Login")}>
            <Text style={styles.loginCopy}>Already have an account? <Text style={styles.loginAccent}>Sign in</Text></Text>
          </TouchableOpacity>
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
  passwordRow: {
    alignItems: "center", backgroundColor: colors.surfaceSoft, borderColor: colors.border, borderRadius: radii.medium, borderWidth: 1, flexDirection: "row", marginBottom: spacing.md, width: "100%",
  },
  passwordInput: { color: colors.text, flex: 1, fontSize: 15, minHeight: 52, paddingHorizontal: spacing.md },
  eyeButton: { paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  trustRow: { alignItems: "flex-start", backgroundColor: "#10271F", borderRadius: radii.small, flexDirection: "row", gap: 8, marginBottom: spacing.md, padding: spacing.sm },
  trustText: { color: "#A9DCC9", flex: 1, fontSize: 12, lineHeight: 17 },
  statusCard: { backgroundColor: colors.surfaceRaised, borderRadius: radii.small, marginBottom: spacing.md, padding: spacing.sm },
  status: { color: colors.textSecondary, fontSize: 13, lineHeight: 18, textAlign: "center" },
  button: {
    alignItems: "center", backgroundColor: colors.accent, borderRadius: radii.medium, flexDirection: "row", gap: spacing.sm, justifyContent: "center", minHeight: 52,
  },
  buttonDisabled: { opacity: 0.55 },
  buttonText: { color: colors.accentInk, fontSize: 15, fontWeight: "900" },
  loginLink: { marginTop: spacing.lg, padding: spacing.sm },
  loginCopy: { color: colors.textSecondary, fontSize: 14 },
  loginAccent: { color: colors.accent, fontWeight: "800" },
});
