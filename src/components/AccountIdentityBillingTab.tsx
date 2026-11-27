import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Check,
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  Fingerprint,
  Lock,
  Mail,
  Printer,
  Receipt,
  ScanFace,
  ShieldCheck,
  User,
  X,
} from 'lucide-react';
import { useAccessibility } from '../context/AccessibilityContext';
import {
  AccountState,
  BillingInvoice,
  OAuthProviderId,
  PLAN_OPTIONS,
  PlanTierId,
  buildReceiptHtml,
  buildReceiptPlainText,
  evaluatePasswordStrength,
  formatShortDate,
  isValidEmail,
  loadAccountState,
  saveAccountState,
} from '../utils/accountStorage';
import { downloadFile } from '../utils/analytics';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { BentoSummaryPill, SettingsBentoAccordion } from './SettingsBentoAccordion';

/* Crisp Inline Brand Marks for OAuth Providers */
const GoogleMark: React.FC = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);

const AppleMark: React.FC = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 fill-current" aria-hidden="true">
    <path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.332-1.26-3.428-2.8-1.287-1.82-2.323-4.63-2.323-7.28 0-4.28 2.797-6.55 5.552-6.55 1.448 0 2.675.95 3.6.95.865 0 2.222-1.01 3.902-1.01.613 0 2.886.06 4.374 2.19-.13.09-2.383 1.37-2.383 4.19 0 3.26 2.854 4.42 2.955 4.45z" />
  </svg>
);

export interface AccountIdentityBillingTabProps {
  openSubAccordionId?: string | null;
  onToggleSubAccordion?: (id: string) => void;
  onAnnounce: (message: string) => void;
  onNotify?: (title: string, subtitle?: string) => void;
  onSubTabChange?: () => void;
}

type SectionKey = 'profile' | 'security' | 'billing';

const ACCOUNT_SUBTABS: Array<{ id: SectionKey; label: string }> = [
  { id: 'profile', label: 'Profile' },
  { id: 'security', label: 'Security' },
  { id: 'billing', label: 'Billing' },
];

