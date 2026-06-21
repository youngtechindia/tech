import { Injectable, signal } from '@angular/core';

/**
 * Static auth — hardcoded credentials, no backend involvement.
 * Persists "logged in" flag (and username + role) in localStorage so a
 * refresh doesn't bounce the user back to the login screen.
 *
 * For the POC. Replace with a real OIDC/SAML flow before production.
 *
 * Simulates Active Directory security groups: each account is assigned a
 * role (admin / maker / checker) that gates UI features and is sent to the
 * backend via the X-User header (see http-interceptors/user-header.ts).
 */
const STORAGE_KEY = 'iraa.session';

export type Role = 'admin' | 'maker' | 'checker';

interface Account {
  username: string;
  password: string;
  role: Role;
}

// Static accounts (mirrors backend app/api/user.py)
const ACCOUNTS: ReadonlyArray<Account> = [
  { username: 'admin',    password: 'sabb2026', role: 'admin'   },
  { username: 'maker1',   password: 'sabb2026', role: 'maker'   },
  { username: 'maker2',   password: 'sabb2026', role: 'maker'   },
  { username: 'checker1', password: 'sabb2026', role: 'checker' },
  { username: 'checker2', password: 'sabb2026', role: 'checker' },
  // Legacy 'demo' account from early POC; treated as a maker
  { username: 'demo',     password: 'sabb2026', role: 'maker'   },
];

interface StoredSession {
  username: string;
  role: Role;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly _session = signal<StoredSession | null>(this.loadInitial());
  readonly session = this._session.asReadonly();
  readonly user = () => this._session()?.username ?? null;
  readonly role = () => this._session()?.role ?? null;
  readonly isAuthenticated = () => this._session() !== null;
  readonly isAdmin   = () => this._session()?.role === 'admin';
  readonly isMaker   = () => this._session()?.role === 'maker';
  readonly isChecker = () => this._session()?.role === 'checker';

  login(username: string, password: string): boolean {
    const u = username.trim();
    const account = ACCOUNTS.find((a) => a.username === u && a.password === password);
    if (!account) return false;
    const session: StoredSession = { username: u, role: account.role };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
      // ignore quota / privacy-mode errors; session stays in-memory
    }
    this._session.set(session);
    return true;
  }

  logout(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    this._session.set(null);
  }

  private loadInitial(): StoredSession | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<StoredSession>;
      if (!parsed?.username) return null;
      // Backfill role for sessions saved before roles existed
      const role = (parsed.role ?? ACCOUNTS.find((a) => a.username === parsed.username)?.role) as Role | undefined;
      if (!role) return null;
      return { username: parsed.username, role };
    } catch {
      return null;
    }
  }
}
