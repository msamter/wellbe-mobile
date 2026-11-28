# AGENTS.md — WELLBE+ Mobile Project Guardrails

This document defines the technical stack, design tokens, accessibility requirements, and embedding/external-link rules for **WELLBE+ Mobile** (`v3.0.0`). Every coding agent modifying this repository MUST follow these guardrails.

---

## 1. Tech Stack & Architecture

- **Frontend:** React 19 (`react` / `react-dom`), TypeScript (`tsc --noEmit` via `npm run lint`), Vite 8 (Rolldown bundler), Tailwind CSS v4 (`@tailwindcss/vite`).
  - Dark mode uses Tailwind v4's class-based custom variant (`@custom-variant dark (&:where(.dark, .dark *));`) toggled on `<html>` (`document.documentElement.classList`).
- **Motion & UI:** `motion` (`motion/react`) with Material 3 Expressive springs (`src/design/m3ExpressiveTokens.ts`) and primitives (`src/components/ExpressiveControls.tsx`), plus `lucide-react` icons.
- **Data Visualization:** `recharts` (`src/components/TrendsTab.tsx`) plus lightweight React/SVG visualizations (`src/components/HeatmapD3.tsx`, `src/components/BurnoutGauge.tsx`).
- **Server & AI Integration:** Express 4 (`server.ts`, port `3000`) serving Vite middleware in dev (`npm run dev` via `tsx server.ts`) and static `dist/` with SPA fallback in production (`npm start` / Vercel).
  - Server-side Gemini endpoints via `@google/genai`:
    - `POST /api/coach` (`gemini-4-hydrogen`) — contextual wellness coaching.
    - `POST /api/tts` (`gemini-3.8-flash-lite-tts` on `v1beta` with in-memory LRU cache) — calm female voiceover synthesis (`Kore` / `Vindemiatrix`).
  - **Strict Secret & Privacy Boundary:** Never expose `GEMINI_API_KEY` or call Gemini APIs directly from browser code. All AI/TTS requests must stay server-side behind `/api/*`. Never transmit user journal history while browsing Today, Routines, Mood Log, or Trends.
- **Local-First Persistence:** Mood entries, biometrics, routines, nudges, settings, coach messages, wearables, and accessibility preferences live in `localStorage` (`wellbe_v1_*` and `wellbe_a11y_v1`). Always read/write through guarded helpers (`safeReadStorage`, `safeWriteStorage`, and `sanitize*` validators in `src/utils/storage.ts`) so malformed or unavailable storage never crashes the app.
- **Build, Preview & Deployment Constraints:**
  - `npm run lint` → `tsc --noEmit`
  - `npm run build` → `vite build` (preserves Rolldown vendor chunk splitting for `vendor-react`, `vendor-charts`, `vendor-motion`, `vendor-icons`, and copies non-`aistudio` assets from `src/assets`).
  - Preserve `DISABLE_HMR === 'true'` gating in `vite.config.ts` and `server.ts` so AI Studio / automated edit sessions do not flicker or burn CPU watching files.
  - Deployment target is Vercel (`vercel.json` installs with `npm install --legacy-peer-deps` and rewrites non-`api/`/`assets/`/`_vercel/` routes to `/index.html`). Keep `/_vercel` returning `404` on non-Vercel servers in `server.ts`.

---

## 2. Typography & Color Tokens

All visual styling is anchored in `src/index.css` and `src/design/m3ExpressiveTokens.ts`. **Do not hardcode raw hex/RGB colors for surfaces, ink, borders, accents, or RULER quadrants in components**—always consume the semantic CSS variables so Light, Dark, Calm, High-Contrast, and Reduce-Transparency modes stay synchronized automatically.

### 2.1 Typography Tokens & Rules