export const AccountIdentityBillingTab: React.FC<AccountIdentityBillingTabProps> = ({
  openSubAccordionId = null,
  onToggleSubAccordion,
  onAnnounce,
  onNotify,
  onSubTabChange,
}) => {
  const a11y = useAccessibility();
  const receiptModalRef = useRef<HTMLDivElement>(null);
  const subTabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const [activeSubTab, setActiveSubTab] = useState<SectionKey>('profile');
  const [account, setAccount] = useState<AccountState>(() => loadAccountState());
  const isInitialAccountMountRef = useRef(true);

  // Persist safely to wellbe_account_v1 (schema unchanged)
  useEffect(() => {
    if (isInitialAccountMountRef.current) {
      isInitialAccountMountRef.current = false;
      return;
    }
    saveAccountState(account);
  }, [account]);

  // Reset the parent Settings pane scrollTop = 0 whenever switching Profile / Security / Billing
  useLayoutEffect(() => {
    onSubTabChange?.();
  }, [activeSubTab, onSubTabChange]);

  const emitStatus = (msg: string, toastTitle?: string, toastSub?: string) => {
    onAnnounce(msg);
    if (toastTitle && onNotify) {
      onNotify(toastTitle, toastSub);
    }
  };

  const selectSubTab = (next: SectionKey) => {
    if (next !== activeSubTab) {
      setChangePwOpen(false);
      setSwitchPlanOpen(false);
      setCancelPromptOpen(false);
    }
    setActiveSubTab(next);
    onSubTabChange?.();
  };

  const handleSubTabKeyDown = (e: React.KeyboardEvent, idx: number) => {
    let nextIdx = idx;
    if (e.key === 'ArrowRight') nextIdx = (idx + 1) % ACCOUNT_SUBTABS.length;
    else if (e.key === 'ArrowLeft')
      nextIdx = (idx - 1 + ACCOUNT_SUBTABS.length) % ACCOUNT_SUBTABS.length;
    else if (e.key === 'Home') nextIdx = 0;
    else if (e.key === 'End') nextIdx = ACCOUNT_SUBTABS.length - 1;
    else return;

    e.preventDefault();
    const target = ACCOUNT_SUBTABS[nextIdx];
    selectSubTab(target.id);
    subTabRefs.current[nextIdx]?.focus();
  };

  /* ========================================================================
     SECTION A: MINIMAL PRIVATE PROFILE STATE
     ======================================================================== */
  const { profile, security, billing } = account;

  const [draftName, setDraftName] = useState(profile.displayName);
  const [draftEmail, setDraftEmail] = useState(profile.email);
  const [profileError, setProfileError] = useState('');
  const [profileSavedNotice, setProfileSavedNotice] = useState('');

  const isProfileDirty =
    draftName.trim() !== profile.displayName ||
    draftEmail.trim().toLowerCase() !== profile.email.toLowerCase();

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = draftName.trim();
    const cleanEmail = draftEmail.trim();

    if (cleanName.length < 2) {
      setProfileError('Display name must be at least 2 characters.');
      return;
    }
    if (!isValidEmail(cleanEmail)) {
      setProfileError('Enter a valid email address (for example, name@domain.com).');
      return;
    }

    setProfileError('');
    const nextName = cleanName.slice(0, 48);
    setAccount((prev) => ({
      ...prev,
      profile: {
        ...prev.profile,
        displayName: nextName,
        email: cleanEmail,
      },
    }));
    setDraftName(nextName);
    setDraftEmail(cleanEmail);
    setProfileSavedNotice('Profile details saved locally.');
    emitStatus('Profile display name and email updated.', 'Profile updated', nextName);
  };

  /* ========================================================================
     SECTION B: SECURITY & AUTHENTICATION STATE
     ======================================================================== */
  const [changePwOpen, setChangePwOpen] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPwFields, setShowPwFields] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwFeedback, setPwFeedback] = useState('');

  const [providerNotice, setProviderNotice] = useState<{
    tone: 'warn' | 'info';
    text: string;
  } | null>(null);

  const pwStrength = evaluatePasswordStrength(newPw);

  const visibleProviderIds: OAuthProviderId[] = ['google', 'apple'];
  const connectedOAuthCount = visibleProviderIds.filter(
    (id) => profile.providers[id]?.connected
  ).length;
  const hasFallbackAuth = security.hasPassword;

  const handleToggleProvider = (id: OAuthProviderId, label: string) => {
    const currentlyConnected = profile.providers[id].connected;
    if (currentlyConnected && connectedOAuthCount <= 1 && !hasFallbackAuth) {
      setProviderNotice({
        tone: 'warn',
        text: 'Cannot disconnect your last active sign-in method. Set a password first.',
      });
      emitStatus('Blocked disconnecting final active sign-in method.');
      return;
    }
    setAccount((prev) => ({
      ...prev,
      profile: {
        ...prev.profile,
        providers: {
          ...prev.profile.providers,
          [id]: {
            ...prev.profile.providers[id],
            connected: !currentlyConnected,
          },
        },
      },
    }));
    if (currentlyConnected && connectedOAuthCount <= 1 && hasFallbackAuth) {
      setProviderNotice({
        tone: 'info',
        text: `${label} disconnected. Account access remains protected by your password.`,
      });
    } else {
      setProviderNotice(null);
    }
    emitStatus(
      currentlyConnected ? `${label} disconnected.` : `${label} connected to your account.`
    );
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (security.hasPassword && currentPw.trim().length < 4) {
      setPwError('Enter your current password to verify this change.');
      return;
    }
    if (newPw.length < 8) {
      setPwError('New password must be at least 8 characters long.');
      return;
    }
    if (newPw !== confirmPw) {
      setPwError('New password and confirmation do not match.');
      return;
    }
    const todayStr = formatShortDate(new Date());
    setAccount((prev) => ({
      ...prev,
      security: {
        ...prev.security,
        hasPassword: true,
        passwordUpdatedAt: todayStr,
      },
    }));
    // Immediately clear raw passwords from memory; never persisted
    setCurrentPw('');
    setNewPw('');
    setConfirmPw('');
    setPwError('');
    setChangePwOpen(false);
    setPwFeedback(`Password updated on ${todayStr}.`);
    emitStatus(
      `Password updated on ${todayStr}.`,
      'Password updated',
      `Last updated ${todayStr}`
    );
  };

  /* ========================================================================
     SECTION C: SUBSCRIPTIONS & PAYMENTS STATE
     ======================================================================== */
  const currentPlan =
    PLAN_OPTIONS.find((p) => p.id === billing.planId) ?? PLAN_OPTIONS[1];

  const [switchPlanOpen, setSwitchPlanOpen] = useState(false);
  const [selectedPlanDraft, setSelectedPlanDraft] = useState<PlanTierId>(billing.planId);
  const [cancelPromptOpen, setCancelPromptOpen] = useState(false);
  const [billingFeedback, setBillingFeedback] = useState('');

  const [activeReceipt, setActiveReceipt] = useState<BillingInvoice | null>(null);
  const closeReceipt = useCallback(() => setActiveReceipt(null), []);
  useFocusTrap(receiptModalRef, closeReceipt, Boolean(activeReceipt));

  const handleConfirmPlanChange = () => {
    if (selectedPlanDraft === billing.planId && !billing.cancelAtPeriodEnd) {
      setSwitchPlanOpen(false);
      return;
    }
    const targetPlan = PLAN_OPTIONS.find((p) => p.id === selectedPlanDraft) ?? PLAN_OPTIONS[0];
    const nextDate =
      selectedPlanDraft === 'plus_annual'
        ? 'Nov 21, 2027'
        : selectedPlanDraft === 'plus_monthly'
          ? 'Dec 21, 2026'
          : 'No upcoming renewal';

    setAccount((prev) => ({
      ...prev,
      billing: {
        ...prev.billing,
        planId: selectedPlanDraft,
        cancelAtPeriodEnd: false,
        renewalDate: nextDate,
      },
    }));
    setSwitchPlanOpen(false);
    setCancelPromptOpen(false);
    const msg =
      selectedPlanDraft === 'free'
        ? 'Switched to WELLBE+ Free ($0 / month). No future renewals scheduled.'
        : `Switched to ${targetPlan.name} (${targetPlan.priceLabel} ${targetPlan.cadenceLabel}). Next renewal ${nextDate}.`;
    setBillingFeedback(msg);
    emitStatus(msg, 'Subscription updated', targetPlan.name);
  };

  const handleConfirmCancelSubscription = () => {
    setAccount((prev) => ({
      ...prev,
      billing: {
        ...prev.billing,
        cancelAtPeriodEnd: true,
      },
    }));
    setCancelPromptOpen(false);
    const msg = `Subscription canceled. Your ${currentPlan.name} access remains active through ${billing.renewalDate}.`;
    setBillingFeedback(msg);
    emitStatus(msg, 'Subscription canceled', `Access continues through ${billing.renewalDate}`);
  };

  const handleResumeSubscription = () => {
    setAccount((prev) => ({
      ...prev,
      billing: {
        ...prev.billing,
        cancelAtPeriodEnd: false,
      },
    }));
    const msg = `Subscription resumed. ${currentPlan.name} will renew on ${billing.renewalDate}.`;
    setBillingFeedback(msg);
    emitStatus(msg, 'Subscription resumed', `Renews ${billing.renewalDate}`);
  };

  /* Helper for accessible brand switches inside Security */
  const renderSwitch = (
    id: string,
    checked: boolean,
    onToggle: () => void,
    label: string,
    description: string,
    icon?: React.ReactNode
  ) => (
    <div className="wb-pane-toggle-row py-3">
      <div className="flex min-w-0 flex-1 items-start gap-2.5">
        {icon && <span className="mt-0.5 shrink-0 text-[var(--brand-accent-text)]">{icon}</span>}
        <div className="min-w-0">
          <p id={`${id}-label`} className="text-sm font-semibold text-[var(--ink-primary)]">
            {label}
          </p>
          <p id={`${id}-desc`} className="wb-prose mt-0.5 text-xs leading-relaxed text-[var(--ink-muted)]">
            {description}
          </p>
        </div>
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
          style={{ color: checked ? 'var(--brand-accent-text)' : 'var(--ink-muted)' }}
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

  const providerRows: Array<{
    id: OAuthProviderId;
    name: string;
    icon: React.ReactNode;
    subtitle: string;
  }> = [
    {
      id: 'google',
      name: 'Google',
      icon: <GoogleMark />,
      subtitle: 'Single sign-on & encrypted sync',
    },
    {
      id: 'apple',
      name: 'Sign in with Apple',
      icon: <AppleMark />,
      subtitle: 'Private relay supported',
    },
  ];

  const tierStatusLabel =
    billing.planId === 'free'
      ? 'Free Tier'
      : billing.cancelAtPeriodEnd
        ? `Cancels on ${billing.renewalDate}`
        : 'Active';

  return (
    <div
      id="settings-panel-account"
      role="tabpanel"
      aria-labelledby="settings-tab-account"
      className="wb-calm-stack space-y-5 pb-4"
    >
      {/* Unified Settings Section Header + Flat Sub-Navigation Pills */}
      <div className="space-y-3">
        <div className="border-b border-[var(--border-hairline)] pb-3.5">
          <h2 className="text-base font-semibold tracking-tight text-[var(--ink-primary)]">
            Account, Identity &amp; Billing
          </h2>
          <p className="wb-prose mt-0.5 text-xs text-[var(--ink-muted)]">
            {a11y.plainLanguage
              ? 'Manage your name, sign-in security, and subscription plan.'
              : 'Private profile, sign-in security, and subscription controls'}
          </p>
        </div>

        {/* Horizontal Sub-Pills (Direct 2-Level Navigation — Zero Nested Accordions) */}
        <div
          role="tablist"
          aria-label="Account sections"
          className="grid grid-cols-3 gap-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] p-1"
        >
          {ACCOUNT_SUBTABS.map((item, idx) => {
            const selected = activeSubTab === item.id;
            return (
              <button
                key={item.id}
                ref={(el) => {
                  subTabRefs.current[idx] = el;
                }}
                id={`account-subtab-${item.id}`}
                type="button"
                role="tab"
                data-no-drag-scroll="true"
                aria-selected={selected}
                aria-controls={`account-subpanel-${item.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => selectSubTab(item.id)}
                onKeyDown={(e) => handleSubTabKeyDown(e, idx)}
                className="min-h-[44px] min-w-0 whitespace-nowrap rounded-lg px-2.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--focus-ring)]"
                style={
                  selected
                    ? {
                        backgroundColor: 'var(--brand-action-bg)',
                        color: 'var(--brand-action-fg)',
                      }
                    : {
                        backgroundColor: 'transparent',
                        color: 'var(--ink-secondary)',
                      }
                }
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ====================================================================
          FLAT VIEW 1: PROFILE (Minimal Private Display Name & Email Form)
          ==================================================================== */}
      {activeSubTab === 'profile' && (
        <section
          id="account-subpanel-profile"
          role="tabpanel"
          aria-labelledby="account-subtab-profile"
          className="space-y-4"
        >
          <form
            onSubmit={handleSaveProfile}
            noValidate
            className="space-y-4 rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] p-4"
          >
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-[var(--ink-primary)]">
                Private Profile
              </h3>
              <p className="wb-prose text-xs leading-relaxed text-[var(--ink-muted)]">
                Used only for local personalization, therapy summaries, and billing receipts.
              </p>
            </div>

            <div className="space-y-3.5">
              <div>
                <label
                  htmlFor="account-display-name"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--ink-secondary)]"
                >
                  <User className="h-3.5 w-3.5 shrink-0 text-[var(--ink-muted)]" />
                  <span>Display Name</span>
                </label>
                <input
                  id="account-display-name"
                  type="text"
                  autoComplete="name"
                  value={draftName}
                  onChange={(e) => {
                    setDraftName(e.target.value);
                    if (profileError) setProfileError('');
                    if (profileSavedNotice) setProfileSavedNotice('');
                  }}
                  maxLength={48}
                  placeholder="Your preferred name"
                  className="mt-1.5 min-h-[44px] w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] px-3 text-sm text-[var(--ink-primary)] placeholder:text-[var(--ink-muted)]"
                />
              </div>

              <div>
                <label
                  htmlFor="account-email-input"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--ink-secondary)]"
                >
                  <Mail className="h-3.5 w-3.5 shrink-0 text-[var(--ink-muted)]" />
                  <span>Email Address</span>
                </label>
                <input
                  id="account-email-input"
                  type="email"
                  autoComplete="email"
                  value={draftEmail}
                  onChange={(e) => {
                    setDraftEmail(e.target.value);
                    if (profileError) setProfileError('');
                    if (profileSavedNotice) setProfileSavedNotice('');
                  }}
                  placeholder="name@example.com"
                  className="mt-1.5 min-h-[44px] w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] px-3 text-sm text-[var(--ink-primary)] placeholder:text-[var(--ink-muted)]"
                />
              </div>
            </div>

            {profileError && (
              <p role="alert" className="text-xs font-medium text-[var(--q-red-fg)]">
                {profileError}
              </p>
            )}

            <div className="wb-pane-header-row border-t border-[var(--border-hairline)] pt-3.5">
              <div className="min-w-0 flex-1">
                {profileSavedNotice ? (
                  <p
                    role="status"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--q-green-fg)]"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    <span>{profileSavedNotice}</span>
                  </p>
                ) : (
                  <p className="text-[11px] leading-relaxed text-[var(--ink-muted)]">
                    Stored locally on this device.
                  </p>
                )}
              </div>

              <div className="wb-pane-item-actions">
                <button
                  type="submit"
                  data-no-drag-scroll="true"
                  disabled={!isProfileDirty}
                  className="inline-flex min-h-[44px] items-center justify-center whitespace-nowrap rounded-xl px-4 text-xs font-semibold transition-opacity disabled:opacity-45"
                  style={{
                    backgroundColor: 'var(--brand-action-bg)',
                    color: 'var(--brand-action-fg)',
                  }}
                >
                  Save Changes
                </button>
              </div>
            </div>
          </form>
        </section>
      )}

      {/* ====================================================================
          FLAT VIEW 2: SECURITY (Directly Visible Flat Cards)
          ==================================================================== */}
      {activeSubTab === 'security' && (
        <section
          id="account-subpanel-security"
          role="tabpanel"
          aria-labelledby="account-subtab-security"
          className="space-y-4"
        >
          {/* 1. Password Management */}
          <div className="space-y-3 rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] p-4">
            <div className="wb-pane-header-row">
              <div className="flex min-w-0 flex-1 items-start gap-2.5">
                <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-accent-text)]" />
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold leading-snug text-[var(--ink-primary)]">
                    Password Management
                  </h3>
                  <p className="mt-0.5 font-mono-tabular text-xs leading-relaxed text-[var(--ink-muted)]">
                    Last updated {security.passwordUpdatedAt}
                  </p>
                </div>
              </div>
              <div className="wb-pane-item-actions">
                <button
                  type="button"
                  data-no-drag-scroll="true"
                  aria-expanded={changePwOpen}
                  onClick={() => {
                    setChangePwOpen((o) => !o);
                    setPwError('');
                  }}
                  className="inline-flex min-h-[44px] items-center justify-center whitespace-nowrap rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] px-3.5 text-xs font-semibold text-[var(--ink-primary)] hover:bg-[var(--surface-hover)]"
                >
                  Change Password
                </button>
              </div>
            </div>

            {pwFeedback && (
              <p
                role="status"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--ink-secondary)]"
              >
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[var(--brand-accent-text)]" />
                <span>{pwFeedback}</span>
              </p>
            )}

            {changePwOpen && (
              <form
                onSubmit={handleChangePassword}
                noValidate
                className="space-y-3 border-t border-[var(--border-hairline)] pt-3.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[var(--ink-secondary)]">
                    Update account password
                  </span>
                  <button
                    type="button"
                    data-no-drag-scroll="true"
                    onClick={() => setShowPwFields((s) => !s)}
                    className="inline-flex min-h-[44px] items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-[var(--ink-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink-primary)]"
                  >
                    {showPwFields ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    <span>{showPwFields ? 'Hide' : 'Show'}</span>
                  </button>
                </div>

                <div className="space-y-2.5">
                  <div>
                    <label
                      htmlFor="pw-current"
                      className="block text-xs font-semibold text-[var(--ink-secondary)]"
                    >
                      Current Password
                    </label>
                    <input
                      id="pw-current"
                      type={showPwFields ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={currentPw}
                      onChange={(e) => {
                        setCurrentPw(e.target.value);
                        if (pwError) setPwError('');
                      }}
                      className="mt-1 min-h-[44px] w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] px-3 text-sm text-[var(--ink-primary)]"
                    />
                  </div>
                  <div className="wb-pane-grid-2">
                    <div>
                      <label
                        htmlFor="pw-new"
                        className="block text-xs font-semibold text-[var(--ink-secondary)]"
                      >
                        New Password
                      </label>
                      <input
                        id="pw-new"
                        type={showPwFields ? 'text' : 'password'}
                        autoComplete="new-password"
                        value={newPw}
                        onChange={(e) => {
                          setNewPw(e.target.value);
                          if (pwError) setPwError('');
                        }}
                        className="mt-1 min-h-[44px] w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] px-3 text-sm text-[var(--ink-primary)]"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="pw-confirm"
                        className="block text-xs font-semibold text-[var(--ink-secondary)]"
                      >
                        Confirm New Password
                      </label>
                      <input
                        id="pw-confirm"
                        type={showPwFields ? 'text' : 'password'}
                        autoComplete="new-password"
                        value={confirmPw}
                        onChange={(e) => {
                          setConfirmPw(e.target.value);
                          if (pwError) setPwError('');
                        }}
                        className="mt-1 min-h-[44px] w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] px-3 text-sm text-[var(--ink-primary)]"
                      />
                    </div>
                  </div>
                </div>

                {/* Live Password Strength Meter (Color + Explicit Text Label) */}
                <div className="space-y-1.5" aria-live="polite">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[var(--ink-muted)]">Password strength</span>
                    <span className="font-semibold text-[var(--ink-primary)]">
                      {pwStrength.label}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5" aria-hidden="true">
                    {[1, 2, 3, 4].map((step) => {
                      const active = pwStrength.score >= step;
                      const barColor =
                        pwStrength.score <= 1
                          ? 'var(--q-red-solid)'
                          : pwStrength.score === 2
                            ? 'var(--q-yellow-solid)'
                            : 'var(--brand-action-bg)';
                      return (
                        <span
                          key={step}
                          className="h-1.5 rounded-full transition-colors"
                          style={{
                            backgroundColor: active ? barColor : 'var(--border-hairline)',
                          }}
                        />
                      );
                    })}
                  </div>
                </div>

                {pwError && (
                  <p role="alert" className="text-xs font-medium text-[var(--q-red-fg)]">
                    {pwError}
                  </p>
                )}

                <div className="wb-pane-item-actions pt-1">
                  <button
                    type="button"
                    data-no-drag-scroll="true"
                    onClick={() => {
                      setChangePwOpen(false);
                      setCurrentPw('');
                      setNewPw('');
                      setConfirmPw('');
                      setPwError('');
                    }}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] px-3.5 text-xs font-semibold text-[var(--ink-secondary)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    data-no-drag-scroll="true"
                    className="inline-flex min-h-[44px] items-center justify-center rounded-xl px-4 text-xs font-semibold"
                    style={{
                      backgroundColor: 'var(--brand-action-bg)',
                      color: 'var(--brand-action-fg)',
                    }}
                  >
                    Save Password
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* 2. Biometric Login Toggles */}
          <div className="divide-y divide-[var(--border-hairline)] rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-4">
            {renderSwitch(
              'bio-face-id',
              security.faceIdEnabled,
              () => {
                const next = !security.faceIdEnabled;
                setAccount((prev) => ({
                  ...prev,
                  security: { ...prev.security, faceIdEnabled: next },
                }));
                emitStatus(`Face ID / Biometric Unlock turned ${next ? 'On' : 'Off'}.`);
              },
              'Face ID / Biometric Unlock',
              'Uses your device facial recognition sensor when supported by hardware.',
              <ScanFace className="h-4 w-4" />
            )}
            {renderSwitch(
              'bio-fingerprint',
              security.fingerprintEnabled,
              () => {
                const next = !security.fingerprintEnabled;
                setAccount((prev) => ({
                  ...prev,
                  security: { ...prev.security, fingerprintEnabled: next },
                }));
                emitStatus(`Fingerprint / Device Unlock turned ${next ? 'On' : 'Off'}.`);
              },
              'Fingerprint / Device Unlock',
              'Uses Touch ID, Pixel Imprint, or Windows Hello for quick local unlock.',
              <Fingerprint className="h-4 w-4" />
            )}
          </div>

          {/* 3. Connected Sign-In Methods */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-semibold text-[var(--ink-secondary)]">
              {a11y.plainLanguage ? 'Connected Sign-In Accounts' : 'Connected Sign-In Methods'}
            </h3>

            {providerNotice && (
              <div
                role={providerNotice.tone === 'warn' ? 'alert' : 'status'}
                className="flex items-start gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-medium"
                style={
                  providerNotice.tone === 'warn' && !a11y.calmMode
                    ? {
                        backgroundColor: 'var(--q-yellow-bg)',
                        borderColor: 'var(--q-yellow-border)',
                        color: 'var(--q-yellow-fg)',
                      }
                    : {
                        backgroundColor: 'var(--surface-subtle)',
                        borderColor: 'var(--border-hairline)',
                        color: 'var(--ink-secondary)',
                      }
                }
              >
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{providerNotice.text}</span>
              </div>
            )}

            <div className="divide-y divide-[var(--border-hairline)] rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)]">
              {providerRows.map((item) => {
                const state = profile.providers[item.id];
                const blocked = state.connected && connectedOAuthCount <= 1 && !hasFallbackAuth;
                return (
                  <div key={item.id} className="wb-pane-item-card p-3.5">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] text-[var(--ink-primary)]">
                        {item.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                          <p className="text-sm font-semibold leading-snug text-[var(--ink-primary)]">
                            {item.name}
                          </p>
                          <span
                            className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold"
                            style={{
                              color: state.connected
                                ? 'var(--brand-accent-text)'
                                : 'var(--ink-muted)',
                            }}
                          >
                            <span aria-hidden="true">·</span>
                            <span>{state.connected ? 'Connected' : 'Not linked'}</span>
                          </span>
                        </div>
                        <p className="mt-0.5 break-words text-xs leading-relaxed text-[var(--ink-muted)]">
                          {state.connected ? state.accountHint : item.subtitle}
                        </p>
                      </div>
                    </div>

                    <div className="wb-pane-item-actions">
                      <button
                        type="button"
                        data-no-drag-scroll="true"
                        aria-disabled={blocked}
                        onClick={() => handleToggleProvider(item.id, item.name)}
                        className="inline-flex min-h-[44px] items-center justify-center whitespace-nowrap rounded-xl border px-3.5 text-xs font-semibold transition-colors"
                        style={
                          state.connected
                            ? {
                                backgroundColor: 'var(--surface-card)',
                                color: blocked ? 'var(--ink-muted)' : 'var(--q-red-fg)',
                                borderColor: 'var(--border-hairline)',
                              }
                            : {
                                backgroundColor: 'var(--brand-action-bg)',
                                color: 'var(--brand-action-fg)',
                                borderColor: 'var(--brand-action-bg)',
                              }
                        }
                      >
                        {state.connected ? 'Disconnect' : 'Connect'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ====================================================================
          FLAT VIEW 3: BILLING (Directly Visible Flat Cards)
          ==================================================================== */}
      {activeSubTab === 'billing' && (
        <section
          id="account-subpanel-billing"
          role="tabpanel"
          aria-labelledby="account-subtab-billing"
          className="space-y-4"
        >
          {/* 1. Current Tier Status Card */}
          <div className="space-y-4 rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] p-4">
            <div className="wb-pane-header-row">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold leading-snug text-[var(--ink-primary)]">
                    {currentPlan.name}
                  </h3>
                  <span
                    className="inline-flex items-center whitespace-nowrap rounded-lg px-2 py-0.5 text-xs font-semibold"
                    style={
                      billing.planId === 'free'
                        ? {
                            backgroundColor: 'var(--surface-card)',
                            color: 'var(--ink-secondary)',
                            border: '1px solid var(--border-hairline)',
                          }
                        : billing.cancelAtPeriodEnd
                          ? {
                              backgroundColor: a11y.calmMode
                                ? 'var(--surface-card)'
                                : 'var(--q-yellow-bg)',
                              color: a11y.calmMode
                                ? 'var(--ink-primary)'
                                : 'var(--q-yellow-fg)',
                              border: '1px solid var(--border-hairline)',
                            }
                          : {
                              backgroundColor: 'var(--brand-accent-soft)',
                              color: 'var(--brand-accent-text)',
                              border: '1px solid var(--brand-accent-border)',
                            }
                    }
                  >
                    {tierStatusLabel}
                  </span>
                </div>
                <p className="mt-1 font-mono-tabular text-xs leading-relaxed text-[var(--ink-muted)]">
                  {billing.planId === 'free'
                    ? 'No recurring charge'
                    : billing.cancelAtPeriodEnd
                      ? `Access through ${billing.renewalDate} · Auto-renewal off`
                      : `Next renewal: ${billing.renewalDate}`}
                </p>
              </div>

              <div className="wb-pane-price-col">
                <p className="font-mono-tabular text-lg font-bold text-[var(--ink-primary)]">
                  {currentPlan.priceLabel}
                  <span className="ml-1 text-xs font-medium text-[var(--ink-muted)]">
                    {currentPlan.cadenceLabel}
                  </span>
                </p>
              </div>
            </div>

            <ul className="space-y-1.5 text-xs text-[var(--ink-secondary)]">
              {currentPlan.features.map((feat) => (
                <li key={feat} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--brand-accent-text)]" />
                  <span className="wb-prose">{feat}</span>
                </li>
              ))}
            </ul>

            {/* Primary Plan Action Controls */}
            <div
              className={
                billing.planId === 'free' || billing.cancelAtPeriodEnd
                  ? 'wb-pane-grid-2'
                  : 'flex flex-col'
              }
            >
              <button
                type="button"
                data-no-drag-scroll="true"
                aria-expanded={switchPlanOpen}
                onClick={() => {
                  setSelectedPlanDraft(billing.planId);
                  setCancelPromptOpen(false);
                  setSwitchPlanOpen((o) => !o);
                }}
                className="min-h-[44px] w-full rounded-xl px-4 text-xs font-semibold"
                style={{
                  backgroundColor: 'var(--brand-action-bg)',
                  color: 'var(--brand-action-fg)',
                }}
              >
                Switch Plan
              </button>

              {billing.planId !== 'free' && billing.cancelAtPeriodEnd ? (
                <button
                  type="button"
                  data-no-drag-scroll="true"
                  onClick={handleResumeSubscription}
                  className="min-h-[44px] rounded-xl border border-[var(--brand-accent-border)] bg-[var(--surface-card)] px-4 text-xs font-semibold text-[var(--brand-accent-text)] hover:bg-[var(--surface-hover)]"
                >
                  Resume Subscription
                </button>
              ) : billing.planId === 'free' ? (
                <button
                  type="button"
                  data-no-drag-scroll="true"
                  onClick={() => {
                    setSelectedPlanDraft('plus_monthly');
                    setSwitchPlanOpen(true);
                  }}
                  className="min-h-[44px] rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] px-4 text-xs font-semibold text-[var(--ink-primary)] hover:bg-[var(--surface-hover)]"
                >
                  Upgrade to Plus
                </button>
              ) : null}
            </div>

            {billingFeedback && (
              <p
                role="status"
                aria-live="polite"
                className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] px-3 py-2 text-xs font-medium text-[var(--ink-secondary)]"
              >
                {billingFeedback}
              </p>
            )}

            {/* Inline Plan Switcher Comparison */}
            {switchPlanOpen && (
              <div
                role="region"
                aria-label="Compare and switch subscription plan"
                className="space-y-3 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-3.5"
              >
                <p className="text-xs font-semibold text-[var(--ink-secondary)]">
                  Choose a plan — effective immediately with transparent pricing
                </p>
                <div className="grid grid-cols-1 gap-2" role="radiogroup" aria-label="Subscription tiers">
                  {PLAN_OPTIONS.map((plan) => {
                    const selected = selectedPlanDraft === plan.id;
                    const isCurrent = billing.planId === plan.id;
                    return (
                      <button
                        key={plan.id}
                        type="button"
                        role="radio"
                        data-no-drag-scroll="true"
                        aria-checked={selected}
                        onClick={() => setSelectedPlanDraft(plan.id)}
                        className="wb-pane-item-card min-h-[56px] w-full rounded-xl border p-3 text-left transition-colors"
                        style={
                          selected
                            ? {
                                backgroundColor: 'var(--brand-accent-soft)',
                                borderColor: 'var(--brand-accent-border)',
                              }
                            : {
                                backgroundColor: 'var(--surface-subtle)',
                                borderColor: 'var(--border-hairline)',
                              }
                        }
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                            <span className="text-sm font-semibold leading-snug text-[var(--ink-primary)]">
                              {plan.shortName}
                            </span>
                            {plan.savingsHint && (
                              <span
                                className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold"
                                style={{ color: 'var(--brand-accent-text)' }}
                              >
                                <span aria-hidden="true">·</span>
                                <span>{plan.savingsHint}</span>
                              </span>
                            )}
                            {isCurrent && (
                              <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-[var(--ink-muted)]">
                                <span aria-hidden="true">·</span>
                                <span>Current</span>
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 break-words text-xs leading-relaxed text-[var(--ink-muted)]">
                            {plan.features[0]}
                          </p>
                        </div>
                        <span className="shrink-0 font-mono-tabular text-sm font-bold text-[var(--ink-primary)]">
                          {plan.priceLabel}
                          <span className="ml-0.5 text-xs font-normal text-[var(--ink-muted)]">
                            {plan.cadenceLabel}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Clear Effective Date & New Price Preview */}
                {(() => {
                  const target = PLAN_OPTIONS.find((p) => p.id === selectedPlanDraft) ?? PLAN_OPTIONS[0];
                  return (
                    <div className="wb-pane-header-row border-t border-[var(--border-hairline)] pt-3">
                      <p className="min-w-0 text-xs text-[var(--ink-secondary)]">
                        Effective <strong className="text-[var(--ink-primary)]">Today</strong>:{' '}
                        <span className="font-mono-tabular font-semibold text-[var(--ink-primary)]">
                          {target.priceLabel} {target.cadenceLabel}
                        </span>
                      </p>
                      <div className="wb-pane-item-actions">
                        <button
                          type="button"
                          data-no-drag-scroll="true"
                          onClick={() => setSwitchPlanOpen(false)}
                          className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[var(--border-hairline)] px-3.5 text-xs font-semibold text-[var(--ink-secondary)]"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          data-no-drag-scroll="true"
                          onClick={handleConfirmPlanChange}
                          className="inline-flex min-h-[44px] items-center justify-center rounded-xl px-4 py-2 text-center text-xs font-semibold leading-snug"
                          style={{
                            backgroundColor: 'var(--brand-action-bg)',
                            color: 'var(--brand-action-fg)',
                          }}
                        >
                          Confirm Plan Change
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {/* 2. Compact Collapsible Billing History & Receipts */}
          {(() => {
            const invoicePills: BentoSummaryPill[] = [
              {
                label: `${billing.invoices.length} ${billing.invoices.length === 1 ? 'Receipt' : 'Receipts'}`,
                tone: 'neutral',
              },
              ...(billing.invoices[0]
                ? [{ label: `Latest ${billing.invoices[0].amount}`, tone: 'accent' as const }]
                : []),
            ];
            return (
              <SettingsBentoAccordion
                id="billing-history"
                title={a11y.plainLanguage ? 'Past Payments & Receipts' : 'Billing History & Receipts'}
                subtitle="View past invoices, print statements, or download receipts"
                icon={<Receipt className="h-4 w-4" />}
                pills={invoicePills}
                isOpen={openSubAccordionId === 'billing-history'}
                onToggle={() => onToggleSubAccordion?.('billing-history')}
              >
                <div className="divide-y divide-[var(--border-hairline)] rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)]">
                  {billing.invoices.map((inv) => (
                    <div key={inv.id} className="wb-pane-item-card p-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                          <p className="break-words text-xs font-semibold leading-snug text-[var(--ink-primary)]">
                            {inv.description}
                          </p>
                          <span className="shrink-0 font-mono-tabular text-xs font-bold text-[var(--ink-primary)]">
                            {inv.amount}
                          </span>
                        </div>
                        <p className="mt-0.5 break-words text-[11px] leading-relaxed text-[var(--ink-muted)] tabular-nums">
                          {inv.date} · {inv.invoiceNumber}{' '}
                          <span
                            className="inline-flex items-center gap-1 whitespace-nowrap font-semibold"
                            style={{
                              color:
                                inv.status === 'Paid'
                                  ? 'var(--brand-accent-text)'
                                  : 'var(--ink-secondary)',
                            }}
                          >
                            <span aria-hidden="true">·</span>
                            <span>{inv.status}</span>
                          </span>
                        </p>
                      </div>

                      <div className="wb-pane-item-actions">
                        <button
                          type="button"
                          data-no-drag-scroll="true"
                          onClick={() => setActiveReceipt(inv)}
                          className="inline-flex min-h-[44px] items-center justify-center whitespace-nowrap rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3.5 text-xs font-semibold text-[var(--ink-primary)] hover:bg-[var(--surface-hover)]"
                        >
                          Receipt
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </SettingsBentoAccordion>
            );
          })()}

          {/* 3. Thoughtfully Separated Subscription Cancellation (Zero Dark Patterns, Lower Visual Weight) */}
          {billing.planId !== 'free' && !billing.cancelAtPeriodEnd && (
            <div className="border-t border-[var(--border-hairline)] pt-4">
              <div className="space-y-3 rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] p-4">
                <div className="wb-pane-header-row">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-xs font-semibold text-[var(--ink-primary)]">
                      Cancel Subscription
                    </h3>
                    <p className="wb-prose mt-0.5 text-xs leading-relaxed text-[var(--ink-muted)]">
                      Stop auto-renewal anytime. Access continues through {billing.renewalDate},
                      and your local mood logs stay untouched.
                    </p>
                  </div>
                  <div className="wb-pane-item-actions">
                    <button
                      type="button"
                      data-no-drag-scroll="true"
                      aria-expanded={cancelPromptOpen}
                      onClick={() => {
                        setSwitchPlanOpen(false);
                        setCancelPromptOpen((o) => !o);
                      }}
                      className="inline-flex min-h-[44px] items-center justify-center whitespace-nowrap rounded-xl border border-[var(--q-red-border)] bg-[var(--surface-card)] px-4 text-xs font-semibold text-[var(--q-red-fg)] hover:bg-[var(--q-red-bg)]"
                    >
                      Cancel Subscription
                    </button>
                  </div>
                </div>

                {cancelPromptOpen && (
                  <div
                    role="region"
                    aria-label="Confirm subscription cancellation"
                    className="space-y-3 rounded-xl border border-[var(--border-strong)] bg-[var(--surface-card)] p-3.5"
                  >
                    <p className="text-sm font-semibold text-[var(--ink-primary)]">
                      Cancel {currentPlan.name}?
                    </p>
                    <p className="wb-prose text-xs text-[var(--ink-secondary)]">
                      Your paid features remain available through{' '}
                      <strong className="font-mono-tabular text-[var(--ink-primary)]">
                        {billing.renewalDate}
                      </strong>
                      . After that date, your account moves to WELLBE+ Free with zero future
                      charges, and all local mood logs remain untouched.
                    </p>
                    <div className="wb-pane-item-actions pt-1">
                      <button
                        type="button"
                        data-no-drag-scroll="true"
                        onClick={() => setCancelPromptOpen(false)}
                        className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3.5 py-2 text-center text-xs font-semibold leading-snug text-[var(--ink-primary)]"
                      >
                        Keep Current Plan
                      </button>
                      <button
                        type="button"
                        data-no-drag-scroll="true"
                        onClick={handleConfirmCancelSubscription}
                        className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[var(--q-red-border)] bg-[var(--q-red-bg)] px-4 py-2 text-center text-xs font-semibold leading-snug text-[var(--q-red-fg)]"
                      >
                        Confirm Cancellation
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ====================================================================
          SUB-DRAWER: PRINTABLE / DOWNLOADABLE RECEIPT PREVIEW (Portaled + Focus-Trapped)
          ==================================================================== */}
      {activeReceipt &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            style={{ zIndex: 'var(--z-command)', backgroundColor: 'var(--scrim-bg)' }}
            className="fixed inset-0 flex items-center justify-center p-3 sm:p-4"
            onClick={() => setActiveReceipt(null)}
          >
            <div
              ref={receiptModalRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="receipt-preview-title"
              tabIndex={-1}
              className="wb-surface max-h-[calc(100dvh-2rem)] w-full max-w-md space-y-4 overflow-y-auto rounded-3xl p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-[var(--brand-accent-text)]">
                    WELLBE+ Billing Receipt
                  </p>
                  <h3
                    id="receipt-preview-title"
                    className="mt-0.5 break-words font-mono-tabular text-base font-semibold text-[var(--ink-primary)]"
                  >
                    {activeReceipt.invoiceNumber}
                  </h3>
                </div>
                <button
                  type="button"
                  data-no-drag-scroll="true"
                  aria-label="Close receipt preview"
                  onClick={() => setActiveReceipt(null)}
                  className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl text-[var(--ink-muted)] hover:bg-[var(--surface-hover)]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <dl className="divide-y divide-[var(--border-hairline)] rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-4 text-xs">
                <div className="flex items-baseline justify-between gap-3 py-2.5">
                  <dt className="shrink-0 text-[var(--ink-muted)]">Invoice Date</dt>
                  <dd className="min-w-0 text-right font-mono-tabular font-semibold text-[var(--ink-primary)]">
                    {activeReceipt.date}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3 py-2.5">
                  <dt className="shrink-0 text-[var(--ink-muted)]">Status</dt>
                  <dd className="min-w-0 text-right font-semibold text-[var(--ink-primary)]">
                    {activeReceipt.status}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3 py-2.5">
                  <dt className="shrink-0 text-[var(--ink-muted)]">Billed To</dt>
                  <dd className="min-w-0 break-words text-right font-semibold text-[var(--ink-primary)]">
                    {profile.displayName}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3 py-2.5">
                  <dt className="shrink-0 text-[var(--ink-muted)]">Payment Method</dt>
                  <dd className="min-w-0 break-words text-right font-mono-tabular font-semibold text-[var(--ink-primary)]">
                    {activeReceipt.paymentSummary}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3 py-2.5">
                  <dt className="shrink-0 text-[var(--ink-muted)]">Plan</dt>
                  <dd className="min-w-0 break-words text-right font-semibold text-[var(--ink-primary)]">
                    {activeReceipt.description}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3 py-2.5">
                  <dt className="shrink-0 text-[var(--ink-muted)]">Billing Period</dt>
                  <dd className="min-w-0 break-words text-right font-mono-tabular text-[var(--ink-secondary)]">
                    {activeReceipt.period}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3 py-3 text-sm">
                  <dt className="shrink-0 font-semibold text-[var(--ink-primary)]">Total</dt>
                  <dd className="min-w-0 text-right font-mono-tabular font-bold text-[var(--ink-primary)]">
                    {activeReceipt.amount}
                  </dd>
                </div>
              </dl>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  data-no-drag-scroll="true"
                  onClick={() => window.print()}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3 text-xs font-semibold text-[var(--ink-primary)] hover:bg-[var(--surface-hover)]"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Print</span>
                </button>
                <button
                  type="button"
                  data-no-drag-scroll="true"
                  onClick={() => {
                    downloadFile(
                      `wellbe-receipt-${activeReceipt.invoiceNumber}.txt`,
                      buildReceiptPlainText(activeReceipt, profile.displayName, profile.email),
                      'text/plain;charset=utf-8'
                    );
                    emitStatus(`Downloaded TXT receipt ${activeReceipt.invoiceNumber}.`);
                  }}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3 text-xs font-semibold text-[var(--ink-primary)] hover:bg-[var(--surface-hover)]"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>.txt</span>
                </button>
                <button
                  type="button"
                  data-no-drag-scroll="true"
                  onClick={() => {
                    downloadFile(
                      `wellbe-receipt-${activeReceipt.invoiceNumber}.html`,
                      buildReceiptHtml(activeReceipt, profile.displayName, profile.email),
                      'text/html;charset=utf-8'
                    );
                    emitStatus(`Downloaded HTML receipt ${activeReceipt.invoiceNumber}.`);
                  }}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-3.5 text-xs font-semibold"
                  style={{
                    backgroundColor: 'var(--brand-action-bg)',
                    color: 'var(--brand-action-fg)',
                  }}
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download .html</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
