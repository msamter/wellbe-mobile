export const ACCOUNT_STORAGE_KEY = 'wellbe_account_v1';
const LEGACY_PROFILE_STORAGE_KEY = 'wellbe_profile_v1';
export const MAX_AVATAR_BYTES = 1_500_000; // 1.5 MB safe localStorage cap

export type OAuthProviderId = 'google' | 'apple' | 'microsoft';

export interface OAuthProviderState {
  connected: boolean;
  accountHint: string;
}

export interface AvatarPreset {
  id: string;
  label: string;
  bg: string;
  fg: string;
  border: string;
}

export const AVATAR_PRESETS: AvatarPreset[] = [
  {
    id: 'indigo',
    label: 'Electric Indigo',
    bg: 'linear-gradient(135deg, #3A00E5 0%, #1A004D 100%)',
    fg: '#FEFEFE',
    border: 'rgba(191, 178, 255, 0.48)',
  },
  {
    id: 'lavender',
    label: 'Soft Lavender',
    bg: 'linear-gradient(135deg, #BFB2FF 0%, #8C78F6 100%)',
    fg: '#09001A',
    border: 'rgba(26, 0, 77, 0.28)',
  },
  {
    id: 'chartreuse',
    label: 'Brand Chartreuse',
    bg: 'linear-gradient(135deg, #EAFF00 0%, #C6DC00 100%)',
    fg: '#09001A',
    border: 'rgba(9, 0, 26, 0.3)',
  },
  {
    id: 'plum',
    label: 'Deep Plum',
    bg: 'linear-gradient(135deg, #1A004D 0%, #09001A 100%)',
    fg: '#BFB2FF',
    border: 'rgba(191, 178, 255, 0.42)',
  },
  {
    id: 'obsidian',
    label: 'Obsidian Slate',
    bg: 'linear-gradient(135deg, #1B544A 0%, #0F352E 100%)',
    fg: '#FEFEFE',
    border: 'rgba(94, 199, 167, 0.45)',
  },
];

export type PlanTierId = 'free' | 'plus_monthly' | 'plus_annual';

export interface PlanOption {
  id: PlanTierId;
  name: string;
  shortName: string;
  priceLabel: string;
  cadenceLabel: string;
  amount: number;
  savingsHint?: string;
  features: string[];
}

export const PLAN_OPTIONS: PlanOption[] = [
  {
    id: 'free',
    name: 'WELLBE+ Free',
    shortName: 'Free',
    priceLabel: '$0',
    cadenceLabel: '/ month',
    amount: 0,
    features: [
      '16-emotion mood check-in grid & private local journal',
      'Core 4-7-8 calm breathing & grounding resets',
      '7-day emotional trend overview',
    ],
  },
  {
    id: 'plus_monthly',
    name: 'WELLBE+ Plus Monthly',
    shortName: 'WELLBE+ Plus Monthly',
    priceLabel: '$9.99',
    cadenceLabel: '/ month',
    amount: 9.99,
    features: [
      'Unlimited AI Wellness Coach & adaptive somatic sequences',
      '30-day Pixel Watch HRV, sleep & burnout correlations',
      'Printable Therapist Summaries & predictive check-in nudges',
    ],
  },
  {
    id: 'plus_annual',
    name: 'WELLBE+ Plus Annual',
    shortName: 'WELLBE+ Plus Annual',
    priceLabel: '$79.99',
    cadenceLabel: '/ year',
    amount: 79.99,
    savingsHint: 'Save 33%',
    features: [
      'Everything in WELLBE+ Plus ($6.67 / month equivalent)',
      'Priority wearable sync telemetry & full 30-day D3 heatmaps',
      'Cancel any time in one click with full access through term end',
    ],
  },
];

export interface BillingInvoice {
  id: string;
  invoiceNumber: string;
  date: string;
  description: string;
  amount: string;
  status: 'Paid' | 'Refunded';
  paymentSummary: string;
  period: string;
}

export interface AccountState {
  profile: {
    displayName: string;
    handle: string;
    avatarMode: 'preset' | 'upload';
    avatarPresetId: string;
    avatarDataUrl: string | null;
    email: string;
    emailVerified: boolean;
    phone: string;
    phoneVerified: boolean;
    providers: Record<OAuthProviderId, OAuthProviderState>;
  };
  security: {
    hasPassword: boolean;
    passwordUpdatedAt: string;
    faceIdEnabled: boolean;
    fingerprintEnabled: boolean;
  };
  billing: {
    planId: PlanTierId;
    cancelAtPeriodEnd: boolean;
    renewalDate: string;
    invoices: BillingInvoice[];
  };
}