| Token / Utility | Value / Behavior | Required Usage |
| --- | --- | --- |
| `--font-sans` | `'Roboto Flex', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif` | Default UI & body font (`font-optical-sizing: auto`; Google Fonts variable axis `opsz,wght@8..144,400..700` loaded in `index.html`). |
| `--font-mono` | `'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace` | Technical readouts, version tags, crisis/helpline numbers, and biometric readouts. |
| `.font-mono-tabular` / `.tabular-nums` | `font-variant-numeric: tabular-nums` (also applied automatically to `<time>`) | Required on all scores, timers, dates, streaks, metrics, and phone numbers to prevent layout jitter. |
| `.wb-prose` | Readable prose container | Apply to multi-line descriptions, journal notes, legal copy, and coach reflections so **Reading Comfort** mode enforces `max-width: 60ch`, `text-align: left`, `line-height: 1.68`, `letter-spacing: 0.025em`, `word-spacing: 0.08em`, and strips italics. |
| Headings (`h1`–`h4`) | `text-wrap: balance` | Automatically balanced inside `.wb-app-root`, `.wb-settings-drawer`, and `.wb-quick-checkin-card`. |

- Do not introduce additional third-party web font families without explicit approval.
- Keep `body` font smoothing (`antialiased`) and dark-mode tracking (`letter-spacing: 0.008em` on `.dark body`) intact.

### 2.2 Color Tokens

#### Core Semantic Palette Primitives (`:root` in `src/index.css`)
- `--palette-chartreuse`: `#EAFF00` (high-arousal highlight; automatically muted in Calm Mode)
- `--palette-electric-indigo`: `#3A00E5`
- `--palette-soft-lavender`: `#BFB2FF`
- `--palette-deep-plum`: `#1A004D`
- `--palette-near-black`: `#09001A`
- `--palette-near-white`: `#FEFEFE`

#### Architectural Surfaces & Ink (60% Neutral Canvas, <4% Saturation)
- **Surfaces:** `--surface-canvas` (Light `#F6F5F1` / Dark `#0D1110`), `--surface-card` (`#FEFEFE` / `#151B19`), `--surface-subtle` (`#EFEDE7` / `#1D2522`), `--surface-hover` (`#E7E4DC` / `#26302D`), `--surface-elevated`, `--scrim-bg`.
- **Ink & Borders:** `--ink-primary` (`#161916` / `#F2F5F2`), `--ink-secondary` (`#3E453F` / `#C5CFC8`), `--ink-muted` (`#555D56` / `#9BA89F`), `--border-hairline`, `--border-strong`.
- **Brand, Action & Biometric Accents:** `--accent-primary` (`#1B544A` / `#5EC7A7`), `--accent-primary-hover`, `--accent-primary-ink`, `--accent-soft`, `--accent-highlight` / `--accent-highlight-ink` / `--accent-highlight-border`, `--brand-action-bg` / `--brand-action-fg`, `--brand-accent-text` / `--brand-accent-soft` / `--brand-accent-border`, `--bio-mint` / `--bio-mint-soft` / `--bio-mint-ring`.
- **Charts:** `--chart-grid`, `--chart-axis`. Always apply `shape-rendering: geometricPrecision` on SVGs/charts and `flex-shrink: 0` on icons.

#### RULER 4 Emotional Quadrants (+ Balanced)
Every quadrant defines a 5-token set (`-bg`, `-fg`, `-border`, `-solid`, `-ink`) with verified light, dark, calm, and high-contrast pairings:
- **Yellow (High-Energy Pleasant):** `--q-yellow-bg`, `--q-yellow-fg`, `--q-yellow-border`, `--q-yellow-solid`, `--q-yellow-ink`
- **Green (Low-Energy Pleasant):** `--q-green-bg`, `--q-green-fg`, `--q-green-border`, `--q-green-solid`, `--q-green-ink`
- **Blue (Low-Energy Unpleasant):** `--q-blue-bg`, `--q-blue-fg`, `--q-blue-border`, `--q-blue-solid`, `--q-blue-ink`
- **Red (High-Energy Unpleasant):** `--q-red-bg`, `--q-red-fg`, `--q-red-border`, `--q-red-solid`, `--q-red-ink`
- **Balanced / Neutral:** `--q-balanced-bg`, `--q-balanced-fg`, `--q-balanced-border`, `--q-balanced-solid`, `--q-balanced-ink`

