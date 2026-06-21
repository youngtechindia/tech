import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { DraftsApi } from '../../core/api/drafts.api';
import { DraftSummary } from '../../core/models/contract';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-review',
  imports: [CommonModule, RouterLink],
  template: `
    <div class="page-head">
      <div>
        <span class="eyebrow">Checker</span>
        <h1>Review Queue</h1>
        <p class="soft">
          Drafts submitted by makers and waiting for your review.
        </p>
      </div>
      <span class="count">{{ submitted().length }} pending</span>
    </div>

    <div class="card list-card">
      @if (loading()) {
        <div class="empty">
          <div class="spinner"></div>
          <p>Loading queue…</p>
        </div>
      } @else if (submitted().length === 0) {
        <div class="empty">
          <p>✓ Nothing to review right now.</p>
          <p class="soft small">Submitted drafts will appear here as makers send them.</p>
        </div>
      } @else {
        <table>
          <thead>
            <tr>
              <th>Draft</th>
              <th>Maker</th>
              <th>Submitted</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (d of submitted(); track d.draft_id) {
              <tr>
                <td><code>{{ d.draft_id.slice(0, 8) }}</code></td>
                <td>{{ d.maker_user_id || '—' }}</td>
                <td class="soft">{{ d.updated_at | date:'medium' }}</td>
                <td>
                  <span class="pill" [class]="'ws-' + d.workflow_status">
                    {{ d.workflow_status }}
                  </span>
                </td>
                <td class="actions">
                  <a class="open" [routerLink]="['/draft', d.draft_id]">Review <span>→</span></a>
                </td>
              </tr>
            }
          </tbody>
        </table>
      }
    </div>
  `,
  styles: [`
    .page-head {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: var(--space-5);
      margin-bottom: var(--space-5);
    }
    .page-head h1 {
      font-size: var(--fs-2xl);
      margin: var(--space-1) 0 var(--space-1);
    }
    .page-head p { color: var(--text-soft); }
    .count {
      padding: 6px 14px;
      background: var(--amber-soft);
      color: var(--amber);
      border-radius: 999px;
      font-size: var(--fs-sm);
      font-weight: 600;
      border: 1px solid rgba(180, 83, 9, 0.18);
    }

    .list-card { padding: 0; overflow: hidden; }

    .empty {
      padding: var(--space-8) var(--space-6);
      text-align: center;
      color: var(--text-soft);
    }
    .empty p { margin-bottom: var(--space-2); }
    .small { font-size: var(--fs-sm); }
    .spinner {
      width: 24px; height: 24px;
      margin: 0 auto var(--space-3);
      border: 2.5px solid var(--border);
      border-top-color: var(--blue);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    code {
      font-family: var(--font-mono);
      background: var(--surface-3);
      padding: 2px 8px;
      border-radius: var(--radius-sm);
      font-size: var(--fs-xs);
      color: var(--text);
    }
    .pill {
      display: inline-flex;
      align-items: center;
      font-size: var(--fs-xs);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      padding: 3px 9px;
      border-radius: 999px;
      border: 1px solid transparent;
    }
    .ws-submitted { background: var(--amber-soft); color: var(--amber); border-color: rgba(180, 83, 9, 0.18); }
    .ws-approved  { background: var(--green-soft); color: var(--green); border-color: rgba(21, 128, 61, 0.18); }
    .ws-rejected  { background: var(--red-soft);   color: var(--red);   border-color: rgba(185, 28, 28, 0.18); }
    .ws-draft     { background: var(--surface-3);  color: var(--text-soft); border-color: var(--border); }

    .actions { text-align: right; }
    .actions .open {
      color: var(--blue);
      font-weight: 600;
      font-size: var(--fs-sm);
      text-decoration: none;
    }
    .actions .open span { transition: transform 0.12s ease; display: inline-block; }
    .actions .open:hover span { transform: translateX(2px); }
  `],
})
export class ReviewQueueComponent implements OnInit {
  private api = inject(DraftsApi);
  auth = inject(AuthService);

  drafts = signal<DraftSummary[]>([]);
  loading = signal(true);

  /** Filter to drafts awaiting review — submitted only. Approved/rejected
   *  appear in History instead. */
  submitted = computed(() =>
    this.drafts().filter((d) => d.workflow_status === 'submitted'),
  );

  async ngOnInit(): Promise<void> {
    try {
      const all = await firstValueFrom(this.api.listDrafts());
      this.drafts.set(all);
    } finally {
      this.loading.set(false);
    }
  }
}
