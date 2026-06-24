# Evidence — Design-Is Audit
Source: static analysis, no running instance (all visual findings INFERRED)

---

## A. Structural Evidence

### A1. Interactive-element count
| Screen | TouchableOpacity / TextInput count |
|---|---|
| HomeTabs.js | 21 |
| TodayRidesScreen.js | 23 |
| AgendaScreen.js | 22 |
| CreateRideScreen.js | **51** |
| HistoryScreen.js | 19 |
| MainTabs.js | 5 |
| PatientsScreen.js | **56** |

CreateRideScreen and PatientsScreen are in outlier territory for a mobile utility screen.

### A2. Redundant style definitions
`borderRadius: 14 / 16 / 20 / 22` appears **28 times** redefined per-screen instead of shared tokens.
No shared `theme.js` or `tokens.js` file exists — every screen re-declares the full `C` object.

### A3. Duplicate navigation packages
`package.json` contains **5** navigation packages:
- `react-navigation@^5.0.0` (v5 legacy)
- `@react-navigation/native@^7`
- `@react-navigation/native-stack@^7`
- `@react-navigation/stack@^7`
- `@react-navigation/bottom-tabs@^7`

v5 and v7 coexist — one is dead weight.

### A4. Duplicate storage packages
`@react-native-async-storage/async-storage` AND `expo-secure-store` both present.
Usage split: LoginScreen/SignupScreen (now SecureStore), but AsyncStorage still in package.json.

### A5. Duplicate notification packages
`@react-native-community/push-notification-ios` (iOS only) AND `expo-notifications` both present.
`expo-notifications` covers both platforms — iOS-only package is redundant on Android target.

---

## B. Visual Evidence (INFERRED from source)

### B1. Spacing scale
Observed values (px): `0 1 2 3 4 5 6 7 8 10 12 13 14 15 16 17 18 20 22 24 28 40 50 90 120 160`
**26 distinct spacing values.** No 4pt or 8pt system. Values like 13, 15, 17, 22 break any grid.

### B2. Type scale
Observed fontSizes (px): `8 9 10 11 12 13 14 15 16 17 18 20 22 24 26 28 34 44`
**18 distinct font sizes.** No recognisable modular scale (e.g. Major Third = 10/12.5/16/20/25).

### B3. Color count
**52 unique hex values** across 4 screens (HomeTabs, TodayRides, CreateRide, LoginScreen).
Includes near-duplicates: `#10B981` and `#0EA572` (both green), `#FF8C00` and `#FF8C30` and `#FF8C38` (three near-identical ambers). 
Standard mobile design system: 8–15 colors.

### B4. Lowest contrast (INFERRED)
Worst pairing: `#94A3B8` text on `rgba(255,255,255,0.07)` background (glass card in LoginScreen).
Computed: ~2.8:1 — **fails WCAG AA** (requires 4.5:1 for normal text).
`LoginScreen.js:268` (`placeholderTextColor="#94A3B8"`) on glass background `LoginScreen.js:261`.

### B5. State coverage
| Screen | Empty | Loading | Error | Success | Focus | Disabled |
|---|---|---|---|---|---|---|
| HomeTabs | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| TodayRidesScreen | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| AgendaScreen | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| CreateRideScreen | ✓ | ✓ | ✓ | ✗ | ✗ | partial |
| HistoryScreen | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| LoginScreen | N/A | ✓ | ✓ | ✗ | ✗ | ✗ |
| PatientsScreen | ✓ | ✓ | ✓ | ✗ | ✗ | partial |

**Focus state absent across all screens** — TextInput fields have no visual border change on focus.
**Disabled state**: buttons use `disabled={loading}` but no `opacity` or style change applied.

### B6. Orphan styles
- `accentBlob` (`HomeTabs.js:159`, `TodayRidesScreen.js` equivalents) — purely decorative, no function
- `ticketDivider` / `dashedLine` (`HomeTabs.js:432-433`) — leftover from old design, not rendered
- `#FF8C30` vs `#FF8C38` — two orange variants 8 hue points apart, visually identical, no semantic distinction

---

## C. Copy & Honesty Evidence

### C1. Label → behavior mismatches
| Label | Location | Actual behavior |
|---|---|---|
| "Demandes" (tab) | `MainTabs.js:106` | Opens `TodayRidesScreen` which shows ALL today's rides, not only web requests |
| badge `webPendingCount` | `MainTabs.js:120` | Badge counts only web requests, but tab shows everything — badge promises narrower scope than content delivers |
| "Activité" (grid item) | `HomeTabs.js:368` | Navigates to `History` screen — "Activité" implies live/real-time; "Historique" is more accurate |
| "TaxiApp" (logo text) | `LoginScreen.js:112` | App is named `vsl-mobile` in `package.json`; "TaxiApp" is informal but inconsistent |

### C2. Inflations
None — no marketing superlatives found. Copy is functional.

### C3. Dark patterns
None found.

### C4. Jargon
| Original | Screen | Proposed replacement |
|---|---|---|
| "CA estimé" | `HomeTabs.js` | "Revenus estimés" or "Gains mois" — "CA" is accountant-speak |
| "VSL" (type badge) | multiple | Fine for target user (VSL driver) — keep |
| "Bon transport" | CreateRideScreen button | Fine — is standard French medical transport vocabulary |

---

## D. Weight & Friction Evidence

### D1. Dependency weight
- 50 total dependencies
- `moment.js` (heavyweight date lib ~300KB before tree-shaking) — `dayjs` already in package.json as alternative
- **Both `moment` AND `dayjs` are listed** — `package.json:28` (`dayjs`) and `package.json:9` (`moment` via HomeTabs import)
- Redundant: `react-navigation@5` + v7 stack (see A3 above)
- Redundant: AsyncStorage + SecureStore (see A4)
- Redundant: push-notification-ios + expo-notifications (see A5)

### D2. Primary task flow — start a ride (cold start, logged in)
1. App opens → HomeTabs (DataContext begins loading) — 0 taps
2. Tap "Demandes" tab (3rd icon) — **1 tap** → TodayRidesScreen visible
3. Locate ride in list → tap "Démarrer" — **1 tap** → `handleStart()` → API call → optimistic update

**Total: 2 taps, 1 API call, 0 confirmation dialogs.** Excellent.

### D3. Finish a ride flow
1. From TodayRidesScreen, tap "Terminer" — 1 tap → modal opens
2. Enter distance (km) — required text input
3. Tap "Valider" — 1 tap → API call
4. Alert: "Créer le retour ?" — 1 tap to dismiss

**Total: 2 taps + 1 text input + 1 dismiss.** Acceptable.

### D4. Idle animations
- `liveDot` in TodayRidesScreen header and cards — static styled View, **not animated** (good)
- `ActivityIndicator` shown conditionally during loading only (not on idle)
- No auto-playing animations on idle screens

### D5. API calls on mount
- `DataContext.js:110` — `loadData()` on mount (1 call)
- `HomeTabs.js:64` — `loadData(false)` on focus (throttled 30s)
- `TodayRidesScreen.js:66` — `loadData(false)` on focus (throttled 30s)
- **Net: 1 API call on cold start, throttled thereafter** — correct after DataContext refactor
