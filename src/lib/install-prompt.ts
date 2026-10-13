// Browsers fire beforeinstallprompt once, shortly after page load, so it has to
// be captured at startup (AppShell imports this file) rather than by Settings.

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export type InstallState = { prompt: InstallPromptEvent | null; installed: boolean };

let state: InstallState = { prompt: null, installed: false };
const listeners = new Set<(s: InstallState) => void>();

function update(next: Partial<InstallState>) {
  state = { ...state, ...next };
  listeners.forEach((fn) => fn(state));
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    update({ prompt: e as InstallPromptEvent });
  });
  window.addEventListener("appinstalled", () => update({ prompt: null, installed: true }));
}

export function getInstallState() {
  return state;
}

export function subscribeInstallState(fn: (s: InstallState) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export async function promptInstall() {
  const { prompt } = state;
  if (!prompt) return;
  await prompt.prompt();
  const { outcome } = await prompt.userChoice;
  update({ prompt: null, installed: state.installed || outcome === "accepted" });
}
