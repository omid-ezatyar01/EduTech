import { useEffect, useRef } from "react";

const DEFAULT_EVENTS = ["edutech_data_changed", "teacher_auth_change"];

export default function useLiveDataRefresh(onRefresh, options = {}) {
  const {
    intervalMs = 0,
    enabled = true,
    runOnMount = false,
    refreshOnFocus = true,
    refreshOnVisible = true,
    events = DEFAULT_EVENTS,
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
      if (refreshOnVisible && document.visibilityState === "visible") {
        triggerRefresh();
      }
    };

    if (runOnMount) {
      triggerRefresh();
    }

    const intervalId =
      intervalMs > 0
        ? window.setInterval(() => {
            if (document.visibilityState === "visible") {
              triggerRefresh();
            }
          }, intervalMs)
        : null;

    if (refreshOnFocus) {
      window.addEventListener("focus", triggerRefresh);
    }
    if (refreshOnVisible) {
      document.addEventListener("visibilitychange", handleVisibility);
    }

    const safeEvents = Array.isArray(events) ? events.filter(Boolean) : [];
    safeEvents.forEach((eventName) => {
      window.addEventListener(eventName, triggerRefresh);
    });

    return () => {
      if (intervalId) window.clearInterval(intervalId);
      if (refreshOnFocus) {
        window.removeEventListener("focus", triggerRefresh);
      }
      if (refreshOnVisible) {
        document.removeEventListener("visibilitychange", handleVisibility);
      }
      safeEvents.forEach((eventName) => {
        window.removeEventListener(eventName, triggerRefresh);
      });
    };
  }, [enabled, intervalMs, refreshOnFocus, refreshOnVisible, runOnMount, events]);
}
