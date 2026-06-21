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
        <div class="brand-block">
          <div class="logo"></div>
          <h1>Incident Report AI Assistant</h1>
          <p class="soft">Sign in to your BRCM account to continue</p>
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
    :host { display: block; }
    .wrap {
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: var(--space-7) var(--space-4);
      background:
        radial-gradient(at 30% 0%, rgba(199, 210, 254, 0.45) 0px, transparent 50%),
        radial-gradient(at 80% 80%, rgba(167, 218, 219, 0.30) 0px, transparent 50%),
        var(--bg-soft);
    }
    .login-card {
      width: 100%;
      max-width: 420px;
      padding: var(--space-8) var(--space-7) var(--space-7);
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      box-shadow: var(--shadow-lg);
      border-radius: var(--radius-lg);
    }
    .brand-block {
      text-align: center;
      margin-bottom: var(--space-3);
    }
    .logo {
      width: 56px;
      height: 56px;
      margin: 0 auto var(--space-4);
      border-radius: 14px;
      background:
        radial-gradient(at 30% 25%, rgba(255,255,255,0.40) 0%, transparent 55%),
        linear-gradient(135deg, var(--brand) 0%, var(--blue) 100%);
      box-shadow:
        0 6px 14px rgba(30, 58, 138, 0.30),
        inset 0 1px 0 rgba(255, 255, 255, 0.25);
    }
    .brand-block h1 {
      font-size: var(--fs-xl);
      margin: 0 0 var(--space-1);
    }
    .brand-block p {
      font-size: var(--fs-sm);
      color: var(--text-soft);
    }
    label {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
    }
    .lbl {
      font-size: var(--fs-xs);
      font-weight: 600;
      color: var(--text-soft);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    button.primary.block {
      display: block;
      width: 100%;
      margin-top: var(--space-2);
      padding: 11px 14px;
      font-size: var(--fs-md);
    }
    .error {
      color: var(--red);
      font-size: var(--fs-sm);
      margin: 0;
      padding: 8px 12px;
      background: var(--red-soft);
      border-radius: var(--radius);
      border-left: 3px solid var(--red);
    }
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
    // Send each role to their natural landing page
    if (this.auth.isAdmin())        this.router.navigate(['/admin']);
    else if (this.auth.isChecker()) this.router.navigate(['/review']);
    else                            this.router.navigate(['/new']);
  }
}
