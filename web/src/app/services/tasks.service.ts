import { Injectable } from '@angular/core';
import axios from 'axios';
import { environment } from '../../environments/environment';
import type { Task } from '../models/task.model';

@Injectable({ providedIn: 'root' })
export class TasksService {
  async getTasks(username: string, token: string): Promise<Task[]> {
    const response = await axios.get<Task[]>(
      `${environment.tasksApiBaseUrl}/api/tasks?owner=${username}`,
      { headers: { Authorization: 'Bearer ' + token } }
    );
    return response.data;
  }
}