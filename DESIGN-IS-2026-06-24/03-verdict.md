# Verdict — Design-Is Audit

## Score: 13 / 30 → REDESIGN

The 2026 visual refresh produced a coherent surface aesthetic (dark header, orange brand, card hierarchy) but built on a foundation with no shared token system, no type or spacing scale, 58 scattered color literals, and systematic label/behavior mismatches that erode trust in the navigation — a REDESIGN of the design infrastructure is warranted, not a cosmetic iteration.

---

## Why redesign and not refine

Total score 13/30 — well below the REFINE floor of 20. No single principle scored 3. The four lowest-scoring principles (#3 Aesthetic, #4 Understandable, #5 Unobtrusive, #6 Honest) all failed on systemic grounds, not isolated incidents. The root cause is the same in each case: the visual redesign was applied screen-by-screen without a shared token file, creating 52+ color literals, 27 spacing values, and 3 duplicate orange gradient end stops across screens. Fixing these by iterating per-screen (REFINE) would re-introduce the same fragmentation.

---

## What to preserve

- **2-tap primary task flow** — start a ride in 2 taps from cold start (`MainTabs.js:106` → `TodayRidesScreen.js:287`) — do not add steps
- **Dark gradient header visual intent** — the `#0A0F1E → #111827` header palette is a genuine aesthetic improvement; keep the intent, systematise the execution
- **DataContext architecture** — `loadData(false)` with 30s throttle (`DataContext.js:21-24`) + optimistic mutations (`updateLocalRide`) is correct and should not be touched
- **"Créer retour" contextual shortcut** (`TodayRidesScreen.js:86-101`) — genuinely useful, preserve
- **BonTransport scanner integration** (`CreateRideScreen.js:60`, `components/BonTransportScannerModal.js`) — preserve
- **Orange brand `#FF6B00`** — primary identity token

---

## Top 5 leverage moves (spine of the redesign plan)

### Move 1 — #3 Aesthetic + #10 As-little-design
**Create `styles/tokens.js`** as a single shared source of truth replacing the 6 inline `const C = {}` objects. Define: 12 semantic color tokens, a 6-step type scale (11/13/16/20/24/28), an 8pt spacing array (4/8/12/16/20/24/32/48), a single brand gradient stop (`#FF8C00` — pick one, delete `#FF8C30` and `#FF8C38`). All 6 screens import from this file.
Evidence: `const C` duplicated at `HomeTabs.js:21`, `TodayRidesScreen.js:15`, `AgendaScreen.js:23`, `CreateRideScreen.js:20`, `HistoryScreen.js:24`, `PatientsScreen.js:27`. 58 hex/rgba literals across 4 screens. Three orange gradient end stops: `HomeTabs.js:259` (`#FF8C30`), `CreateRideScreen.js:344` (`#FF8C38`), `LoginScreen.js:169` (`#FF8C00`).

### Move 2 — #4 Understandable + #6 Honest
**Fix all navigation label/behavior mismatches:**
- `MainTabs.js:106` rename `name="Demandes"` → `name="Aujourd'hui"` and unify the focused label (currently "Courses" at MainTabs.js:125, diverging from the tab name used in programmatic navigation)
- `HomeTabs.js:245` fix "Voir tout →" — navigate to `'Demandes'` (today's rides) not `'Agenda'` (all-dates calendar)
- `AgendaScreen.js:457` fix "Heure de départ" field label inside the "Heure du retour" modal to "Heure du retour"
- `PatientsScreen.js:708` fix "WhatsApp" button — either rename to "Partager…" or implement WhatsApp deep-link; button currently calls system share sheet (`Sharing.shareAsync`)
- `LoginScreen.js:112` align "TaxiApp" brand name with the actual product name used elsewhere

### Move 3 — #5 Unobtrusive + #10 As-little-design
**Remove all `accentBlob` decorative circles** from headers (5 screens) and **replace LinearGradient icon boxes** in the 4-item grid (HomeTabs) and similar patterns with flat tinted backgrounds. Gradient is appropriate for primary CTAs (submit button, Démarrer/Terminer actions); it is not appropriate for background decoration or 2nd-level icon containers.
Evidence: `accentBlob` at `HomeTabs.js:159-167`, `TodayRidesScreen.js` equivalent, `HistoryScreen.js`, `PatientsScreen.js`. 8 LinearGradient icon boxes in HomeTabs alone. Card visual layer count: 4 (stripe + border + shadow + icon gradient) — reduce to 2.

### Move 4 — #8 Thorough
**Implement missing interaction states system-wide:**
- Focus: add `onFocus` / `onBlur` props to every TextInput — toggle `borderColor` from `C.border` to `C.brand` on focus. Currently absent in `LoginScreen.js:126-158`, `TodayRidesScreen.js` modals, `HistoryScreen.js:460`, all address inputs in `CreateRideScreen.js`
- Disabled: add `opacity: 0.5` to every button that receives `disabled={loading}`. Currently `LoginScreen.js:164` has `disabled` but no visual style change
- Success: replace ephemeral `Alert.alert('Succès')` in `CreateRideScreen.js:245,278,303` with an inline inline brief toast or field-level confirmation

### Move 5 — #9 Environmentally friendly
**Bundle diet — 5 removals:**
1. Remove `nodemailer@7` from `package.json` (server-only library, non-functional in RN)
2. Remove `react-navigation@^5.0.0` (`package.json` dependency — v5 legacy, v7 already in use)
3. Remove `react-native-datepicker@^1.7.2` (duplicates `@react-native-community/datetimepicker`)
4. Replace all `import moment` in screens with `import dayjs` (dayjs already declared; moment adds ~290KB)
5. Remove or audit `@supabase/supabase-js` (declared but no Supabase calls found in audited files — likely dead weight given custom Express/MongoDB backend)
Evidence: `package.json:48` (nodemailer), `:61` (react-navigation v5), `:52` (datepicker), screens `HomeTabs.js:9`, `TodayRidesScreen.js:9`, `AgendaScreen.js:?` all `import moment` vs `package.json:31` dayjs.
