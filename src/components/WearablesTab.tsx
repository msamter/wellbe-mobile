import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  BatteryCharging,
  BellOff,
  Check,
  CircleDot,
  EyeOff,
  Footprints,
  HeartPulse,
  Moon,
  Plus,
  RefreshCw,
  Unlink,
  Vibrate,
  Watch,
} from 'lucide-react';
import { AppSettings, DailyBiometrics } from '../types/wellbe';
import { useAccessibility } from '../context/AccessibilityContext';
import {
  HapticStrength,
  WEARABLE_DEVICES,
  WearableDeviceInfo,
  WearableSettingsState,
  getWearableDeviceInfo,
} from '../utils/wearablesStorage';
import { BentoSummaryPill, SettingsBentoAccordion } from './SettingsBentoAccordion';

export interface WearablesTabProps {
  openSectionId: string | null;
  onToggleSection: (id: string) => void;
  onOpenSection?: (id: string) => void;
  settings: AppSettings;
  todayBio: DailyBiometrics | undefined;
  wearables: WearableSettingsState;
  onUpdateWearables: (
    updater:
      | Partial<WearableSettingsState>
      | ((prev: WearableSettingsState) => WearableSettingsState)
  ) => void;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
  onSyncWatch: () => void;
  onSimulateWatchCheckIn?: (emotionId: string, note: string) => void;
  onSimulateStressSpike?: () => void;
  onOpenPhoneHandoff?: () => void;
  onAnnounce: (msg: string) => void;
  onNotify?: (title: string, subtitle?: string) => void;
}

type WearableSectionKey = 'sync' | 'haptics' | 'continuity' | 'device';

const DEVICE_JUMP_LINKS: Array<{
  id: WearableSectionKey;
  label: string;
  ariaLabel: string;
}> = [
  { id: 'sync', label: 'Sync', ariaLabel: 'Jump to Sync & Biometric Permissions' },
  { id: 'haptics', label: 'Haptics', ariaLabel: 'Jump to Wrist Haptics & Alerts' },
  {
    id: 'continuity',
    label: 'Watch Face',
    ariaLabel: 'Jump to Watch Face & Quick-Launch Continuity',
  },
  { id: 'device', label: 'Device', ariaLabel: 'Jump to Device Management' },
];

const HAPTIC_STRENGTH_OPTIONS: Array<{ id: HapticStrength; label: string }> = [
  { id: 'gentle', label: 'Gentle' },
  { id: 'balanced', label: 'Balanced' },
  { id: 'off', label: 'Off' },
];

function renderDeviceGlyph(device: WearableDeviceInfo | null, className = 'h-6 w-6') {
  if (!device) return <Watch className={className} />;
  if (device.formFactor === 'ring') return <CircleDot className={className} />;
  if (device.id === 'garmin_venu') return <Activity className={className} />;
  return <Watch className={className} />;
}

