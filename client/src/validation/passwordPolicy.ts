import type { PasswordPolicy } from "../types/auth";

export const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  minPasswordLength: 8,
  requireSpecialChar: true,
};

/** Mirrors the server rule: upper, lower and digit always; length and symbol by policy. */
export function passwordMatchesPolicy(
  value: string,
  policy: PasswordPolicy = DEFAULT_PASSWORD_POLICY,
): boolean {
  if (value.length < policy.minPasswordLength || value.length > 128) {
    return false;
  }
  if (!/[a-z]/.test(value) || !/[A-Z]/.test(value) || !/\d/.test(value)) {
    return false;
  }
  return !policy.requireSpecialChar || /[^A-Za-z0-9\s]/.test(value);
}

export function passwordPolicyHint(
  policy: PasswordPolicy = DEFAULT_PASSWORD_POLICY,
): string {
  return `Use ${policy.minPasswordLength}–128 characters with uppercase, lowercase, number${
    policy.requireSpecialChar ? ", and symbol" : ""
  }.`;
}
