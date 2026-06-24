# Handoff Prompt — /make-plan

````
/make-plan Redesign taxi-app (vsl-mobile) design infrastructure. Current design failed audit at 13/30 with critical gaps in principles #3 Aesthetic (1/3), #4 Understandable (1/3), #5 Unobtrusive (1/3), #6 Honest (1/3), #8 Thorough (1/3), #9 Environmentally friendly (1/3).

Verdict paragraph (from 03-verdict.md):
> The 2026 visual refresh produced a coherent surface aesthetic (dark header, orange brand, card hierarchy) but built on a foundation with no shared token system, no type or spacing scale, 58 scattered color literals, and systematic label/behavior mismatches that erode trust in the navigation — a REDESIGN of the design infrastructure is warranted, not a cosmetic iteration.

Why redesign and not refine:
Total 13/30 — below the 20-point REFINE floor. Root cause is systemic: `const C = {}` duplicated in 6 screens instead of a shared file, 3 different orange gradient end stops, 27 spacing values with no grid, 16 font sizes with no scale, 4 navigation labels that don't match what they open.

Preserve from current design:
- 2-tap primary task flow: MainTabs.js:106 (tab tap) → TodayRidesScreen.js:287 (Démarrer tap) — do NOT add taps
- Dark header intent: `#0A0F1E → #111827` palette — keep, systematise the tokens
- DataContext architecture: loadData(false) + 30s throttle (DataContext.js:21-24) + optimistic mutations — do not touch
- "Créer retour" shortcut: TodayRidesScreen.js:86-101
- BonTransport scanner: CreateRideScreen.js:60 + components/BonTransportScannerModal.js
- Brand primary: #FF6B00

Discard:
- All 6 inline `const C = {}` objects (HomeTabs.js:21, TodayRidesScreen.js:15, AgendaScreen.js:23, CreateRideScreen.js:20, HistoryScreen.js:24, PatientsScreen.js:27). Caused failure on #3 and #10.
- `accentBlob` decorative circles in all screen headers (HomeTabs.js:159). Caused failure on #5.
- LinearGradient on every icon box in navigation grids. Caused failure on #5 and #10.
- Three divergent orange gradient end stops (#FF8C30/HomeTabs.js:259, #FF8C38/CreateRideScreen.js:344, #FF8C00/LoginScreen.js:169). Caused failure on #3.

Top 5 moves (implement in this order):

1. #3 Aesthetic + #10 As-little-design: Create styles/tokens.js with:
   - 12 semantic colors: bg #F0F3FA, card #FFFFFF, card2 #F5F7FF, border #E4E8F0, text #0D1117, text2 #64748B, text3 #94A3B8, brand #FF6B00, brandGrad #FF8C00 (single end stop — DELETE #FF8C30 and #FF8C38), green #10B981, red #EF4444, hBg1 #0A0F1E
   - 6-step type scale: 11 / 13 / 16 / 20 / 24 / 28
   - 8pt spacing: 4 / 8 / 12 / 16 / 20 / 24 / 32 / 48
   - Single paddingBottomScroll: 120 (replaces HomeTabs:120, TodayRides:160, History:100)
   All screens import from this file; no screen defines its own color/spacing constants.

2. #4 Understandable + #6 Honest: Fix all 5 navigation label/behavior mismatches:
   - MainTabs.js:106: rename Demandes → Aujourd'hui; unify with focused label (currently "Courses" at line 125)
   - HomeTabs.js:245: "Voir tout →" → navigate('Aujourd'hui') not navigate('Agenda')
   - AgendaScreen.js:457: field label "Heure de départ" → "Heure de départ du retour"
   - PatientsScreen.js:708: "WhatsApp" button → rename to "Partager…" or implement WhatsApp deep-link (currently opens OS share sheet via Sharing.shareAsync)
   - LoginScreen.js:112: "TaxiApp" → "VSL Mobile" (matches package.json slug: taxi-vsl, backend domain: vsl-taxi)

3. #5 Unobtrusive + #10 As-little-design: Remove decoration without function:
   - Delete `accentBlob` style and View from all 5 screen headers
   - In HomeTabs grid (4 items), replace LinearGradient icon boxes with View + tinted backgroundColor (brandDim, greenDim, etc. from tokens.js) — LinearGradient stays only on primary CTA buttons (Démarrer, Terminer, submit)
   - Reduce TodayRidesScreen card from 4 visual layers to 2: keep gradient stripe OR border, not both + shadow

4. #8 Thorough: Implement missing interaction states:
   - Focus: add onFocus/onBlur to EVERY TextInput — toggle borderColor: C.border → C.brand. Screens with missing focus: LoginScreen.js:126, TodayRidesScreen.js modal inputs, HistoryScreen.js:460, CreateRideScreen.js address inputs
   - Disabled: add opacity: 0.5 to buttons using disabled={loading}. Screens: LoginScreen.js:164, TodayRidesScreen.js:288, CreateRideScreen.js:688
   - Success: CreateRideScreen.js:245/278/303 — replace Alert.alert('Succès') with 2s inline banner below submit button before navigation

5. #9 Environmentally friendly: Remove 5 dead/duplicate dependencies from package.json:
   - nodemailer@7 (server-only, line :48) — remove
   - react-navigation@^5.0.0 (v5 legacy, line :61) — remove
   - react-native-datepicker@^1.7.2 (duplicates @react-native-community/datetimepicker, line :52) — remove
   - Replace all import moment in screens with import dayjs — dayjs declared at package.json:31, moment is unlisted transitive ~290KB
   - Audit @supabase/supabase-js — if no Supabase calls found in full codebase, remove (declared but unused per audit)

Redesign principles in priority order:
1. #10 As little design as possible — every token, color, and component must earn its place; no element that can be removed without breaking the task survives
2. #3 Aesthetic — one shared token system; zero orphan style values; the system is visible in the result
3. #4 Understandable — every label names what it opens; first-time user correctly identifies every primary control

Deliverables for the plan:
- styles/tokens.js file (colors, type scale, spacing, constants) — must be created before any screen changes
- Per-move: target files, exact change, grep command to verify zero regressions
- Migration checklist: for each of the 6 inline C objects, confirm import replaced, old object deleted
- Regression checklist for preserved items (2-tap flow, DataContext, BonTransport scanner)
- Before/after color count: from 58 → target ≤ 14 unique hex values project-wide
- States checklist per screen after move 4: focus / disabled / success all marked P

Anti-patterns to guard against:
- Adding a styles/tokens.js but keeping the old C objects as fallback — hard delete the old objects
- Fixing the tab label "Demandes" in MainTabs.js but leaving navigation.navigate('Demandes') calls elsewhere — update all call sites
- Removing LinearGradient from icon boxes but adding it back "because it looks flat" — trust the token tints
- Treating move 4 (states) as optional because states are "not design" — missing focus is a WCAG failure
- Removing moment but not updating imports in all 10+ screen files — the migration must be complete
````
