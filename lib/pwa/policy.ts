/** Dismissing the install banner defers it for 30 days. */
export const INSTALL_DISMISS_MS = 30 * 24 * 60 * 60 * 1000;

export type InstallSurface = {
  standalone: boolean;
  installed: boolean;
  dismissedUntil: number;
  now: number;
  promptAvailable: boolean;
  /** iOS cannot report an installed home-screen app unless it is already standalone. */
  ios: boolean;
  /** Cookie consent, the safety notice, or the planner is in the way. */
  blockedByPriority: boolean;
};

export type InstallMode = "hidden" | "prompt" | "ios-manual";

export function installMode(surface: InstallSurface): InstallMode {
  if (surface.standalone || surface.installed) return "hidden";
  if (surface.dismissedUntil > surface.now) return "hidden";
  if (surface.blockedByPriority) return "hidden";
  if (surface.promptAvailable) return "prompt";
  if (surface.ios) return "ios-manual";
  return "hidden";
}
