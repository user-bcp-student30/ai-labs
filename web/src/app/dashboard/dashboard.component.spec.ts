import '@angular/compiler';
import { ChangeDetectorRef, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../services/auth.service';
import { TasksService } from '../services/tasks.service';
import { DashboardComponent } from './dashboard.component';

describe('DashboardComponent task flow', () => {
  let router: { navigate: ReturnType<typeof vi.fn> };
  let changeDetector: { detectChanges: ReturnType<typeof vi.fn> };
  let zone: { run: ReturnType<typeof vi.fn> };
  let authService: {
    getToken: ReturnType<typeof vi.fn>;
    getUser: ReturnType<typeof vi.fn>;
    clearSession: ReturnType<typeof vi.fn>;
  };
  let tasksService: { getTasks: ReturnType<typeof vi.fn> };

  function createComponent(): DashboardComponent {
    return new DashboardComponent(
      router as unknown as Router,
      changeDetector as unknown as ChangeDetectorRef,
      zone as unknown as NgZone,
      authService as unknown as AuthService,
      tasksService as unknown as TasksService
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
    router = { navigate: vi.fn().mockResolvedValue(true) };
    changeDetector = { detectChanges: vi.fn() };
    zone = { run: vi.fn((callback: () => void) => callback()) };
    authService = {
      getToken: vi.fn().mockReturnValue('test-token'),
      getUser: vi.fn().mockReturnValue({ username: 'student', displayName: 'Student' }),
      clearSession: vi.fn()
    };
    tasksService = { getTasks: vi.fn() };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('redirects to login when no token is stored', async () => {
    authService.getToken.mockReturnValue(null);
    const component = createComponent();

    await component.ngOnInit();

    expect(router.navigate).toHaveBeenCalledWith(['/login']);
    expect(tasksService.getTasks).not.toHaveBeenCalled();
  });

  it.each([
    ['TODO', 'Por hacer'],
    ['IN_PROGRESS', 'En progreso'],
    ['DONE', 'Completado'],
    ['RESUELTO', 'Resuelto'],
    ['COMPLETED', 'Completado']
  ])('maps status %s to its visible label', (status, label) => {
    expect(createComponent().statusLabel(status)).toBe(label);
  });

  it('preserves unknown statuses and renders missing status as empty text', () => {
    const component = createComponent();

    expect(component.statusLabel('CUSTOM')).toBe('CUSTOM');
    expect(component.statusLabel(undefined)).toBe('');
  });

  it('requests, filters, labels, and sorts tasks using the stored user and token', async () => {
    tasksService.getTasks.mockResolvedValue([
      { title: 'Low priority', status: 'TODO', priority: 'LOW', owner: 'student' },
      { title: 'High priority', status: 'IN_PROGRESS', priority: 'HIGH', owner: 'student' },
      { title: 'Archived', status: 'ARCHIVED', priority: 'URGENT', owner: 'student' }
    ]);
    const component = createComponent();

    await component.ngOnInit();

    expect(tasksService.getTasks).toHaveBeenCalledWith('student', 'test-token');
    expect(component.visibleTasks.map((task) => task.title)).toEqual(['Low priority', 'High priority']);
    expect(component.visibleTasks.map((task) => task.label)).toEqual(['LOW · STUDENT', 'HIGH · STUDENT']);
    expect(component.tasks).toHaveLength(3);
    expect(component.loading).toBe(false);
    expect(changeDetector.detectChanges).toHaveBeenCalled();
  });

  it('shows the backend detail when task loading fails', async () => {
    tasksService.getTasks.mockRejectedValue({ response: { data: { detail: 'Tasks unavailable' } } });
    const component = createComponent();

    await component.ngOnInit();

    expect(component.error).toBe('Tasks unavailable');
    expect(component.loading).toBe(false);
    expect(changeDetector.detectChanges).toHaveBeenCalled();
  });

  it('shows the invalid-token detail without clearing the session or redirecting', async () => {
    tasksService.getTasks.mockRejectedValue({
      response: { status: 401, data: { detail: 'Invalid token' } }
    });
    const component = createComponent();

    await component.ngOnInit();

    expect(component.error).toBe('Invalid token');
    expect(component.loading).toBe(false);
    expect(authService.clearSession).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('shows an error when a successful response is not an iterable task list', async () => {
    tasksService.getTasks.mockResolvedValue(null as never);
    const component = createComponent();

    await component.ngOnInit();

    expect(component.error).not.toBe('');
    expect(component.loading).toBe(false);
  });

  it('clears the session but preserves preferences on logout', async () => {
    const component = createComponent();

    await component.logout();

    expect(authService.clearSession).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });
});