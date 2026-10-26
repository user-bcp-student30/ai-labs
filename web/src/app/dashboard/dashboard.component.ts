import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, NgZone, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { TasksService } from '../services/tasks.service';
import type { AuthenticatedUser } from '../models/auth.model';
import type { Task } from '../models/task.model';
import { getErrorMessage } from '../utils/error-message';
import { formatTaskLabel } from '../utils/legacy-format';

const STATUS_LABELS: Record<string, string> = {
  TODO: 'Por hacer',
  IN_PROGRESS: 'En progreso',
  DONE: 'Completado',
  RESUELTO: 'Resuelto',
  COMPLETED: 'Completado'
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit {
  tasks: Task[] = [];
  visibleTasks: Task[] = [];
  user: AuthenticatedUser = {};
  loading = true;
  error = '';

  constructor(
    private router: Router,
    private cdr: ChangeDetectorRef,
    private zone: NgZone,
    private authService: AuthService,
    private tasksService: TasksService
  ) {}

  statusLabel(status: string | undefined): string {
    return STATUS_LABELS[(status || '').toUpperCase()] || status || '';
  }

  async ngOnInit(): Promise<void> {
    const token = this.authService.getToken();
    this.user = this.authService.getUser();
    if (!token) {
      await this.router.navigate(['/login']);
      return;
    }
    try {
      const tasks = await this.tasksService.getTasks(this.user.username || '', token);
      const visibleTasks: Task[] = [];
      for (const task of tasks) {
        if (task.status !== 'ARCHIVED') {
          task.label = formatTaskLabel(task);
          visibleTasks.push(task);
        }
      }
      visibleTasks.sort((firstTask, secondTask) =>
        typeof firstTask.priority === 'string' && typeof secondTask.priority === 'string' &&
        firstTask.priority > secondTask.priority ? -1 : 1
      );
      // La petición puede resolverse fuera de la zona de Angular (más aún llegando
      // por navegación desde el login): forzamos volver a entrar a la zona
      // y disparamos detectChanges a mano para no depender de que Angular
      // lo detecte solo.
      this.zone.run(() => {
        this.tasks = tasks;
        this.visibleTasks = visibleTasks;
        this.loading = false;
        this.cdr.detectChanges();
      });
    } catch (error: unknown) {
      this.zone.run(() => {
        this.error = getErrorMessage(error, 'detail', 'No se pudo cargar el dashboard');
        this.loading = false;
        this.cdr.detectChanges();
      });
    }
  }

  async logout(): Promise<void> {
    this.authService.clearSession();
    await this.router.navigate(['/login']);
  }
}
