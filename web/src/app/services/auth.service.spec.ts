import '@angular/compiler';
import axios from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LoginRequest } from '../models/auth.model';
import { AuthService } from './auth.service';

vi.mock('axios', () => ({
  default: {
    post: vi.fn()
  }
}));

const postLogin = vi.mocked(axios.post);

describe('AuthService', () => {
  let service: AuthService;
  let storage: {
    getItem: ReturnType<typeof vi.fn>;
    setItem: ReturnType<typeof vi.fn>;
    removeItem: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    storage = {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn(),
      removeItem: vi.fn()
    };
    vi.stubGlobal('localStorage', storage);
    service = new AuthService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('preserves the login endpoint, request body, and timeout', async () => {
    const responseBody = { token: 'test-token', user: { username: 'student' } };
    postLogin.mockResolvedValue({ data: responseBody } as never);
    const request: LoginRequest = {
      username: 'student',
      password: 'Workshop123!',
      client: 'angular-workshop'
    };

    await expect(service.login(request)).resolves.toEqual(responseBody);

    expect(postLogin).toHaveBeenCalledWith(
      'http://localhost:8080/auth/login',
      request,
      { timeout: 5000 }
    );
  });

  it('loads preferences over the existing defaults', () => {
    storage.getItem.mockReturnValue(JSON.stringify({ theme: 'dark' }));
    const defaults = { theme: 'light', showTips: true, compact: false };

    expect(service.loadPreferences(defaults)).toEqual({ theme: 'dark', showTips: true, compact: false });
    expect(storage.getItem).toHaveBeenCalledWith('workshop_preferences');
  });

  it('reads the user from storage and starts without a persisted token', () => {
    storage.getItem.mockImplementation((key: string) => {
      if (key === 'workshop_user') return JSON.stringify({ username: 'student' });
      return null;
    });

    expect(service.getToken()).toBeNull();
    expect(service.getUser()).toEqual({ username: 'student' });
  });

  it('removes a token left in storage by an older session', () => {
    storage.removeItem.mockClear();
    const newService = new AuthService();

    expect(storage.removeItem).toHaveBeenCalledWith('workshop_token');
    expect(newService.getToken()).toBeNull();
  });

  it('keeps the token in memory and saves user and preferences using existing keys', () => {
    const user = { username: 'student' };
    const preferences = { theme: 'dark', showTips: false, compact: true };

    service.saveSession('test-token', user, preferences);

    expect(service.getToken()).toBe('test-token');
    expect(storage.setItem).not.toHaveBeenCalledWith('workshop_token', 'test-token');
    expect(storage.setItem).toHaveBeenCalledWith('workshop_user', JSON.stringify(user));
    expect(storage.setItem).toHaveBeenCalledWith('workshop_preferences', JSON.stringify(preferences));
    expect(new AuthService().getToken()).toBeNull();
  });

  it('clears the in-memory token and user while preserving preferences', () => {
    service.saveSession('test-token', { username: 'student' }, {});
    storage.removeItem.mockClear();

    service.clearSession();

    expect(service.getToken()).toBeNull();
    expect(storage.removeItem).toHaveBeenCalledWith('workshop_token');
    expect(storage.removeItem).toHaveBeenCalledWith('workshop_user');
    expect(storage.removeItem).not.toHaveBeenCalledWith('workshop_preferences');
  });
});