import { Component, computed, inject } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs/operators';

import { AuthService } from './core/services/auth.service';
import { DraftService } from './core/services/draft.service';
import { ReasonPromptComponent } from './shared/reason-prompt.component';
import { TranslationCompareComponent } from './shared/translation-compare.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ReasonPromptComponent, TranslationCompareComponent],
  template: `
    @if (drafts.lastError(); as err) {
      <div class="alert">
        <span class="dot">⚠</span>
        <span class="msg">{{ err.message }}</span>
        <button class="x" (click)="drafts.clearError()" aria-label="dismiss">✕</button>
      </div>
    }
    @if (showChrome()) {
      <header class="topbar">
        <a class="brand" routerLink="/" aria-label="Incident Report AI Assistant">
          <span class="logo" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2.5 4.5 5.5v6.2c0 4.4 3.2 8 7.5 9.8 4.3-1.8 7.5-5.4 7.5-9.8V5.5L12 2.5z"/>
              <path d="m8.8 12.2 2.2 2.2 4.2-4.4"/>
            </svg>
          </span>
          <span class="brand-text">
            <span class="brand-product">Incident Report</span>
            <span class="brand-suffix">AI Assistant</span>
          </span>
        </a>
        <span class="vsep" aria-hidden="true"></span>
        <nav>
          @if (auth.isMaker() || auth.isAdmin()) {
            <a routerLink="/new" routerLinkActive="active">New Report</a>
          }
          @if (auth.isChecker() || auth.isAdmin()) {
            <a routerLink="/review" routerLinkActive="active">Review Queue</a>
          }
          <a routerLink="/history" routerLinkActive="active">History</a>
          @if (auth.isAdmin()) {
            <a routerLink="/admin" routerLinkActive="active">Admin</a>
          }
        </nav>
        @if (auth.user(); as u) {
          <div class="user">
            <div class="user-chip" [title]="u">
              <span class="avatar" [class]="'avatar-' + (auth.role() ?? 'guest')">
                {{ u.charAt(0).toUpperCase() }}
              </span>
              <div class="user-meta">
                <span class="name">{{ u }}</span>
                @if (auth.role(); as r) {
                  <span class="role" [class]="'role-' + r">{{ r }}</span>
                }
              </div>
            </div>
            <button class="logout" (click)="logout()" title="Sign out">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none"
                   stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              <span>Sign out</span>
            </button>
          </div>
        }
      </header>
    }
    <main class="page">
      <router-outlet />
    </main>
    <reason-prompt />
    <translation-compare />
  `,
  styleUrl: './app.css',
})
export class App {
  auth = inject(AuthService);
  drafts = inject(DraftService);
  private router = inject(Router);

  /** Hide the top bar on /login (and on unknown / pre-init paths). */
  private currentUrl = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );
  showChrome = computed(() => !this.currentUrl().startsWith('/login'));

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
