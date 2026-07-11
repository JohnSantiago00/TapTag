import { useEffect, useState } from "react";
import {
  InputAccessoryView,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export const NUMERIC_INPUT_ACCESSORY_ID = "taptag-numeric-input-accessory";

export function dismissKeyboard() {
  Keyboard.dismiss();
}

export function useKeyboardVisible() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvent, () => setVisible(true));
    const hide = Keyboard.addListener(hideEvent, () => setVisible(false));

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return visible;
}

// InputAccessoryView does not render on every runtime (observed missing in
// Expo Go on the new architecture), so numeric fields also get this inline
// "Done" next to their label. It only appears while the keyboard is open.
export function KeyboardDoneInline() {
  const visible = useKeyboardVisible();

  if (!visible) return null;

  return (
    <TouchableOpacity
      style={styles.inlineButton}
      onPress={dismissKeyboard}
      accessibilityRole="button"
      accessibilityLabel="Done editing"
    >
      <Text style={styles.buttonText}>Done</Text>
    </TouchableOpacity>
  );
}

export function KeyboardDoneBar({
  nativeID = NUMERIC_INPUT_ACCESSORY_ID,
}: {
  nativeID?: string;
}) {
  if (Platform.OS !== "ios") return null;

  return (
    <InputAccessoryView nativeID={nativeID}>
      <View style={styles.bar}>
        <TouchableOpacity
          style={styles.button}
          onPress={dismissKeyboard}
          accessibilityRole="button"
          accessibilityLabel="Done editing"
        >
          <Text style={styles.buttonText}>Done</Text>
        </TouchableOpacity>
      </View>
    </InputAccessoryView>
  );
}

const styles = StyleSheet.create({
  bar: {
    alignItems: "flex-end",
    backgroundColor: "#111",
    borderTopColor: "#2a2a2a",
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  button: {
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  buttonText: {
    color: "#0af",
    fontSize: 16,
    fontWeight: "700",
  },
  inlineButton: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
});
