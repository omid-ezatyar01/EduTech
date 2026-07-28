import { useEffect, useRef } from "react";
import { getAuthUser } from "../../services/portal.js";

const STORAGE_PREFIX = "edutech_teacher_form_draft:";
const SENSITIVE_FIELD_PATTERN = /password|passcode|secret|token|otp/i;

function getTeacherScope() {
  const teacher = getAuthUser() || {};
  return String(teacher._id || teacher.id || teacher.email || "teacher");
}

function getStorageKey(draftId) {
  return `${STORAGE_PREFIX}${getTeacherScope()}:${String(draftId || "form")}`;
}

function sanitizeDraftValue(value, key = "") {
  if (SENSITIVE_FIELD_PATTERN.test(key)) return undefined;
  if (typeof File !== "undefined" && value instanceof File) return undefined;
  if (typeof Blob !== "undefined" && value instanceof Blob) return undefined;
  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeDraftValue(item))
      .filter((item) => item !== undefined);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .map(([childKey, childValue]) => [
          childKey,
          sanitizeDraftValue(childValue, childKey),
        ])
        .filter(([, childValue]) => childValue !== undefined),
    );
  }
  return value;
}

export function readTeacherFormDraft(draftId) {
  if (!draftId || typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(getStorageKey(draftId)) || "null");
    return parsed && Object.prototype.hasOwnProperty.call(parsed, "value")
      ? parsed.value
      : null;
  } catch {
    return null;
  }
}

export function mergeTeacherFormDraft(draftId, initialValue) {
  const saved = readTeacherFormDraft(draftId);
  if (!saved) return initialValue;
  return { ...initialValue, ...saved };
}

export function clearTeacherFormDraft(draftId) {
  if (!draftId || typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(getStorageKey(draftId));
  } catch {
    // Storage can be unavailable in private browsing or restricted webviews.
  }
}

function writeTeacherFormDraft(draftId, value) {
  if (!draftId || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      getStorageKey(draftId),
      JSON.stringify({
        savedAt: new Date().toISOString(),
        value: sanitizeDraftValue(value),
      }),
    );
  } catch {
    // A draft should never prevent the teacher from continuing to edit.
  }
}

export default function usePersistentFormDraft({
  draftId,
  value,
  setValue,
  enabled = true,
  restore = true,
}) {
  const latestValueRef = useRef(value);
  const activeDraftRef = useRef("");

  useEffect(() => {
    latestValueRef.current = value;
  }, [value]);

  useEffect(() => {
    if (!enabled || !draftId) {
      activeDraftRef.current = "";
      return;
    }

    activeDraftRef.current = draftId;
    if (!restore || typeof setValue !== "function") return;
    const saved = readTeacherFormDraft(draftId);
    if (saved) {
      setValue((current) =>
        current &&
        saved &&
        typeof current === "object" &&
        typeof saved === "object"
          ? { ...current, ...saved }
          : saved,
      );
    }
  }, [draftId, enabled, restore, setValue]);

  useEffect(() => {
    if (!enabled || !draftId || activeDraftRef.current !== draftId) return undefined;

    const save = () => writeTeacherFormDraft(draftId, latestValueRef.current);
    const timer = window.setTimeout(save, 300);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") save();
    };

    window.addEventListener("pagehide", save);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pagehide", save);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [draftId, enabled, value]);
}
