export type WearableDeviceId = 'pixel_watch' | 'apple_watch' | 'oura_ring' | 'garmin_venu';
export type SyncFrequency = 'realtime' | '30m' | 'hourly' | 'manual';
export type HapticStrength = 'gentle' | 'balanced' | 'off';
export type WatchShortcutId =
  | 'quadrant_checkin'
  | 'panic_anchor'
  | 'calm_reset'
  | 'latest_mood';

export interface WearableSensors {
  heartRateHrv: boolean;
  sleep: boolean;
  steps: boolean;
}

export interface WearableDeviceInfo {
  id: WearableDeviceId;
  name: string;
  companionApp: string;
  companionVersion: string;
  bridge: string;
  batteryPercent: number;
  formFactor: 'watch' | 'ring';
}

export interface WearableSettingsState {
  pairedDeviceId: WearableDeviceId | null;
  lastPairedDeviceId: WearableDeviceId;
  syncFrequency: SyncFrequency;
  sensors: WearableSensors;
  lowBatterySyncPause: boolean;
  breathingHaptics: boolean;
  hapticStrength: HapticStrength;
  burnoutWristAlerts: boolean;
  mirrorPhoneDnd: boolean;
  watchShortcut: WatchShortcutId;
  discreetWristDisplay: boolean;
  phoneHandoff: boolean;
}

export const WEARABLES_STORAGE_KEY = 'wellbe_wearables_v1';

export const WEARABLE_DEVICES: WearableDeviceInfo[] = [
  {
    id: 'pixel_watch',
    name: 'Pixel Watch',
    companionApp: 'Wear OS Companion',
    companionVersion: 'v2.4.1',
    bridge: 'Health Connect',
    batteryPercent: 84,
    formFactor: 'watch',
  },
  {
    id: 'apple_watch',
    name: 'Apple Watch',
    companionApp: 'watchOS Companion',
    companionVersion: 'v2.4.1',
    bridge: 'Apple Health',
    batteryPercent: 78,
    formFactor: 'watch',
  },
  {
    id: 'oura_ring',
    name: 'Oura Ring',
    companionApp: 'Oura Companion',
    companionVersion: 'v2.4.1',
    bridge: 'Health Connect',
    batteryPercent: 91,
    formFactor: 'ring',
  },
  {
    id: 'garmin_venu',
    name: 'Garmin Venu',
    companionApp: 'Garmin Connect Bridge',
    companionVersion: 'v2.4.1',
    bridge: 'Health Connect',
    batteryPercent: 88,
    formFactor: 'watch',
  },
];

export const SYNC_FREQUENCY_LABELS: Record<SyncFrequency, string> = {
  realtime: 'Real-time',
  '30m': '30m',
  hourly: 'Hourly',
  manual: 'Manual',
};

export const SYNC_FREQUENCY_CADENCE_TEXT: Record<SyncFrequency, string> = {
  realtime: 'Real-time sync',
  '30m': 'Every 30m',
  hourly: 'Hourly sync',
  manual: 'Manual sync only',
};

export const DEFAULT_WEARABLES_STATE: WearableSettingsState = {
  pairedDeviceId: 'pixel_watch',
  lastPairedDeviceId: 'pixel_watch',
  syncFrequency: 'realtime',
  sensors: {
    heartRateHrv: true,
    sleep: true,
    steps: true,
  },
  lowBatterySyncPause: true,
  breathingHaptics: true,
  hapticStrength: 'balanced',
  burnoutWristAlerts: true,
  mirrorPhoneDnd: true,
  watchShortcut: 'quadrant_checkin',
  discreetWristDisplay: false,
  phoneHandoff: true,
};

const VALID_DEVICES = new Set<WearableDeviceId>([
  'pixel_watch',
  'apple_watch',
  'oura_ring',
  'garmin_venu',
]);
const VALID_FREQ = new Set<SyncFrequency>(['realtime', '30m', 'hourly', 'manual']);
const VALID_HAPTIC = new Set<HapticStrength>(['gentle', 'balanced', 'off']);
const VALID_SHORTCUT = new Set<WatchShortcutId>([
  'quadrant_checkin',
  'panic_anchor',
  'calm_reset',
  'latest_mood',
]);

export function getWearableDeviceInfo(
  id: WearableDeviceId | null | undefined
): WearableDeviceInfo | null {
  if (!id) return null;
  return WEARABLE_DEVICES.find((d) => d.id === id) ?? null;
}

