import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import 'react-native-reanimated';
import { useAuthRedirect } from '../hooks/useAuthRedirect';
import { AuthProvider, useAuth } from '../src/context/AuthContext';

/*
  File role:
  Root app shell for Expo Router.

  In this demo branch, the global concerns are simpler:
  - provide local auth context
  - prevent route rendering until demo auth state is restored
*/

function RootNavigator() {
  const { loading } = useAuth();
  useAuthRedirect();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color="#0af" />
        <StatusBar style="auto" />
      </View>
    );
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar style="auto" />
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
