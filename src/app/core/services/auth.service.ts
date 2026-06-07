import { Injectable, signal } from '@angular/core';

/**
 * Static auth — hardcoded credentials, no backend involvement.
 * Persists "logged in" flag (and username) in localStorage so a refresh
 * doesn't bounce the user back to the login screen.
 *
 * For the POC. Replace with a real OIDC/SAML flow before production.
 */
const STORAGE_KEY = 'iraa.session';

// Static accounts. Both share the same set of accepted credentials.
const ACCOUNTS: ReadonlyArray<{ username: string; password: string }> = [
  { username: 'admin', password: 'sabb2026' },
  { username: 'demo', password: 'sabb2026' },
];

interface StoredSession {
  username: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly _user = signal<string | null>(this.loadInitial());
  readonly user = this._user.asReadonly();
  readonly isAuthenticated = () => this._user() !== null;
  readonly isAdmin = () => this._user() === 'admin';

  login(username: string, password: string): boolean {
    const u = username.trim();
    const ok = ACCOUNTS.some((a) => a.username === u && a.password === password);
    if (!ok) return false;
    const session: StoredSession = { username: u };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
      // ignore quota / privacy-mode errors; session stays in-memory
    }
    this._user.set(u);
    return true;
  }

  logout(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    this._user.set(null);
  }

  private loadInitial(): string | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as StoredSession;
      return parsed?.username ?? null;
    } catch {
      return null;
    }
  }
}
