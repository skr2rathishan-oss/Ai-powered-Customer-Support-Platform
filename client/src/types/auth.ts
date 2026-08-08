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
