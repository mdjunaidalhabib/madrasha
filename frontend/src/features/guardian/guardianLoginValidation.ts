export function normalizeGuardianPhone(value: string) {
  return value.replace(/[০-৯]/g, (digit) => String(digit.charCodeAt(0) - 0x09e6)).replace(/[\s()-]/g, "");
}

export function validateGuardianLogin(phone: string, password: string) {
  const normalized = normalizeGuardianPhone(phone);
  return {
    phone: !normalized ? "phoneRequired" : !/^\+?\d{7,15}$/.test(normalized) ? "phoneInvalid" : null,
    password: !password.trim() ? "passwordRequired" : null,
  } as const;
}
