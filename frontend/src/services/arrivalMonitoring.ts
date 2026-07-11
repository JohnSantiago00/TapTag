import Constants from "expo-constants";
import * as Location from "expo-location";
import type { ArrivalPlace } from "../utils/arrivalDetection";

export const ARRIVAL_GEOFENCING_TASK = "taptag-arrival-geofencing";
export const ARRIVAL_GEOFENCING_ENABLED = false;

type GeofencingTaskData = {
  eventType?: Location.GeofencingEventType;
  region?: Location.LocationRegion;
};

type TaskManagerModule = typeof import("expo-task-manager");

declare const require: (name: string) => unknown;

// expo-task-manager is a native module that may be missing from dev clients
// built before it was added; load it lazily so those builds still boot.
function getTaskManager(): TaskManagerModule | null {
  try {
    return require("expo-task-manager") as TaskManagerModule;
  } catch {
    return null;
  }
}

const startupTaskManager = getTaskManager();

if (
  startupTaskManager &&
  !startupTaskManager.isTaskDefined(ARRIVAL_GEOFENCING_TASK)
) {
  startupTaskManager.defineTask<GeofencingTaskData>(
    ARRIVAL_GEOFENCING_TASK,
    async ({ data, error }) => {
      if (error) {
        console.warn("TapTag geofencing task error:", error);
        return;
      }

      console.log("TapTag geofencing event:", data?.eventType, data?.region);
    }
  );
}

export async function configureArrivalGeofencing(places: ArrivalPlace[]) {
  if (
    !ARRIVAL_GEOFENCING_ENABLED ||
    Constants.appOwnership === "expo" ||
    !getTaskManager()
  ) {
    return false;
  }

  const backgroundPermission =
    await Location.getBackgroundPermissionsAsync().catch(() => null);
  if (backgroundPermission?.status !== "granted") {
    return false;
  }

  const hasStarted = await Location.hasStartedGeofencingAsync(
    ARRIVAL_GEOFENCING_TASK
  ).catch(() => false);
  const regions = places.slice(0, 20).map((place) => ({
    identifier: place.id,
    latitude: place.lat,
    longitude: place.lon,
    radius: place.radiusMeters,
    notifyOnEnter: true,
    notifyOnExit: false,
  }));

  if (!regions.length) {
    if (hasStarted) {
      await Location.stopGeofencingAsync(ARRIVAL_GEOFENCING_TASK);
    }
    return false;
  }

  await Location.startGeofencingAsync(ARRIVAL_GEOFENCING_TASK, regions);
  return true;
}
