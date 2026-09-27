import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";

// Testing Library only auto-unmounts when Vitest globals are enabled.
afterEach(cleanup);

// The shared ept-prefs cookie would otherwise leak between tests.
beforeEach(() => {
  if (typeof document !== "undefined")
    document.cookie = "ept-prefs=; Max-Age=0; Path=/";
});