#### Surface & Elevation Rules
- **Standard Content Cards (`.wb-surface`):** Opaque architectural cards with hairline borders (`--surface-card` + `--border-hairline`). **Never** apply glass/blur effects to charts, logs, or primary reading cards.
- **Restrained Liquid Glass (`.liquid-glass` / `.liquid-glass-strong`):** Reserved strictly for Navigation Dock, FAB, Sheets, Command Bar, and Panic Anchor (`--glass-bg`, `--glass-bg-strong`, `--glass-border`, `--glass-specular`, `--glass-shadow`, `--glass-blur`). Must degrade cleanly under `data-reduce-transparency="true"` and browsers without `backdrop-filter`.
- **Material 3 Expressive Tokens (`src/design/m3ExpressiveTokens.ts`):** Reuse `m3SurfaceTokens`, `m3Shapes`, `m3Springs` (`fastSpatial`, `defaultSpatial`, `defaultEffects`, `calmSpatial`, `instant`), and `getM3Spring()` instead of inventing ad-hoc spring parameters.

#### Centralized Z-Index Scale
Never introduce arbitrary `z-*` values outside the token ladder in `src/index.css`:
- `--z-base: 0`
- `--z-sticky-header: 20`
- `--z-bottom-dock: 30`
- `--z-fab: 40`
- `--z-popover: 45`
- `--z-sheet: 50`
- `--z-modal: 60`
- `--z-command: 70`
- `--z-panic: 80`
- `--z-toast: 90`
- `.skip-link`: `z-index: 100`

---

## 3. Contrast & Accessibility Expectations (WCAG 2.2 AA / AAA)

WELLBE+ is built as a **neuro-inclusive, WCAG 2.2 AA/AAA** application. New components and styles must preserve full parity across Light Mode, Dark Mode, and all **9 declarative accessibility modes** managed by `AccessibilityContext` (`src/context/AccessibilityContext.tsx`) and pre-hydrated before first paint in `index.html`.

### 3.1 Contrast Targets
- **Default Light & Dark Modes:**
  - Body text and controls must meet WCAG AA/AAA ink-on-surface contrast via `--ink-primary`, `--ink-secondary`, and `--ink-muted`.
  - RULER emotional quadrant labels must maintain **≥ 5.5:1** text contrast in Light Mode and **≥ 5.8:1** in Dark Mode.
  - Non-text UI boundaries and focus indicators (`--focus-ring`, `--focus-ring-width: 2.5px`) must maintain **≥ 3:1** contrast.
- **High-Contrast Mode (`html[data-high-contrast="true"]`):**
  - Enforces strict **WCAG AAA**: **≥ 7:1** body text, **≥ 4.5:1** borders and chart strokes, explicit `1.5px` borders on `.wb-surface`, and `3px` `:focus-visible` rings.
  - Honors OS `(prefers-contrast: more)` automatically unless the user sets an explicit override.

### 3.2 All 9 Declarative Accessibility Modes (`<html data-*="true">`)
When adding UI, verify behavior under every applicable mode:
1. **`calmMode` (`data-calm-mode="true"`):** Softens high-arousal `--palette-chartreuse` highlights to indigo (Light) or lavender (Dark), desaturates the 4×4 Emotion Grid and 7×4 Heatmap, widens vertical card rhythm (`--wb-section-gap: 2rem` on `.wb-calm-stack`), hides guilt-inducing streak counters, and softens springs to `m3Springs.calmSpatial`.
2. **`highContrast` (`data-high-contrast="true"`):** Applies WCAG AAA tokens, explicit borders, and `3px` focus outlines (including Calm + High-Contrast combined overrides).
3. **`reduceTransparency` (`data-reduce-transparency="true"`):** Strips `backdrop-filter` from `.liquid-glass` / `.liquid-glass-strong` and swaps translucent surfaces to solid opaque `--surface-card` with `1px solid var(--border-strong)`.
4. **`readingComfort` (`data-reading-comfort="true"`):** Scales root font size to `110%`, raises line-height (`1.65`), widens letter/word spacing, removes italics, and constrains `.wb-prose` to `60ch` left-aligned measure.
5. **`patternAssist` (`data-pattern-assist="true"`):** **Never convey emotional state or biometric status by color alone.** Pair RULER quadrants with geometric micro-patterns (`.wb-pattern-yellow`, `.wb-pattern-green`, `.wb-pattern-blue`, `.wb-pattern-red`, `.wb-pattern-balanced`) and explicit text codes (`High+`, `Calm+`, `Low−`, `High−`, `Steady`).
6. **`reduceMotion` (`data-reduce-motion="true"`):** Disables CSS animations/transitions/hover lifts and switches `motion/react` springs to `m3Springs.instant` / `defaultEffects` (and toasts to an 80ms opacity-only fade). Always check both `useAccessibility().reduceMotion` and `useReducedMotion()` from `motion/react`, and honor OS `(prefers-reduced-motion: reduce)` unless overridden.
7. **`focusMode` (`data-focus-mode="true"`):** Collapses secondary widgets and deep analytics behind expandable sections to reduce cognitive load.
8. **`plainLanguage` (`data-plain-language="true"`):** Uses everyday wording (e.g., *"Bright & Energized"* instead of *"High-Energy Pleasant"*) and reveals explicit text labels on compact icon controls.
9. **`quietCues` (`data-quiet-cues="true"`):** Silences TTS voice narration, Web Audio chimes, and haptics, presenting large, clear visual pacing prompts instead.

