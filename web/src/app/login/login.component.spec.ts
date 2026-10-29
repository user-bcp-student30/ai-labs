import '@angular/compiler';
import { Router } from '@angular/router';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../services/auth.service';
import { LoginComponent } from './login.component';

describe('LoginComponent login validation', () => {
  let router: { navigate: ReturnType<typeof vi.fn> };
  let authService: {
    loadPreferences: ReturnType<typeof vi.fn>;
    login: ReturnType<typeof vi.fn>;
    saveSession: ReturnType<typeof vi.fn>;
  };

  function createComponent(): LoginComponent {
    return new LoginComponent(router as unknown as Router, authService as unknown as AuthService);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    router = { navigate: vi.fn().mockResolvedValue(true) };
    authService = {
      loadPreferences: vi.fn((preferences) => preferences),
      login: vi.fn(),
      saveSession: vi.fn()
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders login messages as interpolated text with static formatting', () => {
    const template = readFileSync(new URL('./login.component.html', import.meta.url), 'utf8');

    expect(template).not.toContain('[innerHTML]');
    expect(template).toContain('<strong>{{ message }}</strong>');
    expect(template).toContain('{{ messageDetail }}');
  });

  it('shows the username validation message without calling the API', async () => {
    const component = createComponent();
    component.username = '  ';
    component.password = 'Workshop123!';

    await component.login();

    expect(component.message).toBe('Ingrese un usuario.');
    expect(component.busy).toBe(false);
    expect(authService.login).not.toHaveBeenCalled();
  });

  it.each([null, undefined])('rejects a %s username', async (username) => {
    const component = createComponent();
    component.username = username;
    component.password = 'Workshop123!';

    await component.login();

    expect(component.message).toBe('Ingrese un usuario.');
    expect(authService.login).not.toHaveBeenCalled();
  });

  it('shows the password validation message without calling the API', async () => {
    const component = createComponent();
    component.username = 'student';
    component.password = '  ';

    await component.login();

    expect(component.message).toBe('Ingrese una contraseña.');
    expect(component.busy).toBe(false);
    expect(authService.login).not.toHaveBeenCalled();
  });

  it.each([null, undefined])('rejects a %s password', async (password) => {
    const component = createComponent();
    component.username = 'student';
    component.password = password;

    await component.login();

    expect(component.message).toBe('Ingrese una contraseña.');
    expect(authService.login).not.toHaveBeenCalled();
  });

  it('preserves the successful login behavior', async () => {
    authService.login.mockResolvedValue({ token: 'test-token', user: { username: 'student' } });
    const component = createComponent();
    component.username = 'student';
    component.password = 'Workshop123!';
    component.preferences = { theme: 'dark', showTips: false, compact: true };

    await component.login();

    expect(authService.login).toHaveBeenCalledWith({
      username: 'student',
      password: 'Workshop123!',
      client: 'angular-workshop'
    });
    expect(authService.saveSession).toHaveBeenCalledWith(
      'test-token',
      { username: 'student' },
      { theme: 'dark', showTips: false, compact: true }
    );
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
    expect(component.busy).toBe(false);
  });

  it('shows the missing-token message when the response has no token', async () => {
    authService.login.mockResolvedValue({});
    const component = createComponent();
    component.username = 'student';
    component.password = 'Workshop123!';

    await component.login();

    expect(component.message).toBe('El backend respondió sin token.');
    expect(component.busy).toBe(false);
  });

  it('rejects a response with a token but no user without saving a session', async () => {
    authService.login.mockResolvedValue({ token: 'test-token' });
    const component = createComponent();
    component.username = 'student';
    component.password = 'Workshop123!';

    await component.login();

    expect(component.message).toBe('El backend respondió sin usuario.');
    expect(authService.saveSession).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(component.busy).toBe(false);
  });

  it('shows the unavailable authentication service message and clears the busy state', async () => {
    authService.login.mockRejectedValue(new Error('offline'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const component = createComponent();
    component.username = 'student';
    component.password = 'Workshop123!';

    await component.login();

    expect(component.message).toBe('No se pudo autenticar a student.');
    expect(component.messageDetail).toBe('offline');
    expect(component.busy).toBe(false);
  });

  it('shows the timeout message and always clears the busy state', async () => {
    authService.login.mockRejectedValue(Object.assign(new Error('timeout of 5000ms exceeded'), {
      code: 'ECONNABORTED'
    }));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const component = createComponent();
    component.username = 'student';
    component.password = 'Workshop123!';

    await component.login();

    expect(component.message).toBe('No se pudo autenticar a student.');
    expect(component.messageDetail).toBe('timeout of 5000ms exceeded');
    expect(component.busy).toBe(false);
  });
});