# Scorecard — Design-Is Audit (Dieter Rams × 10)
Audited surface: taxi-app vsl-mobile, post-2026 redesign, 8 primary screens
Scoring rule: score worst instance, not average. Tie-breaks go lower.

---

## 1. Good design is innovative — Score: 2/3
**Evidence:** Dark gradient header on a utility VSL app is uncommon in the peer set (other taxi-management apps use flat white headers). "Créer le retour" contextual shortcut (`TodayRidesScreen.js:86-101`) and BonTransport OCR scanner integration (`CreateRideScreen.js:60`) are workflow innovations not found in generic form apps.
**Justification:** Refreshes established patterns with clear improvements; does not introduce entirely new interaction paradigms, so 3 is not warranted.

---

## 2. Good design is useful — Score: 2/3
**Evidence:** Primary task (start a ride) completes in 2 taps from the main screen — `MainTabs.js:106` (tab tap) + `TodayRidesScreen.js:287` (Démarrer tap) — with 1 API call, 0 dialogs. However, `App.js:199-205` fires a redundant `getTodayRides()` on every session start that fetches data already available from `DataContext.js:31` `getRides()`.
**Justification:** Primary task is well-served; adjacent surface (redundant call, mislabeled tab causing orientation confusion) adds friction without blocking the task.

---

## 3. Good design is aesthetic — Score: 1/3
**Evidence:** 52 unique hex colors across 4 screens (see `01-evidence.md` B3) against a typical mobile system ceiling of 8–15. 18 distinct font sizes (8px–44px) with no modular scale. Spacing scale has 26 values with no 4pt/8pt grid (`01-evidence.md` B1-B2). Near-duplicate colors exist: `#FF8C00`, `#FF8C30`, `#FF8C38` — three amber variants with no semantic distinction.
**Justification:** Scores 1 (3–5 inconsistencies OR one jarring violation) — the color and spacing token chaos is systematic, not isolated; visual unity is held together by the dark header and orange brand but the underlying system is absent.

---

## 4. Good design is understandable — Score: 1/3
**Evidence:** "Demandes" tab (`MainTabs.js:106`) opens `TodayRidesScreen` which shows ALL today's rides, not only web requests. The badge shows only web-pending count (`MainTabs.js:120`) but the content is broader — the tab promises narrower scope than it delivers. "Activité" label (`HomeTabs.js:368`) navigates to the History/stats screen — "Activité" implies live state, "Historique" would be accurate. Grid shows "Facturation" shortcut (`HomeTabs.js:392`) but no Facturation tab exists — inconsistent IA between grid and tabs.
**Justification:** 2–3 controls are meaningfully unclear; the "Demandes" mislabel is load-bearing since it is the most-used tab for the primary task.

---

## 5. Good design is unobtrusive — Score: 1/3
**Evidence:** `accentBlob` decorative circle (position absolute, opacity 0.06, 200×200px) appears in every screen header (`HomeTabs.js:159-167`, `TodayRidesScreen.js` equivalent) with no function. Every card list item has 4 visual layers: gradient stripe + card background + border + outer shadow. LinearGradient is applied to every icon box (8 instances in HomeTabs grid + scanner alone), creating a gradient-heavy visual field.
**Justification:** Decoration is visible and recurring but does not fully prevent content legibility — chrome is present but not dominant; scores 1 (decoration competes with content), not 0.

---

## 6. Good design is honest — Score: 1/3
**Evidence:** "Demandes" tab label → shows all rides (label/behavior mismatch, `MainTabs.js:106`). Badge on "Demandes" shows `webPendingCount` but full tab content includes non-web rides — badge implies the tab is a filtered view it is not. App shows "TaxiApp" as brand in `LoginScreen.js:112` while `package.json` name is `vsl-mobile` and the backend domain is `vsl-taxi.onrender.com`. "Activité" label (`HomeTabs.js:368`) misrepresents a history screen as live activity.
**Justification:** 2+ label→behavior mismatches across primary navigation — does not reach dark-pattern territory (score 0) but exceeds 1 minor inflation (score 2 floor).

---

## 7. Good design is long-lasting — Score: 2/3
**Evidence:** Core information architecture (tab bar, card lists, form screens, detail modals) is timeless. Visual trend markers: heavy glassmorphism on auth screen (`LoginScreen.js:244-248`), LinearGradient on every icon element (`HomeTabs.js`), accent blobs — these are 2024–2026 peak-trend signals that date the design.
**Justification:** 1–2 dated markers; underlying structure would survive trend shifts; scores 2 not 1 because the structure is clean under the surface treatment.

---

## 8. Good design is thorough down to the last detail — Score: 1/3
**Evidence:** Focus state: **absent on all TextInput fields across all screens** — no `onFocus` borderColor change anywhere in `LoginScreen.js`, `CreateRideScreen.js`, `TodayRidesScreen.js`. Disabled state: buttons use `disabled={loading}` (`LoginScreen.js:160`) but apply no visual style change (no opacity reduction, no color shift). Success state: absent in all screens — after saving a ride, form just resets with no confirmation (`CreateRideScreen.js:228-232`). Error states and loading states are present (3 screens out of 7 have error display).
**Justification:** 2–3 states missing or rough across the audited surface; focus and disabled are consistently missing, not isolated to one screen.

---

## 9. Good design is environmentally friendly — Score: 1/3
**Evidence:** `nodemailer@7` (`package.json:48`) is a Node.js server-only library bundled into the React Native app — non-functional dead weight. `moment` used in 10+ screen files but `dayjs@1.11.19` is also declared in `package.json` — two date libraries coexisting, moment alone is ~290KB. `react-navigation@^5.0.0` + v7 stack coexist. `react-native-datepicker` duplicates `@react-native-community/datetimepicker`. `getTodayRides()` fires on every cold start independently of `DataContext.js` `getRides()` (`App.js:199`). Dark mode is handled via `ThemeContext`. No idle animations. No autoplay media.
**Justification:** Bundle weight is in the 500KB–2MB estimated JS range due to 6+ redundant dependencies; motion is gated (not always-on); dark mode works. Scores 1 — not 0 because the >2MB threshold is not certain and dark mode is respected.

---

## 10. Good design is as little design as possible — Score: 1/3
**Evidence:** `accentBlob` on every header screen (4+ instances) is purely decorative — removing it breaks nothing. 52 hex colors where ~12 would suffice — most extras are opacity tints of existing values (`#FF6B0018`, `#10B98118`, `#brandDim` variants) that could be replaced by StyleSheet opacity or a tint utility. LinearGradient on every icon box in HomeTabs grid (4 gradient components) where a single background color would serve identity equally. Card stripe (`TodayRidesScreen.js:169-175`, LinearGradient) + card border + card shadow = 3 depth signals on one element; 1 or 2 would suffice.
**Justification:** 3–5 removable elements found — accentBlob, half the color palette, icon gradient boxes, card triple-depth — but primary content is not obscured; scores 1 not 0.

---

## Total: 14 / 30

| # | Principle | Score |
|---|---|---|
| 1 | Innovative | 2 |
| 2 | Useful | 2 |
| 3 | Aesthetic | 1 |
| 4 | Understandable | 1 |
| 5 | Unobtrusive | 1 |
| 6 | Honest | 1 |
| 7 | Long-lasting | 2 |
| 8 | Thorough | 1 |
| 9 | Environmentally friendly | 1 |
| 10 | As little design as possible | 1 |
| **Total** | | **14 / 30** |
