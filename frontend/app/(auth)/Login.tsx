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
import { getCenteredScreenContentStyle } from "../../src/styles/layout";
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
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>
            Sign in to your privacy-first wallet intelligence workspace.
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#aaa"
            value={email}
            // Keeping the inputs controlled makes validation/status behavior easy
            // to reason about.
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            returnKeyType="done"
            onSubmitEditing={Keyboard.dismiss}
          />

          <View style={styles.passwordRow}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Password"
              placeholderTextColor="#aaa"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoComplete="password"
              returnKeyType="done"
              onSubmitEditing={() => {
                Keyboard.dismiss();
                handleLogin();
              }}
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowPassword((current) => !current)}
              accessibilityLabel={showPassword ? "Hide password" : "Show password"}
            >
              <Ionicons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={20}
                color="#aaa"
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.button, loading && { opacity: 0.6 }]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Login</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={handleForgotPassword} disabled={loading}>
            <Text style={styles.switchText}>Forgot password?</Text>
          </TouchableOpacity>

          {status ? <Text style={styles.status}>{status}</Text> : null}

          <TouchableOpacity onPress={() => router.push("/(auth)/SignUp")}>
            <Text style={styles.switchText}>
              Don&apos;t have an account? Sign Up
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: "#000",
  },
  title: {
    fontSize: 28,
    color: "#fff",
    fontWeight: "700",
    marginBottom: 10,
  },
  subtitle: {
    color: "#aaa",
    fontSize: 15,
    lineHeight: 21,
    textAlign: "center",
    marginBottom: 24,
  },
  input: {
    width: "100%",
    backgroundColor: "#1a1a1a",
    color: "#fff",
    marginBottom: 12,
    padding: 12,
    borderRadius: 8,
  },
  passwordRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a1a1a",
    borderRadius: 8,
    marginBottom: 12,
  },
  passwordInput: {
    flex: 1,
    color: "#fff",
    padding: 12,
  },
  eyeButton: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  button: {
    backgroundColor: "#0af",
    paddingVertical: 12,
    paddingHorizontal: 50,
    borderRadius: 8,
    marginTop: 10,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  switchText: { color: "#0af", marginTop: 15 },
  status: { color: "#fff", marginTop: 15, textAlign: "center" },
});