### 3.3 Keyboard, Focus, Touch & Screen-Reader Guardrails
- **Touch Targets:** Primary interactive elements (buttons, links, inputs, tabs, icon triggers) MUST meet a minimum **`44px × 44px`** hit target (`min-h-[44px]`). Apply `touch-action: manipulation` on high-frequency controls to avoid double-tap zoom delay.
- **Landmarks & Skip Link:** Keep `<a href="#main-content" className="skip-link">` as the first focusable element and preserve `<main id="main-content">`, `<header>`, `<nav>`, `role="tabpanel"`, `aria-labelledby`, and proper heading hierarchy.
- **Focus Indicators:** Never suppress `:focus-visible` outlines without providing an equally high-contrast `focus-visible:outline-[var(--focus-ring)]`. Emotion tiles must keep a distinct keyboard focus ring separable from their RULER selected border.
- **Dialog Focus Trapping:** Every modal, drawer, overlay, or sheet MUST use `role="dialog"`, `aria-modal="true"`, and `useFocusTrap` (`src/hooks/useFocusTrap.ts`) for reference-counted scroll locking, LIFO Escape/Tab trapping, and focus restoration to the invoking control (falling back to `#main-content`).
- **Live Announcements & Toasts:** Announce meaningful state changes and accessibility toggles through `useAccessibility().announce()` (backed by the global `sr-only` `role="status" aria-live="polite" aria-atomic="true"` region). Use `ToastHost` for transient feedback (auto-dismiss capped at `≤ 5000ms`; never trap focus in a toast).
- **Drag-to-Scroll Compatibility:** The app uses mouse drag-to-scroll (`src/hooks/useDragToScroll.ts`). Add `data-no-drag-scroll="true"` to buttons, links, and interactive widgets where pointer-down drag would interfere with activation; intentionally omit it on scrollable accordion headers (e.g., `SettingsBentoAccordion`) where vertical drag scrolling should remain smooth.
- **GPU-Only Motion:** Keep `@keyframes` strictly to `transform` and `opacity` (zero layout animation), and release `will-change` when idle.

---

## 4. Iframe, Embedding & External-Link Rules

### 4.1 Iframes & Embedded Preview Safety
- **No Third-Party `<iframe>` Embeds:** Do **not** embed external websites, videos, forms, or third-party auth/payment widgets via `<iframe>`. WELLBE+ is a local-first, privacy-focused wellness app.
- **Zero Frame Permissions:** `metadata.json` explicitly declares `"requestFramePermissions": []`. Do not add camera, microphone, geolocation, or other iframe permission requests without explicit user approval.
- **Safe Execution Inside Host/Preview Iframes:** Because the app may be previewed inside hosted sandboxes (e.g., Google AI Studio or mobile preview frames):
  - Never assume top-level window access—do **not** read or mutate `window.top` / `window.parent` or rely on cross-origin `postMessage`.
  - Always guard `window.localStorage`, `navigator.clipboard`, and `window.matchMedia` inside `try/catch` or feature checks so restricted/sandboxed frames degrade gracefully without throwing.
  - Keep `overscroll-behavior: contain` and `overflow-x: clip` on `html`, `body`, `main#main-content`, and drawers so scroll gestures do not bleed into a parent frame.

