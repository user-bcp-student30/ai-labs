import '@angular/compiler';
import axios from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TasksService } from './tasks.service';

vi.mock('axios', () => ({
  default: {
    get: vi.fn()
  }
}));

const getTasks = vi.mocked(axios.get);

describe('TasksService', () => {
  let service: TasksService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TasksService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('preserves the tasks endpoint, owner query, and bearer header', async () => {
    const tasks = [{ title: 'Requirement', owner: 'student', status: 'TODO', priority: 'HIGH' }];
    getTasks.mockResolvedValue({ data: tasks } as never);

    await expect(service.getTasks('student', 'test-token')).resolves.toEqual(tasks);

    expect(getTasks).toHaveBeenCalledWith('http://localhost:8000/api/tasks?owner=student', {
      headers: { Authorization: 'Bearer test-token' }
    });
  });
});