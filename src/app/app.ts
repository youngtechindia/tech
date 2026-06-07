import { Component, computed, inject } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs/operators';

import { AuthService } from './core/services/auth.service';
import { DraftService } from './core/services/draft.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
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
        <div class="brand">Incident Report AI Assistant</div>
        <nav>
          <a routerLink="/new" routerLinkActive="active">New Report</a>
          <a routerLink="/history" routerLinkActive="active">History</a>
          @if (auth.isAdmin()) {
            <a routerLink="/admin" routerLinkActive="active">Admin</a>
          }
        </nav>
        @if (auth.user(); as u) {
          <div class="user">
            <span class="who">{{ u }}</span>
            <button class="link logout" (click)="logout()">Sign out</button>
          </div>
        }
      </header>
    }
    <main class="page">
      <router-outlet />
    </main>
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
