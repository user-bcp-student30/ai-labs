import { Injectable } from '@angular/core';
import axios from 'axios';
import merge from 'lodash/merge';
import { environment } from '../../environments/environment';
import {
  isAuthenticatedUser,
  type AuthenticatedUser,
  type LoginRequest,
  type LoginResponse,
  type UserPreferences
} from '../models/auth.model';
import { isRecord } from '../utils/type-guards';

const STORAGE_KEYS = {
  token: 'workshop_token',
  user: 'workshop_user',
  preferences: 'workshop_preferences'
} as const;

const LOGIN_TIMEOUT_MS = 5000;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private token: string | null = null;

  constructor() {
    localStorage.removeItem(STORAGE_KEYS.token);
  }

  async login(request: LoginRequest): Promise<LoginResponse> {
    const response = await axios.post<LoginResponse>(
      `${environment.authApiBaseUrl}/auth/login`,
      request,
      { timeout: LOGIN_TIMEOUT_MS }
    );
    return response.data;
  }

  getToken(): string | null {
    return this.token;
  }

  getUser(): AuthenticatedUser {
    const storedUser: unknown = JSON.parse(localStorage.getItem(STORAGE_KEYS.user) || '{}');
    return isAuthenticatedUser(storedUser) ? storedUser : {};
  }

  loadPreferences(defaultPreferences: UserPreferences): UserPreferences {
    try {
      const savedPreferences: unknown = JSON.parse(localStorage.getItem(STORAGE_KEYS.preferences) || '{}');
      return isRecord(savedPreferences) ? merge(defaultPreferences, savedPreferences) : defaultPreferences;
    } catch (error) {
      console.log('Preferences could not be loaded', error);
      return defaultPreferences;
    }
  }

  saveSession(token: string, user: AuthenticatedUser, preferences: UserPreferences): void {
    this.token = token;
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
    localStorage.setItem(STORAGE_KEYS.preferences, JSON.stringify(preferences));
  }

  clearSession(): void {
    this.token = null;
    localStorage.removeItem(STORAGE_KEYS.token);
    localStorage.removeItem(STORAGE_KEYS.user);
  }
}