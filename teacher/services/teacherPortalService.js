import { buildAuthHeaders, getApiBase, parseJsonResponse } from "./http";
import { getToken } from "./portal";

const ACCESS_PROFILE_CACHE_TTL_MS = 5 * 60 * 1000;
let accessProfileCache = null;
let accessProfileRequest = null;

export const fetchTeacherDashboard = async () => {
  const response = await fetch(`${getApiBase()}/teacher/dashboard`, {
    headers: buildAuthHeaders(),
  });

  const data = await parseJsonResponse(response);
  return data?.data || {};
};

export const fetchTeacherStudents = async (query = {}) => {
  const params = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      params.set(key, String(value));
    }
  });

  const suffix = params.toString() ? `?${params.toString()}` : "";

  const response = await fetch(`${getApiBase()}/teacher/students${suffix}`, {
    headers: buildAuthHeaders(),
  });

  const data = await parseJsonResponse(response);
  return data?.data || {};
};

export const fetchTeacherEarningsSummary = async (options = {}) => {
  const params = new URLSearchParams();
  if (options.month) params.set("month", String(options.month));
  if (options.courseId) params.set("courseId", String(options.courseId));
  if (options.paymentPlan) params.set("paymentPlan", String(options.paymentPlan));
  if (options.payoutStatus) params.set("payoutStatus", String(options.payoutStatus));
  const suffix = params.toString() ? `?${params.toString()}` : "";

  const response = await fetch(`${getApiBase()}/teacher/earnings${suffix}`, {
    headers: buildAuthHeaders(),
    cache: "no-store",
    signal: options.signal,
  });

  const data = await parseJsonResponse(response);
  return data || {};
};

export const fetchTeacherBankTransferPayments = async (options = {}) => {
  const params = new URLSearchParams();
  if (options.status) params.set("status", String(options.status));
  const suffix = params.toString() ? `?${params.toString()}` : "";

  const response = await fetch(`${getApiBase()}/teacher/bank-transfer-payments${suffix}`, {
    headers: buildAuthHeaders(),
    cache: "no-store",
    signal: options.signal,
  });

  const data = await parseJsonResponse(response);
  return Array.isArray(data?.payments) ? data.payments : [];
};

const reviewTeacherBankTransferPayment = async (paymentId, action, note = "") => {
  const response = await fetch(`${getApiBase()}/teacher/bank-transfer-payments/${encodeURIComponent(paymentId)}/${action}`, {
    method: "PATCH",
    headers: buildAuthHeaders(),
    body: JSON.stringify({ note }),
  });

  const data = await parseJsonResponse(response);
  return data?.payment || null;
};

export const approveTeacherBankTransferPayment = (paymentId, note = "") =>
  reviewTeacherBankTransferPayment(paymentId, "approve", note);

export const rejectTeacherBankTransferPayment = (paymentId, note = "") =>
  reviewTeacherBankTransferPayment(paymentId, "reject", note);

export const fetchTeacherProfile = async () => {
  const response = await fetch(`${getApiBase()}/teacher/profile?t=${Date.now()}`, {
    headers: buildAuthHeaders(),
    cache: "no-store",
  });

  const data = await parseJsonResponse(response);
  return data?.data || {};
};

export const fetchTeacherAccessProfile = async () => {
  const token = getToken() || "";
  const now = Date.now();
  if (
    accessProfileCache?.token === token &&
    now - Number(accessProfileCache?.updatedAt || 0) < ACCESS_PROFILE_CACHE_TTL_MS
  ) {
    return accessProfileCache.data;
  }
  if (accessProfileRequest?.token === token) {
    return accessProfileRequest.promise;
  }

  const promise = fetch(`${getApiBase()}/teacher/profile`, {
    headers: buildAuthHeaders(),
  })
    .then(parseJsonResponse)
    .then((data) => {
      const profile = data?.data || {};
      accessProfileCache = {
        token,
        data: profile,
        updatedAt: Date.now(),
      };
      return profile;
    })
    .finally(() => {
      if (accessProfileRequest?.promise === promise) {
        accessProfileRequest = null;
      }
    });

  accessProfileRequest = { token, promise };
  return promise;
};

export const invalidateTeacherAccessProfile = () => {
  accessProfileCache = null;
  accessProfileRequest = null;
};

export const updateTeacherProfile = async (payload = {}) => {
  const formData = new FormData();
  const normalizedPayload = payload || {};

  Object.entries(normalizedPayload).forEach(([key, value]) => {
    if (value === undefined || value === null) return;

    if (key === "avatarFile") {
      if (value instanceof File) {
        formData.append("avatar", value);
      }
      return;
    }

    if (key === "cvFile") {
      if (value instanceof File) {
        formData.append("cvFile", value);
      }
      return;
    }

    if (key === "certificateFiles") {
      if (Array.isArray(value)) {
        value.forEach((file) => {
          if (file instanceof File) {
            formData.append("certificateFiles", file);
          }
        });
      }
      return;
    }

    if (typeof value === "object" && !(value instanceof Blob)) {
      if (key === "bankPaymentInfo") {
        const normalizedBankPaymentInfo = value || {};
        formData.append(key, JSON.stringify(normalizedBankPaymentInfo));
        formData.append(
          "bankCountry",
          String(normalizedBankPaymentInfo.country || ""),
        );
        formData.append(
          "bankAccountHolderName",
          String(normalizedBankPaymentInfo.accountHolderName || ""),
        );
        formData.append(
          "bankBankName",
          String(normalizedBankPaymentInfo.bankName || ""),
        );
        formData.append(
          "bankAccountNumber",
          String(normalizedBankPaymentInfo.accountNumber || ""),
        );
        formData.append(
          "bankCardNumber",
          String(normalizedBankPaymentInfo.cardNumber || ""),
        );
        formData.append("bankIban", String(normalizedBankPaymentInfo.iban || ""));
        formData.append(
          "bankSwiftCode",
          String(normalizedBankPaymentInfo.swiftCode || ""),
        );
        formData.append(
          "bankCurrency",
          String(normalizedBankPaymentInfo.currency || ""),
        );
        formData.append(
          "bankPaymentNote",
          String(normalizedBankPaymentInfo.paymentNote || normalizedBankPaymentInfo.note || ""),
        );
        return;
      }

      formData.append(key, JSON.stringify(value));
      return;
    }

    formData.append(key, String(value));
  });

  const token = getToken();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  const response = await fetch(`${getApiBase()}/auth/profile`, {
    method: "PATCH",
    headers,
    body: formData,
  });

  const data = await parseJsonResponse(response);
  invalidateTeacherAccessProfile();
  return {
    message: data?.message || "",
    user: data?.user || null,
  };
};