### 4.2 External Links (`https://`)
- **Mandatory Security Attributes:** Every external web link (`<a href="https://...">`) MUST include:
  ```tsx
  target="_blank"
  rel="noopener noreferrer"
  ```
  This prevents reverse tabnabbing (`window.opener`) and strips referrer headers.
- **HTTPS Only:** Never link to insecure `http://` external URLs.
- **Never Hijack the Active Tab:** Never open external sites in the same tab (which interrupts active somatic resets or unsaved mood check-ins) and avoid unprompted `window.open()` popups.
- **Accessible External-Link Cues:** Pair external links with a visual indicator (e.g., `<ExternalLink aria-hidden="true" />` from `lucide-react`) and screen-reader disclosure (`<span className="sr-only"> (Opens in a new tab)</span>`).
- **Drag-Scroll & Hit Targets:** Add `data-no-drag-scroll="true"` and `min-h-[44px]` to standalone external link buttons (see `src/components/HelpSupportTab.tsx`).

### 4.3 Protocol Links (`tel:`, `mailto:`) & Wellness Safety Boundaries
- **No `target="_blank"` on `tel:` / `mailto:`:** Native protocol links (`tel:988`, `tel:18009506264`, `mailto:`) must **not** set `target="_blank"` so mobile dialers and mail clients invoke cleanly without opening empty browser tabs.
- **Provide a Clipboard Fallback for `mailto:`:** Whenever adding or updating a `mailto:` action, pair it with a copy-to-clipboard button and toast fallback (as in `HelpSupportTab.tsx`) for environments without a configured email client.
- **Preserve Crisis & Non-Clinical Boundaries:** WELLBE+ is a supportive wellness tool, not medical care. Never remove, obscure, or gate 988 Suicide & Crisis Lifeline (`tel:988`), NAMI HelpLine resources, or the non-medical scope disclosures in `src/data/appMeta.ts` and `src/components/HelpSupportTab.tsx`.

### 4.4 Allowed External Origins
Only the following external origins are permitted on the client:
- Google Fonts (`https://fonts.googleapis.com`, `https://fonts.gstatic.com`) in `index.html`.
- Vercel Analytics (`@vercel/analytics/react`) in `src/main.tsx`.

Do not add external CDN scripts, ad pixels, analytics trackers, or unapproved third-party SDKs.

---

## 5. Task Scoping & Iterative Workflow

- **One Concrete Task per Pass:** Scope every pass to a single concrete feature, audit, or bug fix (for example: a responsive layout check, a mobile menu/dock behavior fix, or a targeted performance cleanup). Do not bundle unrelated refactors, drive-by reformatting, or speculative edits into the same pass.
- **Minimal, Surgical Diffs:** Touch only the files and lines directly required for the active task. Preserve existing comments, architecture, and unrelated behavior.
- **Pause & Review After Every Pass:** Before finishing or moving to the next task:
  1. Inspect `git status` and `git diff` (or `git diff --stat`) to verify every changed line belongs to the requested scope.
  2. Run `npm run lint` (`tsc --noEmit`) and `npm run build` (`vite build`) and report the actual exit status, warnings, or bundle impact.
  3. Wait for review or the next narrowly scoped task before starting additional work.

---

## 6. Verification Checklist Before Finishing Changes

1. Review `git status` and `git diff` to confirm changes stay tightly scoped to the single requested task.
2. Run `npm run lint` (`tsc --noEmit`) and `npm run build` (`vite build`) and confirm both exit cleanly with zero errors (reviewing any warnings or chunk changes in the output).
3. Confirm no raw hardcoded colors bypassed CSS tokens in `src/index.css` or `src/design/m3ExpressiveTokens.ts`.
4. Verify visual and contrast integrity across **Light Mode**, **Dark Mode**, **Calm Mode**, **High-Contrast Mode**, **Reduce Transparency**, **Reading Comfort**, and **Reduce Motion**.
5. Verify keyboard navigation, `:focus-visible` rings, `44px` hit targets, and `useFocusTrap` behavior on any touched interactive control or dialog.
6. Verify any new external link uses `https://`, `target="_blank"`, `rel="noopener noreferrer"`, screen-reader new-tab text, and `data-no-drag-scroll="true"`, and that no third-party `<iframe>` was introduced.