export const WearablesTab: React.FC<WearablesTabProps> = ({
  openSectionId,
  onToggleSection,
  onOpenSection,
  settings,
  todayBio,
  wearables,
  onUpdateWearables,
  onUpdateSettings,
  onSyncWatch,
  onAnnounce,
  onNotify,
}) => {
  const a11y = useAccessibility();

  const [syncingWatch, setSyncingWatch] = useState(false);
  const [watchActionFeedback, setWatchActionFeedback] = useState('');

  // Device Management drawers
  const [pairDrawerOpen, setPairDrawerOpen] = useState(false);
  const [unpairConfirmOpen, setUnpairConfirmOpen] = useState(false);

  const isSectionExpanded = (key: WearableSectionKey) => openSectionId === key;

  const pairedDevice = getWearableDeviceInfo(wearables.pairedDeviceId);
  const lastDevice =
    getWearableDeviceInfo(wearables.lastPairedDeviceId) ?? WEARABLE_DEVICES[0];

  const parsedLastSync = new Date(settings.watchLastSync);
  const lastSyncFormatted = Number.isNaN(parsedLastSync.getTime())
    ? 'Just now'
    : parsedLastSync.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      });

  const emitStatus = (msg: string, toastTitle?: string, toastSub?: string) => {
    onAnnounce(msg);
    if (toastTitle && onNotify) {
      onNotify(toastTitle, toastSub);
    }
  };

  const syncTimerRef = useRef<number | null>(null);
  const jumpTimerRef = useRef<number | null>(null);
  const sectionRefs = useRef<Partial<Record<WearableSectionKey, HTMLElement | null>>>({});

  useEffect(() => {
    return () => {
      if (syncTimerRef.current !== null) {
        window.clearTimeout(syncTimerRef.current);
      }
      if (jumpTimerRef.current !== null) {
        window.clearTimeout(jumpTimerRef.current);
      }
    };
  }, []);

  const handleJumpToSection = (key: WearableSectionKey, label: string) => {
    if (onOpenSection) {
      onOpenSection(key);
    } else if (!isSectionExpanded(key)) {
      onToggleSection(key);
    }
    const reduced =
      a11y.reduceMotion ||
      (typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    if (jumpTimerRef.current !== null) {
      window.clearTimeout(jumpTimerRef.current);
    }
    jumpTimerRef.current = window.setTimeout(
      () => {
        jumpTimerRef.current = null;
        sectionRefs.current[key]?.scrollIntoView({
          behavior: reduced ? 'auto' : 'smooth',
          block: 'start',
        });
      },
      reduced ? 0 : 45
    );
    onAnnounce(`Jumped to ${label} settings.`);
  };

  const handleWatchSyncClick = () => {
    if (!pairedDevice || syncingWatch) return;
    setSyncingWatch(true);
    setWatchActionFeedback('');
    if (syncTimerRef.current !== null) window.clearTimeout(syncTimerRef.current);
    syncTimerRef.current = window.setTimeout(() => {
      syncTimerRef.current = null;
      onSyncWatch();
      setSyncingWatch(false);
      setWatchActionFeedback(
        `${pairedDevice.name} biometrics synced across Today, Trends & Coach.`
      );
      onAnnounce(`${pairedDevice.name} biometrics synced.`);
    }, 380);
  };

  const handleSelectDevice = (device: WearableDeviceInfo) => {
    onUpdateWearables((prev) => ({
      ...prev,
      pairedDeviceId: device.id,
      lastPairedDeviceId: device.id,
    }));
    onUpdateSettings({ watchConnected: true, watchLastSync: new Date().toISOString() });
    setPairDrawerOpen(false);
    setUnpairConfirmOpen(false);
    emitStatus(
      `Paired ${device.name} via ${device.bridge}.`,
      `${device.name} paired`,
      `${device.companionApp} ${device.companionVersion}`
    );
  };

  const handleConfirmUnpair = () => {
    const prevName = pairedDevice?.name ?? lastDevice.name;
    onUpdateWearables((prev) => ({
      ...prev,
      pairedDeviceId: null,
      lastPairedDeviceId: prev.pairedDeviceId ?? prev.lastPairedDeviceId,
    }));
    onUpdateSettings({ watchConnected: false });
    setUnpairConfirmOpen(false);
    setPairDrawerOpen(false);
    emitStatus(
      `${prevName} unpaired. Historical mood and biometric data remain preserved.`,
      `${prevName} unpaired`,
      'Historical logs remain untouched'
    );
  };

  const handleReconnectLastDevice = () => {
    onUpdateWearables((prev) => ({
      ...prev,
      pairedDeviceId: lastDevice.id,
      lastPairedDeviceId: lastDevice.id,
    }));
    onUpdateSettings({ watchConnected: true, watchLastSync: new Date().toISOString() });
    emitStatus(
      `Reconnected ${lastDevice.name}.`,
      `${lastDevice.name} reconnected`,
      'Live biometric sync resumed'
    );
  };

  const renderSwitchRow = (
    id: string,
    checked: boolean,
    onToggle: () => void,
    title: string,
    description: string,
    statusBadge?: React.ReactNode
  ) => (
    <div className="wb-pane-toggle-row py-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <p id={`${id}-label`} className="text-sm font-semibold leading-snug text-[var(--ink-primary)]">
            {title}
          </p>
          {statusBadge}
        </div>
        <p
          id={`${id}-desc`}
          className="wb-prose mt-0.5 text-xs leading-relaxed text-[var(--ink-muted)]"
        >
          {description}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        data-no-drag-scroll="true"
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-desc`}
        aria-checked={checked}
        onClick={onToggle}
        className="wb-pane-toggle-switch"
      >
        <span
          className="min-w-[1.75rem] text-right font-mono-tabular text-xs font-semibold"
          style={{
            color: checked ? 'var(--brand-accent-text)' : 'var(--ink-muted)',
          }}
        >
          {checked ? 'On' : 'Off'}
        </span>
        <span
          className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors"
          style={{
            backgroundColor: checked ? 'var(--brand-action-bg)' : 'var(--border-strong)',
          }}
        >
          <span
            className="inline-block h-4 w-4 rounded-full transition-transform duration-150"
            style={{
              backgroundColor: checked ? 'var(--brand-action-fg)' : 'var(--switch-thumb)',
              transform: checked ? 'translateX(24px)' : 'translateX(4px)',
            }}
          />
        </span>
      </button>
    </div>
  );

  const activeSensorsCount = [
    wearables.sensors.heartRateHrv,
    wearables.sensors.sleep,
    wearables.sensors.steps,
  ].filter(Boolean).length;

  const hapticLabel =
    HAPTIC_STRENGTH_OPTIONS.find((h) => h.id === wearables.hapticStrength)?.label ?? 'Gentle';

  const syncPills: BentoSummaryPill[] = [
    {
      label: settings.watchConnected ? 'Sync On' : 'Sync Paused',
      tone: settings.watchConnected ? 'accent' : 'neutral',
    },
    {
      label: `${activeSensorsCount}/3 Sensors Active`,
      tone: activeSensorsCount > 0 ? 'positive' : 'warn',
    },
  ];

  const hapticsPills: BentoSummaryPill[] = [
    a11y.quietCues
      ? { label: 'Muted by Quiet Cues', tone: 'warn' }
      : {
          label: `Haptics: ${hapticLabel}`,
          tone: wearables.hapticStrength === 'off' ? 'neutral' : 'accent',
        },
    {
      label: wearables.burnoutWristAlerts ? 'Alerts On' : 'Alerts Off',
      tone: wearables.burnoutWristAlerts ? 'positive' : 'neutral',
    },
  ];

  const continuityPills: BentoSummaryPill[] = [
    {
      label: wearables.discreetWristDisplay ? 'Discreet On' : 'Discreet Off',
      tone: wearables.discreetWristDisplay ? 'positive' : 'neutral',
    },
    {
      label: wearables.phoneHandoff ? 'Handoff On' : 'Handoff Off',
      tone: wearables.phoneHandoff ? 'accent' : 'neutral',
    },
  ];

  const devicePills: BentoSummaryPill[] = [
    {
      label: pairedDevice ? pairedDevice.name : 'Unpaired',
      tone: pairedDevice ? 'positive' : 'warn',
    },
    { label: (pairedDevice ?? lastDevice).companionVersion, tone: 'neutral' },
  ];

  return (
    <div
      id="settings-panel-wearables"
      role="tabpanel"
      aria-labelledby="settings-tab-wearables"
      className="wb-calm-stack space-y-4 pb-4"
    >
      {/* Unified Settings Section Header + Quick Section Jump Bar */}
      <div className="space-y-3">
        <div className="border-b border-[var(--border-hairline)] pb-3">
          <h2 className="text-base font-semibold tracking-tight text-[var(--ink-primary)]">
            Devices
          </h2>
          <p className="wb-prose mt-0.5 text-xs text-[var(--ink-muted)]">
            Cross-device sync, wrist cues &amp; privacy continuity
          </p>
        </div>

        <nav
          aria-label="Jump to Devices section"
          className="wb-pane-seg-4 gap-1.5"
        >
          {DEVICE_JUMP_LINKS.map((item) => {
            const expanded = isSectionExpanded(item.id);
            return (
              <button
                key={item.id}
                type="button"
                data-no-drag-scroll="true"
                aria-label={item.ariaLabel}
                aria-controls={`bento-panel-wearables-${item.id}`}
                onClick={() => handleJumpToSection(item.id, item.label)}
                className="inline-flex min-h-[44px] min-w-0 items-center justify-center truncate rounded-xl border px-2 text-xs font-semibold transition-colors hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--focus-ring)]"
                style={
                  expanded
                    ? {
                        backgroundColor: 'var(--brand-accent-soft)',
                        borderColor: 'var(--brand-accent-border)',
                        color: 'var(--brand-accent-text)',
                      }
                    : {
                        backgroundColor: 'var(--surface-subtle)',
                        borderColor: 'var(--border-hairline)',
                        color: 'var(--ink-secondary)',
                      }
                }
              >
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ====================================================================
          TOP TELEMETRY CARD (Pixel Watch / Paired Wearable OR Unpaired State)
          ==================================================================== */}
      {pairedDevice ? (
        <section className="space-y-4 rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] p-4">
          <div className="wb-pane-header-row">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <span
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
                style={{
                  backgroundColor: 'var(--bio-mint-soft)',
                  color: 'var(--bio-mint)',
                }}
              >
                {renderDeviceGlyph(pairedDevice, 'h-6 w-6')}
              </span>
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-semibold leading-snug text-[var(--ink-primary)]">
                  {pairedDevice.name}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-[var(--ink-muted)] tabular-nums">
                  {settings.watchConnected ? 'Connected' : 'Paused'} · Synced {lastSyncFormatted}
                </p>
              </div>
            </div>

            <div className="wb-pane-item-actions">
              <button
                type="button"
                role="switch"
                data-no-drag-scroll="true"
                aria-checked={settings.watchConnected}
                aria-label={`Toggle ${pairedDevice.name} live sensor sync`}
                onClick={() => {
                  const next = !settings.watchConnected;
                  onUpdateSettings({ watchConnected: next });
                  onAnnounce(
                    next
                      ? `${pairedDevice.name} biometric sync enabled.`
                      : `${pairedDevice.name} biometric sync paused.`
                  );
                }}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] px-3.5 text-xs font-semibold text-[var(--ink-primary)] hover:bg-[var(--surface-hover)]"
              >
                <BatteryCharging className="h-4 w-4 shrink-0 text-[var(--bio-mint)]" />
                <span>{settings.watchConnected ? 'Sync Connected' : 'Sync Paused'}</span>
              </button>
            </div>
          </div>

          {/* Compact 2-Up Mobile / 4-Up Desktop Biometric Mini-Tiles */}
          {todayBio && (
            <div className="wb-pane-mini-2">
              <div
                className={`min-w-0 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-3 transition-opacity ${
                  wearables.sensors.heartRateHrv ? '' : 'opacity-60'
                }`}
              >
                <div className="flex items-center gap-1.5 text-[11px] text-[var(--ink-muted)]">
                  <HeartPulse className="h-3.5 w-3.5 shrink-0 text-[var(--bio-mint)]" />
                  <span className="truncate">
                    {a11y.plainLanguage ? 'Heart Rate' : 'Live RHR'}
                  </span>
                </div>
                <p className="mt-1 font-mono-tabular text-sm font-bold text-[var(--ink-primary)]">
                  {wearables.sensors.heartRateHrv ? `${todayBio.restingHr} bpm` : 'Paused'}
                </p>
              </div>

              <div className="min-w-0 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-3">
                <div className="flex items-center gap-1.5 text-[11px] text-[var(--ink-muted)]">
                  <BatteryCharging className="h-3.5 w-3.5 shrink-0 text-[var(--bio-mint)]" />
                  <span className="truncate">Battery</span>
                </div>
                <p className="mt-1 font-mono-tabular text-sm font-bold text-[var(--ink-primary)]">
                  {pairedDevice.batteryPercent}%
                </p>
              </div>

              <div
                className={`min-w-0 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-3 transition-opacity ${
                  wearables.sensors.heartRateHrv ? '' : 'opacity-60'
                }`}
              >
                <div className="flex items-center gap-1.5 text-[11px] text-[var(--ink-muted)]">
                  <Activity className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">
                    {a11y.plainLanguage ? 'Heart Rhythm' : 'Est. HRV'}
                  </span>
                </div>
                <p className="mt-1 font-mono-tabular text-sm font-bold text-[var(--ink-primary)]">
                  {wearables.sensors.heartRateHrv ? `${todayBio.hrvMs} ms` : 'Paused'}
                </p>
              </div>

              <div
                className={`min-w-0 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-3 transition-opacity ${
                  wearables.sensors.sleep ? '' : 'opacity-60'
                }`}
              >
                <div className="flex items-center gap-1.5 text-[11px] text-[var(--ink-muted)]">
                  <Moon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">Sleep</span>
                </div>
                <p className="mt-1 font-mono-tabular text-sm font-bold text-[var(--ink-primary)]">
                  {wearables.sensors.sleep
                    ? `${todayBio.sleepHours.toFixed(1)}h · Q${todayBio.sleepQuality}`
                    : 'Paused'}
                </p>
              </div>
            </div>
          )}

          {todayBio && (
            <div
              className={`flex items-center justify-between gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] px-3.5 py-2.5 text-xs transition-opacity ${
                wearables.sensors.steps ? '' : 'opacity-60'
              }`}
            >
              <span className="inline-flex items-center gap-1.5 text-[var(--ink-muted)]">
                <Footprints className="h-3.5 w-3.5 shrink-0" />
                <span>Daily Steps</span>
              </span>
              <span className="font-mono-tabular font-bold text-[var(--ink-primary)]">
                {wearables.sensors.steps ? todayBio.steps.toLocaleString() : 'Paused'}
              </span>
            </div>
          )}

          <button
            type="button"
            data-no-drag-scroll="true"
            onClick={handleWatchSyncClick}
            disabled={syncingWatch || !settings.watchConnected}
            className="inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl px-3 text-xs font-semibold transition-opacity disabled:opacity-45"
            style={{
              backgroundColor: 'var(--brand-action-bg)',
              color: 'var(--brand-action-fg)',
            }}
          >
            <RefreshCw className={`h-4 w-4 shrink-0 ${syncingWatch ? 'animate-spin' : ''}`} />
            <span>
              {syncingWatch ? `Syncing ${pairedDevice.name}…` : 'Sync Biometrics Now'}
            </span>
          </button>
        </section>
      ) : (
        <section className="space-y-4 rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-subtle)] p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-card)] text-[var(--ink-muted)]">
              <Watch className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[var(--ink-primary)]">
                Disconnected · No Wearable Paired
              </p>
              <p className="wb-prose mt-0.5 text-xs leading-relaxed text-[var(--ink-muted)]">
                Background sensor streaming is paused. Your historical mood entries and biometric
                trends remain safely stored on this device.
              </p>
            </div>
          </div>

          <div className="wb-pane-item-actions">
            <button
              type="button"
              data-no-drag-scroll="true"
              onClick={handleReconnectLastDevice}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-4 py-2 text-center text-xs font-semibold leading-snug"
              style={{
                backgroundColor: 'var(--brand-action-bg)',
                color: 'var(--brand-action-fg)',
              }}
            >
              <RefreshCw className="h-4 w-4 shrink-0" />
              <span>Reconnect {lastDevice.name}</span>
            </button>
            <button
              type="button"
              data-no-drag-scroll="true"
              onClick={() => {
                handleJumpToSection('device', 'Device');
                setPairDrawerOpen(true);
              }}
              className="inline-flex min-h-[44px] items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] px-3.5 text-xs font-semibold text-[var(--ink-primary)] hover:bg-[var(--surface-hover)]"
            >
              <Plus className="h-4 w-4 shrink-0" />
              <span>Pair Wearable</span>
            </button>
          </div>
        </section>
      )}

      {watchActionFeedback && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-start gap-2 rounded-xl border border-[var(--q-green-border)] bg-[var(--q-green-bg)] px-3.5 py-2.5 text-xs font-semibold text-[var(--q-green-fg)]"
        >
          <Check className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="leading-relaxed">{watchActionFeedback}</span>
        </div>
      )}

      {/* ====================================================================
          ACCORDION 1: SYNC & BIOMETRIC PERMISSIONS (Streamlined)
          ==================================================================== */}
      <SettingsBentoAccordion
        id="wearables-sync"
        title="Sync & Biometric Permissions"
        subtitle="Live sync toggle and shared wearable sensor streams"
        pills={syncPills}
        isOpen={isSectionExpanded('sync')}
        onToggle={() => onToggleSection('sync')}
        sectionRef={(el) => {
          sectionRefs.current.sync = el;
        }}
      >
        <div id="wearables-section-sync" className="space-y-3">
          <div className="divide-y divide-[var(--border-hairline)]">
            {renderSwitchRow(
              'wearable-live-sync',
              settings.watchConnected,
              () => {
                const next = !settings.watchConnected;
                onUpdateSettings({ watchConnected: next });
                onAnnounce(`Live wearable biometric sync turned ${next ? 'On' : 'Off'}.`);
              },
              'Live Biometric Sync',
              'Automatically sync wearable metrics in the background, or use Sync Biometrics Now above anytime.'
            )}

            {renderSwitchRow(
              'sensor-hr-hrv',
              wearables.sensors.heartRateHrv,
              () => {
                const next = !wearables.sensors.heartRateHrv;
                onUpdateWearables((prev) => ({
                  ...prev,
                  sensors: { ...prev.sensors, heartRateHrv: next },
                }));
                onAnnounce(
                  `Heart Rate and HRV sensor stream ${next ? 'enabled' : 'paused'}.`
                );
              },
              a11y.plainLanguage
                ? 'Heart Rate & Heart Rhythm Recovery'
                : 'Heart Rate & HRV',
              a11y.plainLanguage
                ? 'Updates your Energy Reserve Gauge and recovery trends.'
                : 'Feeds Burnout Resilience Gauge and recovery insights.'
            )}

            {renderSwitchRow(
              'sensor-sleep',
              wearables.sensors.sleep,
              () => {
                const next = !wearables.sensors.sleep;
                onUpdateWearables((prev) => ({
                  ...prev,
                  sensors: { ...prev.sensors, sleep: next },
                }));
                onAnnounce(`Sleep Quality and Duration sensor stream ${next ? 'enabled' : 'paused'}.`);
              },
              'Sleep Quality & Duration',
              a11y.plainLanguage
                ? 'Updates how sleep patterns connect with your daily mood.'
                : 'Feeds Mind-Body pattern insights in Trends.'
            )}

            {renderSwitchRow(
              'sensor-steps',
              wearables.sensors.steps,
              () => {
                const next = !wearables.sensors.steps;
                onUpdateWearables((prev) => ({
                  ...prev,
                  sensors: { ...prev.sensors, steps: next },
                }));
                onAnnounce(`Daily Steps sensor stream ${next ? 'enabled' : 'paused'}.`);
              },
              'Daily Steps',
              'Feeds your daily movement counter and step summaries.'
            )}
          </div>
        </div>
      </SettingsBentoAccordion>

      {/* ====================================================================
          ACCORDION 2: WRIST HAPTICS & ALERTS
          ==================================================================== */}
      <SettingsBentoAccordion
        id="wearables-haptics"
        title="Wrist Haptics & Alerts"
        subtitle="Breathing taps, haptic strength & Do Not Disturb mirroring"
        pills={hapticsPills}
        isOpen={isSectionExpanded('haptics')}
        onToggle={() => onToggleSection('haptics')}
        sectionRef={(el) => {
          sectionRefs.current.haptics = el;
        }}
      >
        <div id="wearables-section-haptics" className="space-y-4">
          {/* Soothing Breathing Haptics */}
          <div className="divide-y divide-[var(--border-hairline)]">
            {renderSwitchRow(
              'breathing-haptics',
              wearables.breathingHaptics,
              () => {
                const next = !wearables.breathingHaptics;
                onUpdateWearables({ breathingHaptics: next });
                onAnnounce(`Soothing Breathing Haptics turned ${next ? 'On' : 'Off'}.`);
              },
              'Soothing Breathing Haptics',
              a11y.plainLanguage
                ? 'Mirrors 4-7-8 Breathing and Panic Calm Guide inhale, hold, and exhale beats with gentle wrist taps.'
                : 'Mirrors 4-7-8 Calm Breathing and Voice Panic Anchor inhale/hold/exhale cadence via gentle wrist taps for eyes-closed resets.'
            )}
          </div>

          {/* Haptic Strength 3-Option Segmented Control + Quiet Cues Override Sync */}
          <div className="space-y-2 border-t border-[var(--border-hairline)] pt-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex items-center gap-1.5">
                <Vibrate className="h-3.5 w-3.5 shrink-0 text-[var(--brand-accent-text)]" />
                <p
                  id="wearables-haptic-strength-label"
                  className="text-xs font-semibold text-[var(--ink-secondary)]"
                >
                  Haptic Strength
                </p>
              </div>
              {a11y.quietCues && (
                <span
                  className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold"
                  style={{ color: 'var(--brand-accent-text)' }}
                >
                  <BellOff className="h-3 w-3 shrink-0" />
                  <span>Muted by Quiet Cues</span>
                </span>
              )}
            </div>

            <div
              role="radiogroup"
              aria-labelledby="wearables-haptic-strength-label"
              className="wb-pane-seg-3 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-1"
            >
              {HAPTIC_STRENGTH_OPTIONS.map((opt) => {
                const effectiveStrength = a11y.quietCues ? 'off' : wearables.hapticStrength;
                const active = effectiveStrength === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    data-no-drag-scroll="true"
                    aria-checked={active}
                    disabled={a11y.quietCues && opt.id !== 'off'}
                    onClick={() => {
                      onUpdateWearables({ hapticStrength: opt.id });
                      onAnnounce(`Wrist haptic strength set to ${opt.label}.`);
                    }}
                    className="min-h-[44px] min-w-0 truncate rounded-lg px-1.5 text-xs font-semibold transition-colors disabled:opacity-45"
                    style={{
                      backgroundColor: active ? 'var(--brand-action-bg)' : 'transparent',
                      color: active ? 'var(--brand-action-fg)' : 'var(--ink-secondary)',
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {a11y.quietCues && (
              <p className="wb-prose text-xs leading-relaxed text-[var(--ink-muted)]">
                Quiet / Visual-Only Cues is active in Accessibility Settings, keeping wrist
                vibrations silenced until turned off.
              </p>
            )}
          </div>

          {/* Burnout Alerts + Mirror Phone DND */}
          <div className="divide-y divide-[var(--border-hairline)] border-t border-[var(--border-hairline)]">
            {renderSwitchRow(
              'burnout-wrist-alerts',
              wearables.burnoutWristAlerts,
              () => {
                const next = !wearables.burnoutWristAlerts;
                onUpdateWearables({ burnoutWristAlerts: next });
                onAnnounce(
                  `Elevated HR and burnout alerts on wrist turned ${next ? 'On' : 'Off'}.`
                );
              },
              a11y.plainLanguage
                ? 'Gentle Stress & Energy Check-In Nudges'
                : 'Elevated HR & Burnout Alerts on Wrist',
              a11y.calmMode
                ? 'Offers a soft, unhurried wrist reminder to pause when steady tension builds.'
                : 'Sends a gentle wrist nudge when elevated resting HR or predictive low-energy windows are detected.'
            )}

            {renderSwitchRow(
              'mirror-phone-dnd',
              wearables.mirrorPhoneDnd,
              () => {
                const next = !wearables.mirrorPhoneDnd;
                onUpdateWearables({ mirrorPhoneDnd: next });
                onAnnounce(`Mirror Phone Do Not Disturb turned ${next ? 'On' : 'Off'}.`);
              },
              'Mirror Phone Do Not Disturb',
              settings.dndEnabled
                ? 'Synced with Today Predictive Nudges — Phone DND is currently On, so wrist alerts are quiet.'
                : 'Synced with Today Predictive Nudges so wrist alerts stay quiet during sleep or focus windows.',
              settings.dndEnabled && wearables.mirrorPhoneDnd ? (
                <span
                  className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold"
                  style={{ color: 'var(--brand-accent-text)' }}
                >
                  <span aria-hidden="true">·</span>
                  <span>DND Active</span>
                </span>
              ) : undefined
            )}
          </div>
        </div>
      </SettingsBentoAccordion>

      {/* ====================================================================
          ACCORDION 3: WATCH FACE & QUICK-LAUNCH CONTINUITY (Streamlined)
          ==================================================================== */}
      <SettingsBentoAccordion
        id="wearables-continuity"
        title="Watch Face & Quick-Launch Continuity"
        subtitle="Discreet wrist privacy mode & phone follow-up handoff"
        pills={continuityPills}
        isOpen={isSectionExpanded('continuity')}
        onToggle={() => onToggleSection('continuity')}
        sectionRef={(el) => {
          sectionRefs.current.continuity = el;
        }}
      >
        <div id="wearables-section-continuity" className="divide-y divide-[var(--border-hairline)]">
          {renderSwitchRow(
            'discreet-wrist',
            wearables.discreetWristDisplay,
            () => {
              const next = !wearables.discreetWristDisplay;
              onUpdateWearables({ discreetWristDisplay: next });
              onAnnounce(`Discreet Wrist Display turned ${next ? 'On' : 'Off'}.`);
            },
            'Discreet Wrist Display',
            'Replaces explicit emotion words (such as Anxious, Overwhelmed, or Sad) on your watch face with a neutral color dot or glyph for public privacy.',
            wearables.discreetWristDisplay ? (
              <span
                className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold"
                style={{ color: 'var(--brand-accent-text)' }}
              >
                <EyeOff className="h-3 w-3 shrink-0" />
                <span>Private Mode</span>
              </span>
            ) : undefined
          )}

          {renderSwitchRow(
            'phone-handoff',
            wearables.phoneHandoff,
            () => {
              const next = !wearables.phoneHandoff;
              onUpdateWearables({ phoneHandoff: next });
              onAnnounce(`Phone Handoff turned ${next ? 'On' : 'Off'}.`);
            },
            'Phone Handoff',
            'Opens an optional follow-up journal note prompt on your phone right after logging a quick check-in from your watch.'
          )}
        </div>
      </SettingsBentoAccordion>

      {/* ====================================================================
          ACCORDION 4: DEVICE MANAGEMENT
          ==================================================================== */}
      <SettingsBentoAccordion
        id="wearables-device"
        title="Device Management"
        subtitle="Switch wearables, unpair safely & view companion diagnostics"
        pills={devicePills}
        isOpen={isSectionExpanded('device')}
        onToggle={() => onToggleSection('device')}
        sectionRef={(el) => {
          sectionRefs.current.device = el;
        }}
      >
        <div id="wearables-section-device" className="space-y-4">
          {/* Primary Paired Wearable Actions */}
          <div className="wb-pane-item-card">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-snug text-[var(--ink-primary)]">
                Paired Wearable Controls
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-[var(--ink-muted)]">
                {pairedDevice
                  ? `Currently paired with ${pairedDevice.name}. Switch wearables anytime without losing history.`
                  : 'Choose a supported wearable below to resume automatic biometric continuity.'}
              </p>
            </div>
            <div className="wb-pane-item-actions">
              <button
                type="button"
                data-no-drag-scroll="true"
                aria-expanded={pairDrawerOpen}
                onClick={() => {
                  setUnpairConfirmOpen(false);
                  setPairDrawerOpen((o) => !o);
                }}
                className="inline-flex min-h-[44px] items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 text-xs font-semibold"
                style={{
                  backgroundColor: 'var(--brand-action-bg)',
                  color: 'var(--brand-action-fg)',
                }}
              >
                <Plus className="h-3.5 w-3.5 shrink-0" />
                <span>Pair Wearable</span>
              </button>
              {pairedDevice && (
                <button
                  type="button"
                  data-no-drag-scroll="true"
                  aria-expanded={unpairConfirmOpen}
                  onClick={() => {
                    setPairDrawerOpen(false);
                    setUnpairConfirmOpen((o) => !o);
                  }}
                  className="inline-flex min-h-[44px] items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] px-3.5 text-xs font-semibold text-[var(--q-red-fg)] hover:bg-[var(--q-red-bg)]"
                >
                  <Unlink className="h-3.5 w-3.5 shrink-0" />
                  <span>Unpair Device</span>
                </button>
              )}
            </div>
          </div>

          {/* Inline Pair Wearable Selector Drawer */}
          {pairDrawerOpen && (
            <div
              role="region"
              aria-label="Select a wearable to pair"
              className="space-y-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-3.5"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-[var(--ink-secondary)]">
                  Select a supported wearable
                </p>
                <button
                  type="button"
                  data-no-drag-scroll="true"
                  onClick={() => setPairDrawerOpen(false)}
                  className="min-h-[44px] rounded-lg px-2.5 text-xs font-semibold text-[var(--ink-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink-primary)]"
                >
                  Close
                </button>
              </div>

              <div className="divide-y divide-[var(--border-hairline)] rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)]">
                {WEARABLE_DEVICES.map((device) => {
                  const isCurrent = wearables.pairedDeviceId === device.id;
                  return (
                    <div key={device.id} className="wb-pane-item-card p-3">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] text-[var(--ink-primary)]">
                          {renderDeviceGlyph(device, 'h-4 w-4')}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                            <p className="text-sm font-semibold leading-snug text-[var(--ink-primary)]">
                              {device.name}
                            </p>
                            {isCurrent && (
                              <span
                                className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold"
                                style={{ color: 'var(--brand-accent-text)' }}
                              >
                                <span aria-hidden="true">·</span>
                                <span>Active</span>
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-xs text-[var(--ink-muted)] tabular-nums">
                            {device.bridge} · Battery {device.batteryPercent}%
                          </p>
                        </div>
                      </div>

                      <div className="wb-pane-item-actions">
                        <button
                          type="button"
                          data-no-drag-scroll="true"
                          disabled={isCurrent}
                          onClick={() => handleSelectDevice(device)}
                          className="inline-flex min-h-[44px] items-center justify-center whitespace-nowrap rounded-xl border px-3.5 text-xs font-semibold transition-colors disabled:opacity-50"
                          style={
                            isCurrent
                              ? {
                                  backgroundColor: 'var(--surface-card)',
                                  borderColor: 'var(--border-hairline)',
                                  color: 'var(--ink-muted)',
                                }
                              : {
                                  backgroundColor: 'var(--brand-action-bg)',
                                  borderColor: 'var(--brand-action-bg)',
                                  color: 'var(--brand-action-fg)',
                                }
                          }
                        >
                          {isCurrent ? 'Paired' : 'Select'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Single-Step Unpair Confirmation */}
          {unpairConfirmOpen && pairedDevice && (
            <div
              role="region"
              aria-label="Confirm device unpairing"
              className="space-y-3 rounded-xl border border-[var(--border-strong)] bg-[var(--surface-card)] p-3.5"
            >
              <p className="text-sm font-semibold text-[var(--ink-primary)]">
                Unpair {pairedDevice.name}?
              </p>
              <p className="wb-prose text-xs leading-relaxed text-[var(--ink-secondary)]">
                This pauses live sensor updates until you reconnect. All historical mood check-ins,
                HRV trends, and sleep records stay safely preserved.
              </p>
              <div className="wb-pane-item-actions">
                <button
                  type="button"
                  data-no-drag-scroll="true"
                  onClick={() => setUnpairConfirmOpen(false)}
                  className="inline-flex min-h-[44px] items-center justify-center whitespace-nowrap rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3.5 text-xs font-semibold text-[var(--ink-primary)]"
                >
                  Keep Paired
                </button>
                <button
                  type="button"
                  data-no-drag-scroll="true"
                  onClick={handleConfirmUnpair}
                  className="inline-flex min-h-[44px] items-center justify-center whitespace-nowrap rounded-xl border border-[var(--q-red-border)] bg-[var(--q-red-bg)] px-4 text-xs font-semibold text-[var(--q-red-fg)]"
                >
                  Confirm Unpair
                </button>
              </div>
            </div>
          )}

          {/* Companion Diagnostics Footer */}
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 border-t border-[var(--border-hairline)] pt-3 text-xs text-[var(--ink-muted)] tabular-nums">
            <span>Companion App · {(pairedDevice ?? lastDevice).companionVersion}</span>
            <span aria-hidden="true">·</span>
            <span>Bridge · {(pairedDevice ?? lastDevice).bridge}</span>
            <span aria-hidden="true">·</span>
            <span>Last sync {lastSyncFormatted}</span>
          </div>
        </div>
      </SettingsBentoAccordion>
    </div>
  );
};
