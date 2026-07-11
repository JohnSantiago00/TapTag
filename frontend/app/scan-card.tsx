import { Ionicons } from "@expo/vector-icons";
import type { CameraView as CameraViewRef } from "expo-camera";
import { deleteAsync } from "expo-file-system/legacy";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  isCardScanAvailable,
  recognizeCardFromImage,
} from "@/src/utils/cardScan";

type ExpoCameraModule = typeof import("expo-camera");

declare const require: (name: string) => unknown;

// expo-camera is a native module that may be missing from dev clients built
// before it was added; load it lazily so navigating here never crashes them.
function getExpoCamera(): ExpoCameraModule | null {
  try {
    return require("expo-camera") as ExpoCameraModule;
  } catch {
    return null;
  }
}

const expoCamera = getExpoCamera();

export default function ScanCard() {
  const router = useRouter();
  const scanAvailable = expoCamera !== null && isCardScanAvailable();

  if (!scanAvailable || !expoCamera) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <View style={styles.centered}>
          <Ionicons name="camera-outline" size={30} color="#8ecfff" />
          <Text style={styles.title}>Scan unavailable</Text>
          <Text style={styles.bodyText}>
            Rebuild the dev client after installing the camera and OCR modules.
          </Text>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => router.back()}>
            <Text style={styles.secondaryButtonText}>Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return <ScanCardCamera camera={expoCamera} />;
}

function ScanCardCamera({ camera }: { camera: ExpoCameraModule }) {
  const { CameraView, useCameraPermissions } = camera;
  const router = useRouter();
  const cameraRef = useRef<CameraViewRef>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [ready, setReady] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function handleCapture() {
    if (!cameraRef.current || scanning) return;

    let photoUri: string | null = null;

    try {
      setScanning(true);
      setStatus("Scanning on device...");
      const photo = await cameraRef.current.takePictureAsync({
        base64: false,
        exif: false,
        quality: 0.75,
      });
      photoUri = photo?.uri ?? null;
      const scanned = photoUri ? await recognizeCardFromImage(photoUri) : null;

      if (!scanned) {
        setStatus("Could not find a valid card number. Try again with better light.");
        return;
      }

      router.replace({
        pathname: "/add-card" as never,
        params: {
          scanLast4: scanned.last4,
          scanNetwork: scanned.network,
          scanIssuer: scanned.issuer ?? "",
          scanName: scanned.cardholderName ?? "",
        },
      });
    } catch (error) {
      console.error("Error scanning card:", error);
      setStatus("Card scanning is unavailable in this build.");
    } finally {
      // The capture is a photo of the user's physical card; never leave it in
      // the app cache after the on-device scan has extracted what it needs.
      if (photoUri) {
        deleteAsync(photoUri, { idempotent: true }).catch(() => {});
      }
      setScanning(false);
    }
  }

  if (!permission) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <View style={styles.centered}>
          <ActivityIndicator color="#0af" />
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <View style={styles.centered}>
          <Ionicons name="shield-checkmark-outline" size={30} color="#8ecfff" />
          <Text style={styles.title}>Camera permission</Text>
          <Text style={styles.bodyText}>
            Camera access lets TapTag scan on-device and keep only the network and
            last 4 digits.
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={requestPermission}>
            <Text style={styles.primaryButtonText}>Allow Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => router.back()}>
            <Text style={styles.secondaryButtonText}>Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.cameraContainer}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        onCameraReady={() => setReady(true)}
      />
      <SafeAreaView style={styles.overlay} edges={["top", "bottom"]}>
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => router.back()}
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.overlayTitle}>Scan card</Text>
        </View>

        <View style={styles.guideBox}>
          <View style={styles.guideLine} />
        </View>

        <View style={styles.bottomPanel}>
          <Text style={styles.bodyText}>
            Full card numbers stay on-device and are discarded after TapTag derives
            the network and last 4.
          </Text>
          {status ? <Text style={styles.statusText}>{status}</Text> : null}
          <TouchableOpacity
            style={[
              styles.captureButton,
              (!ready || scanning) && styles.captureButtonDisabled,
            ]}
            onPress={handleCapture}
            disabled={!ready || scanning}
          >
            {scanning ? (
              <ActivityIndicator color="#00131f" />
            ) : (
              <Ionicons name="scan-outline" size={24} color="#00131f" />
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  centered: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  title: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "800",
    marginTop: 12,
  },
  bodyText: {
    color: "#ddd",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#0af",
    borderRadius: 10,
    marginTop: 18,
    paddingHorizontal: 22,
    paddingVertical: 13,
  },
  primaryButtonText: {
    color: "#00131f",
    fontSize: 15,
    fontWeight: "800",
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: "#151515",
    borderColor: "#333",
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 12,
    paddingHorizontal: 22,
    paddingVertical: 13,
  },
  secondaryButtonText: {
    color: "#ddd",
    fontSize: 15,
    fontWeight: "700",
  },
  overlay: {
    flex: 1,
    justifyContent: "space-between",
    padding: 20,
  },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  iconButton: {
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    borderColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 8,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  overlayTitle: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "800",
  },
  guideBox: {
    alignSelf: "center",
    borderColor: "rgba(255, 255, 255, 0.8)",
    borderRadius: 16,
    borderWidth: 2,
    height: 210,
    justifyContent: "center",
    maxWidth: 360,
    width: "100%",
  },
  guideLine: {
    alignSelf: "center",
    backgroundColor: "rgba(255, 255, 255, 0.65)",
    height: 1,
    width: "78%",
  },
  bottomPanel: {
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.72)",
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  statusText: {
    color: "#8ecfff",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
    textAlign: "center",
  },
  captureButton: {
    alignItems: "center",
    backgroundColor: "#0af",
    borderRadius: 34,
    height: 68,
    justifyContent: "center",
    marginTop: 16,
    width: 68,
  },
  captureButtonDisabled: {
    opacity: 0.55,
  },
});