export function sanitizeWearablesState(raw: unknown): WearableSettingsState {
  if (!raw || typeof raw !== 'object') {
    return {
      ...DEFAULT_WEARABLES_STATE,
      sensors: { ...DEFAULT_WEARABLES_STATE.sensors },
    };
  }
  const r = raw as Record<string, unknown>;
  const rawSensors =
    r.sensors && typeof r.sensors === 'object'
      ? (r.sensors as Record<string, unknown>)
      : {};

  const pairedDeviceId: WearableDeviceId | null =
    r.pairedDeviceId === null
      ? null
      : typeof r.pairedDeviceId === 'string' &&
          VALID_DEVICES.has(r.pairedDeviceId as WearableDeviceId)
        ? (r.pairedDeviceId as WearableDeviceId)
        : DEFAULT_WEARABLES_STATE.pairedDeviceId;

  const lastPairedDeviceId: WearableDeviceId =
    typeof r.lastPairedDeviceId === 'string' &&
    VALID_DEVICES.has(r.lastPairedDeviceId as WearableDeviceId)
      ? (r.lastPairedDeviceId as WearableDeviceId)
      : pairedDeviceId ?? DEFAULT_WEARABLES_STATE.lastPairedDeviceId;

  const syncFrequency: SyncFrequency =
    typeof r.syncFrequency === 'string' && VALID_FREQ.has(r.syncFrequency as SyncFrequency)
      ? (r.syncFrequency as SyncFrequency)
      : DEFAULT_WEARABLES_STATE.syncFrequency;

  const hapticStrength: HapticStrength =
    typeof r.hapticStrength === 'string' && VALID_HAPTIC.has(r.hapticStrength as HapticStrength)
      ? (r.hapticStrength as HapticStrength)
      : DEFAULT_WEARABLES_STATE.hapticStrength;

  const watchShortcut: WatchShortcutId =
    typeof r.watchShortcut === 'string' && VALID_SHORTCUT.has(r.watchShortcut as WatchShortcutId)
      ? (r.watchShortcut as WatchShortcutId)
      : DEFAULT_WEARABLES_STATE.watchShortcut;

  return {
    pairedDeviceId,
    lastPairedDeviceId,
    syncFrequency,
    sensors: {
      heartRateHrv:
        typeof rawSensors.heartRateHrv === 'boolean'
          ? rawSensors.heartRateHrv
          : DEFAULT_WEARABLES_STATE.sensors.heartRateHrv,
      sleep:
        typeof rawSensors.sleep === 'boolean'
          ? rawSensors.sleep
          : DEFAULT_WEARABLES_STATE.sensors.sleep,
      steps:
        typeof rawSensors.steps === 'boolean'
          ? rawSensors.steps
          : DEFAULT_WEARABLES_STATE.sensors.steps,
    },
    lowBatterySyncPause:
      typeof r.lowBatterySyncPause === 'boolean'
        ? r.lowBatterySyncPause
        : DEFAULT_WEARABLES_STATE.lowBatterySyncPause,
    breathingHaptics:
      typeof r.breathingHaptics === 'boolean'
        ? r.breathingHaptics
        : DEFAULT_WEARABLES_STATE.breathingHaptics,
    hapticStrength,
    burnoutWristAlerts:
      typeof r.burnoutWristAlerts === 'boolean'
        ? r.burnoutWristAlerts
        : DEFAULT_WEARABLES_STATE.burnoutWristAlerts,
    mirrorPhoneDnd:
      typeof r.mirrorPhoneDnd === 'boolean'
        ? r.mirrorPhoneDnd
        : DEFAULT_WEARABLES_STATE.mirrorPhoneDnd,
    watchShortcut,
    discreetWristDisplay:
      typeof r.discreetWristDisplay === 'boolean'
        ? r.discreetWristDisplay
        : DEFAULT_WEARABLES_STATE.discreetWristDisplay,
    phoneHandoff:
      typeof r.phoneHandoff === 'boolean'
        ? r.phoneHandoff
        : DEFAULT_WEARABLES_STATE.phoneHandoff,
  };
}

export function readWearablesState(): WearableSettingsState {
  if (typeof window === 'undefined') {
    return sanitizeWearablesState(null);
  }
  try {
    const raw = window.localStorage.getItem(WEARABLES_STORAGE_KEY);
    if (!raw) return sanitizeWearablesState(null);
    return sanitizeWearablesState(JSON.parse(raw));
  } catch {
    return sanitizeWearablesState(null);
  }
}

export function writeWearablesState(state: WearableSettingsState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(WEARABLES_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota or private browsing errors gracefully
  }
}
