@AGENTS.md

## Account menu, Settings, lifetime access
- The "Hi, name" account menu (`src/components/app-shell.tsx`) is the same on all four sites, in this order: Home, Lessons, Flashcards, Schedule a class, Settings, Log out.
- `/settings` (`src/components/account-settings.tsx`): lesson access, then Manage subscription (Stripe portal via the `billing` edge function) next to Delete account (the `delete-account` edge function). Both functions live in the flashcards-app repo.
- Lifetime lesson access: students qualify after three class sets (12 classes on the 4-class package, 24 on the 8-class package). Completed classes = past confirmed bookings + late cancellations + `profiles.earlier_classes`. The app only flags it (`my_class_progress` / `admin_class_progress` RPCs); Trevor gives `lifetime` by hand on the Users page. Never grant it automatically.

## Workflow
Trevor approved pushing straight to `main` (no branches or pull requests) for all changes. Run the tests and build first. Still ask before anything that needs a dashboard setting changed first, would log people out, or could charge anyone.
