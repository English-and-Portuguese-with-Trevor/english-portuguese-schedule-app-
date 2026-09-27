@AGENTS.md

## Account menu, Settings, lifetime access
- The "Hi, name" account menu (`src/components/app-shell.tsx`) is the same on all four sites, in this order: Home, Lessons, Flashcards, Schedule a class, Settings, Log out.
- `/settings` (`src/components/account-settings.tsx`): lesson access, then Manage subscription (Stripe portal via the `billing` edge function) next to Delete account (the `delete-account` edge function). Both functions live in the flashcards-app repo.
- Lifetime lesson access: students qualify after three class sets (12 classes on the 4-class package, 24 on the 8-class package). Completed classes = past confirmed bookings + late cancellations + `profiles.earlier_classes`. The app only flags it (`my_class_progress` / `admin_class_progress` RPCs); Trevor gives `lifetime` by hand on the Users page. Never grant it automatically.

## Dark mode and shared preferences
- Dark mode and the language being learned are shared by all four sites through the `ept-prefs` cookie (`src/lib/prefs.ts`, same logic as `prefs.js` in the other repos; kept through log out). `THEME_SCRIPT` in the root layout's `<head>` sets `<html data-theme="dark">` before paint; don't read cookies in the root layout (that would stop static pages from prerendering).
- When logged in the profile (`theme`, `learning_language`) wins: `AppShell` renders `PrefsSync`, which copies it to the cookie (`src/lib/preferences.ts`). Settings has the Dark mode switch and "I'm learning"; the booking form's lesson language defaults to it when the student has no earlier booking.
- Dark colors live under `:root[data-theme="dark"]` in `globals.css` (Tailwind `dark:` follows the attribute, not the device setting). Don't add `prefers-color-scheme` rules.

## Workflow
Trevor approved pushing straight to `main` (no branches or pull requests) for all changes. Run the tests and build first. Still ask before anything that needs a dashboard setting changed first, would log people out, or could charge anyone.
