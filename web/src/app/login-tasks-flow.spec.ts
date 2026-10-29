import '@angular/compiler';
import { ChangeDetectorRef, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import axios from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './services/auth.service';
import { TasksService } from './services/tasks.service';
import { DashboardComponent } from './dashboard/dashboard.component';
import { LoginComponent } from './login/login.component';

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn()
  }
}));

const postLogin = vi.mocked(axios.post);
const getTasks = vi.mocked(axios.get);

describe('Login to tasks flow', () => {
  let values: Map<string, string>;
  let router: { navigate: ReturnType<typeof vi.fn> };
  let authService: AuthService;
  let tasksService: TasksService;

  beforeEach(() => {
    vi.clearAllMocks();
    values = new Map();
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => values.set(key, String(value))),
      removeItem: vi.fn((key: string) => values.delete(key))
    });
    router = { navigate: vi.fn().mockResolvedValue(true) };
    authService = new AuthService();
    tasksService = new TasksService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('logs in, keeps the token in memory, and loads the authenticated tasks', async () => {
    postLogin.mockResolvedValue({
      data: { token: 'test-token', user: { username: 'student', displayName: 'Student' } }
    } as never);
    getTasks.mockResolvedValue({
      data: [
        { title: 'Requirement', owner: 'student', status: 'TODO', priority: 'HIGH' },
        { title: 'Archived', owner: 'student', status: 'ARCHIVED', priority: 'URGENT' }
      ]
    } as never);
    const loginComponent = new LoginComponent(router as unknown as Router, authService);
    loginComponent.username = 'student';
    loginComponent.password = 'Workshop123!';

    await loginComponent.login();

    const dashboardComponent = new DashboardComponent(
      router as unknown as Router,
      { detectChanges: vi.fn() } as unknown as ChangeDetectorRef,
      { run: (callback: () => void) => callback() } as unknown as NgZone,
      authService,
      tasksService
    );
    await dashboardComponent.ngOnInit();

    expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
    expect(postLogin).toHaveBeenCalledWith(
      'http://localhost:8080/auth/login',
      { username: 'student', password: 'Workshop123!', client: 'angular-workshop' },
      { timeout: 5000 }
    );
    expect(getTasks).toHaveBeenCalledWith('http://localhost:8000/api/tasks?owner=student', {
      headers: { Authorization: 'Bearer test-token' }
    });
    expect(dashboardComponent.visibleTasks.map((task) => task.title)).toEqual(['Requirement']);
    expect(dashboardComponent.loading).toBe(false);
    expect(values.get('workshop_user')).toContain('student');
    expect(values.has('workshop_token')).toBe(false);
  });

  it('does not create a session or request tasks when login omits the user', async () => {
    postLogin.mockResolvedValue({ data: { token: 'test-token' } } as never);
    const loginComponent = new LoginComponent(router as unknown as Router, authService);
    loginComponent.username = 'student';
    loginComponent.password = 'Workshop123!';

    await loginComponent.login();

    expect(loginComponent.message).toBe('El backend respondió sin usuario.');
    expect(authService.getToken()).toBeNull();
    expect(values.has('workshop_user')).toBe(false);
    expect(router.navigate).not.toHaveBeenCalled();

    const dashboardComponent = new DashboardComponent(
      router as unknown as Router,
      { detectChanges: vi.fn() } as unknown as ChangeDetectorRef,
      { run: (callback: () => void) => callback() } as unknown as NgZone,
      authService,
      tasksService
    );
    await dashboardComponent.ngOnInit();

    expect(router.navigate).toHaveBeenCalledWith(['/login']);
    expect(getTasks).not.toHaveBeenCalled();
  });
});