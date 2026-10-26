import { isRecord } from '../utils/type-guards';

export interface LoginRequest {
  username: string;
  password: string;
  client: string;
}

export interface AuthenticatedUser {
  username?: string;
  displayName?: string;
  role?: string;
}

export interface LoginResponse {
  token?: string;
  user?: AuthenticatedUser;
}

export type UserPreferences = Record<string, unknown>;

export function isAuthenticatedUser(value: unknown): value is AuthenticatedUser {
  if (!isRecord(value)) {
    return false;
  }

  return ['username', 'displayName', 'role'].every((field) =>
    value[field] === undefined || typeof value[field] === 'string'
  );
}