export const DEFAULT_ACCOUNT_STATE: AccountState = {
  profile: {
    displayName: 'Alex Rivera',
    handle: 'alex_rivera',
    avatarMode: 'preset',
    avatarPresetId: 'indigo',
    avatarDataUrl: null,
    email: 'alex.rivera@wellbe.app',
    emailVerified: true,
    phone: '+1 (415) 555-0194',
    phoneVerified: true,
    providers: {
      google: { connected: true, accountHint: 'a***a@gmail.com' },
      apple: { connected: false, accountHint: 'a***@privaterelay.appleid.com' },
      microsoft: { connected: false, accountHint: 'a***a@outlook.com' },
    },
  },
  security: {
    hasPassword: true,
    passwordUpdatedAt: 'Oct 14, 2026',
    faceIdEnabled: true,
    fingerprintEnabled: true,
  },
  billing: {
    planId: 'plus_monthly',
    cancelAtPeriodEnd: false,
    renewalDate: 'Dec 21, 2026',
    invoices: [
      {
        id: 'inv-2026-11',
        invoiceNumber: 'WB-2026-1121',
        date: 'Nov 21, 2026',
        description: 'WELLBE+ Plus Monthly',
        amount: '$9.99',
        status: 'Paid',
        paymentSummary: 'Visa •••• 4242',
        period: 'Nov 21, 2026 – Dec 21, 2026',
      },
      {
        id: 'inv-2026-10',
        invoiceNumber: 'WB-2026-1021',
        date: 'Oct 21, 2026',
        description: 'WELLBE+ Plus Monthly',
        amount: '$9.99',
        status: 'Paid',
        paymentSummary: 'Visa •••• 4242',
        period: 'Oct 21, 2026 – Nov 21, 2026',
      },
      {
        id: 'inv-2026-09',
        invoiceNumber: 'WB-2026-0921',
        date: 'Sep 21, 2026',
        description: 'WELLBE+ Plus Monthly',
        amount: '$9.99',
        status: 'Paid',
        paymentSummary: 'Google Pay',
        period: 'Sep 21, 2026 – Oct 21, 2026',
      },
      {
        id: 'inv-2026-08',
        invoiceNumber: 'WB-2026-0828',
        date: 'Aug 28, 2026',
        description: 'WELLBE+ Annual Upgrade Adjustment',
        amount: '$10.00',
        status: 'Refunded',
        paymentSummary: 'Visa •••• 4242',
        period: 'Prorated credit adjustment',
      },
    ],
  },
};

export function sanitizeHandle(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/^@+/, '')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 24);
}

