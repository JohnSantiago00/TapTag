import AsyncStorage from '@react-native-async-storage/async-storage';

const DEMO_PREFIX = 'taptag.demo.';

export async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export async function writeJson<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function removeKey(key: string): Promise<void> {
  await AsyncStorage.removeItem(key);
}

export async function clearDemoStorageForUser(uid: string): Promise<void> {
  const keys = [
    `${DEMO_PREFIX}wallet.${uid}`,
    `${DEMO_PREFIX}profile.${uid}`,
    `${DEMO_PREFIX}events.${uid}`,
  ];

  await AsyncStorage.multiRemove(keys);
}

export async function clearAllDemoStorage(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const demoKeys = keys.filter((key) => key.startsWith(DEMO_PREFIX));

  if (demoKeys.length) {
    await AsyncStorage.multiRemove(demoKeys);
  }
}
