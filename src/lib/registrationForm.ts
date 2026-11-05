export interface RegistrationFields {
  phoneNumber: string;
  code: string;
  password: string;
  confirmPassword: string;
  inviteCode: string;
  agreementAccepted: boolean;
  codeSent: boolean;
}

export type RegistrationFieldErrors = Partial<Record<
  'phoneNumber' | 'code' | 'password' | 'confirmPassword' | 'inviteCode' | 'agreement',
  string
>>;

export function normalizePhoneInput(value: string): string {
  return String(value || '').replace(/\D/g, '').slice(0, 11);
}

export function normalizeVerificationCode(value: string): string {
  return String(value || '').replace(/\D/g, '').slice(0, 6);
}

export function normalizeInviteCode(value: string): string {
  return String(value || '').replace(/[^a-z0-9]/gi, '').slice(0, 7);
}

export function isValidPhoneNumber(value: string): boolean {
  return /^1\d{10}$/.test(value);
}

export function validateRegistrationFields(fields: RegistrationFields): RegistrationFieldErrors {
  const errors: RegistrationFieldErrors = {};
  if (!isValidPhoneNumber(fields.phoneNumber)) errors.phoneNumber = 'phoneInvalid';
  if (!fields.codeSent) {
    errors.code = 'codeNotSent';
  } else if (!/^\d{6}$/.test(fields.code)) {
    errors.code = 'codeLength';
  }
  if (fields.password.length < 6) errors.password = 'passwordMinLength';
  if (!fields.confirmPassword) {
    errors.confirmPassword = 'confirmPasswordRequired';
  } else if (fields.password !== fields.confirmPassword) {
    errors.confirmPassword = 'passwordMismatch';
  }
  if (fields.inviteCode && !/^[a-z0-9]{7}$/i.test(fields.inviteCode)) {
    errors.inviteCode = 'inviteCodeInvalid';
  }
  if (!fields.agreementAccepted) errors.agreement = 'agreementRequired';
  return errors;
}

