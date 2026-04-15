import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../../src/context/AuthContext';
import { validateEmail, validatePassword } from '../../src/utils/validation';

export default function Login() {
  const router = useRouter();
  const { signIn, continueInDemoMode } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!validateEmail(email)) return setStatus('Please enter a valid email.');
    if (!validatePassword(password)) {
      return setStatus('Password must be at least 6 characters.');
    }

    try {
      setLoading(true);
      setStatus('Logging in...');
      await signIn(email.trim(), password);
      setStatus('Login successful!');
      router.replace('/(tabs)/Home');
    } catch (error: any) {
      setStatus(getAuthErrorMessage(error?.code));
    } finally {
      setLoading(false);
    }
  };

  const handleDemo = async () => {
    try {
      setLoading(true);
      setStatus('Starting demo mode...');
      await continueInDemoMode();
      router.replace('/(tabs)/Home');
    } finally {
      setLoading(false);
    }
  };

  const getAuthErrorMessage = (code: string): string => {
    switch (code) {
      case 'auth/invalid-credential':
        return 'Incorrect email or password.';
      default:
        return 'Something went wrong. Please try again.';
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome Back</Text>
      <Text style={styles.subtitle}>
        TapTag runs locally in this demo branch, so testers can try the full
        flow without Firebase setup.
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#aaa"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#aaa"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity
        style={[styles.button, loading && { opacity: 0.6 }]}
        onPress={handleLogin}
        disabled={loading}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Login</Text>}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.demoButton, loading && { opacity: 0.6 }]}
        onPress={handleDemo}
        disabled={loading}
      >
        <Text style={styles.demoButtonText}>Continue in Demo Mode</Text>
      </TouchableOpacity>

      {status ? <Text style={styles.status}>{status}</Text> : null}

      <TouchableOpacity onPress={() => router.push('/(auth)/SignUp')}>
        <Text style={styles.switchText}>Don&apos;t have an account? Sign Up</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    padding: 20,
  },
  title: {
    fontSize: 28,
    color: '#fff',
    fontWeight: '700',
    marginBottom: 10,
  },
  subtitle: {
    color: '#aaa',
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 24,
  },
  input: {
    width: '100%',
    backgroundColor: '#1a1a1a',
    color: '#fff',
    marginBottom: 12,
    padding: 12,
    borderRadius: 8,
  },
  button: {
    backgroundColor: '#0af',
    paddingVertical: 12,
    paddingHorizontal: 50,
    borderRadius: 8,
    marginTop: 10,
    width: '100%',
    alignItems: 'center',
  },
  demoButton: {
    backgroundColor: '#111822',
    borderColor: '#0af',
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 12,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  demoButtonText: { color: '#8ecfff', fontSize: 16, fontWeight: '600' },
  switchText: { color: '#0af', marginTop: 15 },
  status: { color: '#fff', marginTop: 15, textAlign: 'center' },
});
