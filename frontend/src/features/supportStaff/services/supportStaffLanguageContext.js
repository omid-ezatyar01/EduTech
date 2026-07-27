import { createContext, useContext } from "react";

export const SupportStaffLanguageContext = createContext(null);

export function useSupportStaffLanguage() {
  const value = useContext(SupportStaffLanguageContext);
  if (!value) {
    throw new Error(
      "useSupportStaffLanguage must be used inside SupportStaffLanguageProvider",
    );
  }
  return value;
}
