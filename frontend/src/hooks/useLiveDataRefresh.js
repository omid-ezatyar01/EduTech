import { useEffect, useRef } from "react";

const DEFAULT_EVENTS = ["edutech_data_changed", "auth_change"];

export default function useLiveDataRefresh(onRefresh, options = {}) {
  const {
    intervalMs = 15000,
    enabled = true,
    runOnMount = false,
    events = DEFAULT_EVENTS,
    refreshOnWindowFocus = true,
    refreshOnVisibility = true,
  } = options;

  const refreshRef = useRef(onRefresh);

  useEffect(() => {
    refreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return undefined;

    const triggerRefresh = () => {
      try {
        const result = refreshRef.current?.();
        if (result && typeof result.catch === "function") {
          result.catch(() => {});
        }
      } catch {
        // Keep refresh loop resilient even if a page-level refresh throws.
      }
    };

    const handleVisibility = () => {
      if (refreshOnVisibility && document.visibilityState === "visible") {
        triggerRefresh();
      }
    };

    if (runOnMount) {
      triggerRefresh();
    }

    const intervalId =
      intervalMs > 0
        ? window.setInterval(() => {
            if (!refreshOnVisibility || document.visibilityState === "visible") {
              triggerRefresh();
            }
          }, intervalMs)
        : null;

    if (refreshOnWindowFocus) {
      window.addEventListener("focus", triggerRefresh);
    }
    if (refreshOnVisibility) {
      document.addEventListener("visibilitychange", handleVisibility);
    }

    const safeEvents = Array.isArray(events) ? events.filter(Boolean) : [];
    safeEvents.forEach((eventName) => {
      window.addEventListener(eventName, triggerRefresh);
    });

    return () => {
      if (intervalId) window.clearInterval(intervalId);
      if (refreshOnWindowFocus) {
        window.removeEventListener("focus", triggerRefresh);
      }
      if (refreshOnVisibility) {
        document.removeEventListener("visibilitychange", handleVisibility);
      }
      safeEvents.forEach((eventName) => {
        window.removeEventListener(eventName, triggerRefresh);
      });
    };
  }, [enabled, intervalMs, runOnMount, events, refreshOnVisibility, refreshOnWindowFocus]);
}
