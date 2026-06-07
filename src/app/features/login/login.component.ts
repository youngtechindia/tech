import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="wrap">
      <form class="card login-card" (submit)="submit($event)">
        <div class="brand">
          <h1>Incident Report AI Assistant</h1>
          <p class="soft">Sign in to continue</p>
        </div>

        <label>
          <span class="lbl">Username</span>
          <input
            type="text"
            name="username"
            autocomplete="username"
            autofocus
            [(ngModel)]="username"
            [disabled]="submitting()"
          />
        </label>

        <label>
          <span class="lbl">Password</span>
          <input
            type="password"
            name="password"
            autocomplete="current-password"
            [(ngModel)]="password"
            [disabled]="submitting()"
          />
        </label>

        @if (error()) {
          <p class="error">{{ error() }}</p>
        }

        <button
          type="submit"
          class="primary block"
          [disabled]="submitting() || !username().trim() || !password()"
        >
          {{ submitting() ? 'Signing in…' : 'Sign in' }}
        </button>
      </form>
    </div>
  `,
  styles: [`
    .wrap {
      min-height: calc(100vh - 80px);
      display: grid;
      place-items: center;
      padding: 40px 16px;
      background: linear-gradient(180deg, #f5f7fb 0%, #eaeef6 100%);
    }
    .login-card {
      width: 100%;
      max-width: 380px;
      padding: 28px 28px 22px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .brand h1 {
      font-size: 18px;
      margin: 0 0 4px;
      letter-spacing: -0.2px;
    }
    .brand p { margin: 0; font-size: 13px; }
    label {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .lbl {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-soft);
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    input[type="text"], input[type="password"] {
      padding: 9px 11px;
      font-size: 14px;
      border: 1px solid var(--border, #e5e7eb);
      border-radius: 6px;
      outline: none;
      transition: border-color 0.15s ease;
    }
    input:focus {
      border-color: var(--blue, #2563eb);
    }
    button.primary.block {
      display: block;
      width: 100%;
      margin-top: 4px;
    }
    .error {
      color: var(--red);
      font-size: 13px;
      margin: 0;
    }
    .hint { margin: 8px 0 0; text-align: center; }
    .small { font-size: 12px; }
    .soft { color: var(--text-soft); }
  `],
})
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  username = signal('');
  password = signal('');
  error = signal<string | null>(null);
  submitting = signal(false);

  async submit(ev: Event): Promise<void> {
    ev.preventDefault();
    if (this.submitting()) return;
    this.error.set(null);
    this.submitting.set(true);
    // Tiny delay so the spinner is visible — UX nicety only.
    await new Promise((r) => setTimeout(r, 150));
    const ok = this.auth.login(this.username().trim(), this.password());
    this.submitting.set(false);
    if (!ok) {
      this.error.set('Invalid username or password.');
      return;
    }
    this.router.navigate(['/new']);
  }
}
