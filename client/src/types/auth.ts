export type LoginMode = "individual" | "company";

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe: boolean;
}

export interface AuthUser {
  accountType: LoginMode;
  userId: number | string;
  companyId?: number | string;
  companyName?: string;
  email: string;
  adminEmail?: string;
  onlineStatus?: string;
  roleName: string;
}

export interface LoginResult {
  message: string;
  user: AuthUser;
}

export interface LoginFormValues extends LoginCredentials {
  passwordVisible: boolean;
}

export interface LoginFormErrors {
  email?: string;
  password?: string;
}

export interface CompanyRegistrationValues {
  companyName: string;
  industry: string;
  businessEmail: string;
  phone: string;
  website: string;
  description: string;
  adminFirstName: string;
  adminLastName: string;
  adminEmail: string;
  password: string;
  confirmPassword: string;
}

export type CompanyRegistrationField = keyof CompanyRegistrationValues;
export type CompanyRegistrationErrors = Partial<
  Record<CompanyRegistrationField, string>
>;

export type CompanyRegistrationPayload = Omit<
  CompanyRegistrationValues,
  "confirmPassword"
>;