export function formatPhoneDisplay(raw: string): string {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return trimmed;
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'WB';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

export function generateSixDigitCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function formatShortDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function evaluatePasswordStrength(pw: string): {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
} {
  if (!pw) return { score: 0, label: 'Enter a new password' };
  let points = 0;
  if (pw.length >= 8) points++;
  if (pw.length >= 12) points++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) points++;
  if (/\d/.test(pw)) points++;
  if (/[^A-Za-z0-9]/.test(pw)) points++;

  if (pw.length < 8 || points <= 1) return { score: 1, label: 'Weak' };
  if (points === 2) return { score: 2, label: 'Fair' };
  if (points === 3 || points === 4) return { score: 3, label: 'Good' };
  return { score: 4, label: 'Strong' };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildReceiptPlainText(
  invoice: BillingInvoice,
  accountHolder: string,
  accountEmail: string
): string {
  return [
    'WELLBE+ OFFICIAL RECEIPT',
    '========================================',
    `Invoice Number:  ${invoice.invoiceNumber}`,
    `Invoice Date:    ${invoice.date}`,
    `Status:          ${invoice.status}`,
    '',
    `Billed To:       ${accountHolder}`,
    `Account Email:   ${accountEmail}`,
    `Payment Method:  ${invoice.paymentSummary}`,
    '',
    'Itemized Summary',
    '----------------------------------------',
    `${invoice.description}`,
    `Billing Period:  ${invoice.period}`,
    `Total Amount:    ${invoice.amount}`,
    '========================================',
    'WELLBE+ Wellness Systems · Local Demo Receipt',
  ].join('\n');
}

export function buildReceiptHtml(
  invoice: BillingInvoice,
  accountHolder: string,
  accountEmail: string
): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>WELLBE+ Receipt ${escapeHtml(invoice.invoiceNumber)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #09001A; background: #F6F5F1; margin: 0; padding: 32px; }
    .card { max-width: 560px; margin: 0 auto; background: #FEFEFE; border: 1px solid #DCDCE4; border-radius: 16px; padding: 28px; }
    .brand { font-weight: 800; letter-spacing: -0.02em; font-size: 18px; color: #3A00E5; }
    h1 { font-size: 20px; margin: 12px 0 4px; }
    .meta { font-size: 13px; color: #4A4A5A; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px; }
    td { padding: 10px 0; border-bottom: 1px solid #EAEAEF; }
    td:last-child { text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; }
    .total td { border-top: 2px solid #1A004D; border-bottom: none; font-size: 16px; font-weight: 700; padding-top: 14px; }
    .foot { margin-top: 20px; font-size: 12px; color: #5A5A6A; }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand">WELLBE+</div>
    <h1>Receipt ${escapeHtml(invoice.invoiceNumber)}</h1>
    <div class="meta">${escapeHtml(invoice.date)} &middot; Status: ${escapeHtml(invoice.status)}</div>
    <table>
      <tr><td>Billed To</td><td>${escapeHtml(accountHolder)}</td></tr>
      <tr><td>Email</td><td>${escapeHtml(accountEmail)}</td></tr>
      <tr><td>Payment Method</td><td>${escapeHtml(invoice.paymentSummary)}</td></tr>
      <tr><td>Description</td><td>${escapeHtml(invoice.description)}</td></tr>
      <tr><td>Billing Period</td><td>${escapeHtml(invoice.period)}</td></tr>
      <tr class="total"><td>Total</td><td>${escapeHtml(invoice.amount)}</td></tr>
    </table>
    <div class="foot">WELLBE+ Wellness Systems &middot; Consumer-transparent billing receipt.</div>
  </div>
</body>
</html>`;
}

function sanitizeProviders(
  raw: unknown
): Record<OAuthProviderId, OAuthProviderState> {
  const input = (raw && typeof raw === 'object' ? raw : {}) as Partial<
    Record<OAuthProviderId, Partial<OAuthProviderState>>
  >;
  return {
    google: {
      connected:
        typeof input.google?.connected === 'boolean'
          ? input.google.connected
          : DEFAULT_ACCOUNT_STATE.profile.providers.google.connected,
      accountHint:
        typeof input.google?.accountHint === 'string' && input.google.accountHint.trim()
          ? input.google.accountHint.trim()
          : DEFAULT_ACCOUNT_STATE.profile.providers.google.accountHint,
    },
    apple: {
      connected:
        typeof input.apple?.connected === 'boolean'
          ? input.apple.connected
          : DEFAULT_ACCOUNT_STATE.profile.providers.apple.connected,
      accountHint:
        typeof input.apple?.accountHint === 'string' && input.apple.accountHint.trim()
          ? input.apple.accountHint.trim()
          : DEFAULT_ACCOUNT_STATE.profile.providers.apple.accountHint,
    },
    microsoft: {
      connected:
        typeof input.microsoft?.connected === 'boolean'
          ? input.microsoft.connected
          : DEFAULT_ACCOUNT_STATE.profile.providers.microsoft.connected,
      accountHint:
        typeof input.microsoft?.accountHint === 'string' && input.microsoft.accountHint.trim()
          ? input.microsoft.accountHint.trim()
          : DEFAULT_ACCOUNT_STATE.profile.providers.microsoft.accountHint,
    },
  };
}

function sanitizeProfileBlock(raw: unknown): AccountState['profile'] {
  const parsed = (raw && typeof raw === 'object' ? raw : {}) as Partial<AccountState['profile']>;
  const avatarDataUrl =
    typeof parsed.avatarDataUrl === 'string' &&
    /^data:image\/(png|jpe?g|webp|gif|avif);base64,/i.test(parsed.avatarDataUrl) &&
    parsed.avatarDataUrl.length <= MAX_AVATAR_BYTES * 1.45
      ? parsed.avatarDataUrl
      : null;
  const presetId =
    typeof parsed.avatarPresetId === 'string' &&
    AVATAR_PRESETS.some((p) => p.id === parsed.avatarPresetId)
      ? parsed.avatarPresetId
      : parsed.avatarPresetId === 'monochrome'
        ? 'obsidian'
        : DEFAULT_ACCOUNT_STATE.profile.avatarPresetId;

  return {
    displayName:
      typeof parsed.displayName === 'string' && parsed.displayName.trim()
        ? parsed.displayName.trim().slice(0, 48)
        : DEFAULT_ACCOUNT_STATE.profile.displayName,
    handle:
      typeof parsed.handle === 'string' && sanitizeHandle(parsed.handle).length >= 3
        ? sanitizeHandle(parsed.handle)
        : DEFAULT_ACCOUNT_STATE.profile.handle,
    avatarMode: parsed.avatarMode === 'upload' && avatarDataUrl ? 'upload' : 'preset',
    avatarPresetId: presetId,
    avatarDataUrl,
    email:
      typeof parsed.email === 'string' && isValidEmail(parsed.email)
        ? parsed.email.trim()
        : DEFAULT_ACCOUNT_STATE.profile.email,
    emailVerified:
      typeof parsed.emailVerified === 'boolean'
        ? parsed.emailVerified
        : DEFAULT_ACCOUNT_STATE.profile.emailVerified,
    phone:
      typeof parsed.phone === 'string' && parsed.phone.trim()
        ? parsed.phone.trim()
        : DEFAULT_ACCOUNT_STATE.profile.phone,
    phoneVerified:
      typeof parsed.phoneVerified === 'boolean'
        ? parsed.phoneVerified
        : DEFAULT_ACCOUNT_STATE.profile.phoneVerified,
    providers: sanitizeProviders(parsed.providers),
  };
}

export function loadAccountState(): AccountState {
  if (typeof window === 'undefined') return DEFAULT_ACCOUNT_STATE;
  try {
    const rawAccount = window.localStorage.getItem(ACCOUNT_STORAGE_KEY);
    if (rawAccount) {
      const parsed = JSON.parse(rawAccount) as Partial<AccountState> | null;
      if (parsed && typeof parsed === 'object') {
        const profile = sanitizeProfileBlock(parsed.profile);

        const secIn = (parsed.security && typeof parsed.security === 'object'
          ? parsed.security
          : {}) as Partial<AccountState['security']>;

        // Safely construct streamlined security state, stripping any legacy passkeys/mfa/sessions keys
        const security: AccountState['security'] = {
          hasPassword:
            typeof secIn.hasPassword === 'boolean'
              ? secIn.hasPassword
              : DEFAULT_ACCOUNT_STATE.security.hasPassword,
          passwordUpdatedAt:
            typeof secIn.passwordUpdatedAt === 'string' && secIn.passwordUpdatedAt.trim()
              ? secIn.passwordUpdatedAt.trim()
              : DEFAULT_ACCOUNT_STATE.security.passwordUpdatedAt,
          faceIdEnabled:
            typeof secIn.faceIdEnabled === 'boolean'
              ? secIn.faceIdEnabled
              : DEFAULT_ACCOUNT_STATE.security.faceIdEnabled,
          fingerprintEnabled:
            typeof secIn.fingerprintEnabled === 'boolean'
              ? secIn.fingerprintEnabled
              : DEFAULT_ACCOUNT_STATE.security.fingerprintEnabled,
        };

        // Ensure at least one active sign-in method (OAuth provider or password) remains valid
        const oauthCount = Object.values(profile.providers).filter((p) => p.connected).length;
        if (oauthCount === 0 && !security.hasPassword) {
          profile.providers.google.connected = true;
        }

        const billIn = (parsed.billing && typeof parsed.billing === 'object'
          ? parsed.billing
          : {}) as Partial<AccountState['billing']>;

        const validPlanId: PlanTierId =
          billIn.planId === 'free' ||
          billIn.planId === 'plus_monthly' ||
          billIn.planId === 'plus_annual'
            ? billIn.planId
            : DEFAULT_ACCOUNT_STATE.billing.planId;

        const invoices: BillingInvoice[] = Array.isArray(billIn.invoices)
          ? billIn.invoices
              .filter(
                (inv): inv is BillingInvoice =>
                  Boolean(inv) &&
                  typeof inv.id === 'string' &&
                  typeof inv.invoiceNumber === 'string' &&
                  typeof inv.date === 'string' &&
                  typeof inv.description === 'string' &&
                  typeof inv.amount === 'string' &&
                  (inv.status === 'Paid' || inv.status === 'Refunded')
              )
              .slice(0, 24)
          : DEFAULT_ACCOUNT_STATE.billing.invoices;

        return {
          profile,
          security,
          billing: {
            planId: validPlanId,
            cancelAtPeriodEnd:
              validPlanId === 'free' ? false : Boolean(billIn.cancelAtPeriodEnd),
            renewalDate:
              typeof billIn.renewalDate === 'string' && billIn.renewalDate.trim()
                ? billIn.renewalDate.trim()
                : DEFAULT_ACCOUNT_STATE.billing.renewalDate,
            invoices:
              invoices.length > 0 ? invoices : DEFAULT_ACCOUNT_STATE.billing.invoices,
          },
        };
      }
    }

    // Safe one-way migration from legacy wellbe_profile_v1 if present
    const rawLegacy = window.localStorage.getItem(LEGACY_PROFILE_STORAGE_KEY);
    if (rawLegacy) {
      const legacyParsed = JSON.parse(rawLegacy);
      if (legacyParsed && typeof legacyParsed === 'object') {
        const migratedProfile = sanitizeProfileBlock(legacyParsed);
        const migratedState: AccountState = {
          ...DEFAULT_ACCOUNT_STATE,
          profile: migratedProfile,
        };
        try {
          window.localStorage.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify(migratedState));
        } catch {
          // Ignore write failures in private mode
        }
        return migratedState;
      }
    }
  } catch {
    return DEFAULT_ACCOUNT_STATE;
  }
  return DEFAULT_ACCOUNT_STATE;
}

export function saveAccountState(state: AccountState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota or private mode errors
  }
}
