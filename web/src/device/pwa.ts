export function registerServiceWorker(): void {
  try {
    if (import.meta.env.PROD && "serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    }
  } catch { /* optional */ }
}

export function tryLockLandscape(): void {
  try {
    const lock = (screen.orientation as { lock?: (o: string) => Promise<void> } | undefined)?.lock;
    if (lock) void lock.call(screen.orientation, "landscape").catch(() => {});
  } catch { /* Android fullscreen only */ }
}
