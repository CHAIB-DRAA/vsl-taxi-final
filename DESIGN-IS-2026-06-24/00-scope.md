# Scope — Design-Is Audit

## What is being audited
React Native Expo app **taxi-app** (vsl-mobile), audited post-redesign 2026 style refresh.

Primary screens audited:
- `screens/HomeTabs.js` — Dashboard (primary landing screen)
- `screens/TodayRidesScreen.js` — Courses du jour (most-used daily screen)
- `screens/AgendaScreen.js` — Planning / calendar
- `screens/CreateRideScreen.js` — Formulaire création course
- `screens/HistoryScreen.js` — Historique & stats
- `screens/LoginScreen.js` / `SignupScreen.js` — Auth screens
- `screens/MainTabs.js` — Tab bar navigation
- `screens/PatientsScreen.js` — Patients management

## Primary user
French taxi / VSL (Véhicule Sanitaire Léger) driver, managing medical transport rides daily.

## Primary task
Open app → see today's rides → start / finish a ride in as few taps as possible.

## Constraints
- Stack: React Native 0.79 + Expo 53, expo-linear-gradient, Ionicons
- Brand: orange `#FF6B00` primary, dark header `#0A0F1E`
- No live running instance available — static source only (INFERRED analysis)
- Target: Android (Pixel 7 API 34 emulator)

## Reference designs / competitors
None specified. Internal standard: HomeTabs.js is the design reference screen.
