import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { type LoginRequest, type UserPreferences } from '../models/auth.model';
import { getErrorMessage } from '../utils/error-message';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  username = '';
  password = '';
  busy = false;
  message = '';
  messageDetail = '';
  preferences: UserPreferences = { theme: 'light', showTips: true, compact: false };

  constructor(private router: Router, private authService: AuthService) {
    this.preferences = this.authService.loadPreferences(this.preferences);
  }

  async login(): Promise<void> {
    this.message = '';
    this.messageDetail = '';
    if (this.username === null || this.username === undefined || String(this.username).trim() === '') {
      this.message = 'Ingrese un usuario.';
      return;
    }
    if (this.password === null || this.password === undefined || String(this.password).trim() === '') {
      this.message = 'Ingrese una contraseña.';
      return;
    }

    this.busy = true;
    try {
      const request: LoginRequest = {
        username: this.username,
        password: this.password,
        client: 'angular-workshop'
      };
      const response = await this.authService.login(request);
      if (!response || !response.token) {
        this.message = 'El backend respondió sin token.';
        return;
      }
      if (!response.user) {
        this.message = 'El backend respondió sin usuario.';
        return;
      }

      this.authService.saveSession(response.token, response.user, this.preferences);
      await this.router.navigate(['/dashboard']);
    } catch (error: unknown) {
      const backendMessage = getErrorMessage(error, 'message', 'Error desconocido');
      this.message = 'No se pudo autenticar a ' + this.username + '.';
      this.messageDetail = backendMessage;
      console.error(error);
    } finally {
      this.busy = false;
    }
  }
}
