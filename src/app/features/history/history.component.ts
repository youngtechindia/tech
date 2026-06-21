import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { DraftService } from '../../core/services/draft.service';
import { DraftSummary } from '../../core/models/contract';

@Component({
  selector: 'app-history',
  imports: [CommonModule, RouterLink, DatePipe],
  template: `
    <div class="page-head">
      <div>
        <span class="eyebrow">Drafts</span>
        <h1>History</h1>
        <p class="soft">All incident drafts you have access to.</p>
      </div>
      <a class="primary-link" routerLink="/new">+ New report</a>
    </div>

    <div class="card list-card">
      @if (loading()) {
        <div class="empty">
          <div class="spinner"></div>
          <p>Loading drafts…</p>
        </div>
      } @else if (drafts().length === 0) {
        <div class="empty">
          <p>No drafts yet.</p>
          <a class="primary-link" routerLink="/new">Create your first report →</a>
        </div>
      } @else {
        <table>
          <thead>
            <tr>
              <th>Draft</th>
              <th>Status</th>
              <th>Loop</th>
              <th>Updated</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (d of drafts(); track d.draft_id) {
              <tr [class.dimmed]="deleting() === d.draft_id">
                <td><code>{{ d.draft_id.slice(0, 8) }}</code></td>
                <td>
                  <span class="status-pill" [class]="'s-' + d.status">{{ d.status }}</span>
                </td>
                <td class="mono">{{ d.iteration }}</td>
                <td class="soft">{{ d.updated_at | date:'medium' }}</td>
                <td class="actions">
                  <a class="open" [routerLink]="['/draft', d.draft_id]">Open <span>→</span></a>
                  <button
                    class="link danger"
                    type="button"
                    [disabled]="deleting() === d.draft_id"
                    (click)="remove(d.draft_id)"
                  >Delete</button>
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
    .primary-link {
      display: inline-flex;
      align-items: center;
      padding: 8px 14px;
      border-radius: var(--radius);
      background: var(--brand-soft);
      color: var(--brand);
      font-weight: 600;
      font-size: var(--fs-sm);
      text-decoration: none;
      transition: background 0.12s ease;
    }
    .primary-link:hover { background: var(--brand-mid); }

    .list-card { padding: 0; overflow: hidden; }

    .empty {
      padding: var(--space-8) var(--space-6);
      text-align: center;
      color: var(--text-soft);
    }
    .empty p { margin-bottom: var(--space-3); }
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
    td.mono { font-family: var(--font-mono); font-size: var(--fs-sm); color: var(--text-soft); }

    .status-pill {
      display: inline-flex;
      align-items: center;
      padding: 3px 9px;
      border-radius: 999px;
      font-size: var(--fs-xs);
      font-weight: 600;
      letter-spacing: 0.2px;
      border: 1px solid transparent;
    }
    .s-running         { background: var(--blue-soft);  color: var(--blue);  border-color: rgba(37, 99, 235, 0.15); }
    .s-awaiting_user   { background: var(--amber-soft); color: var(--amber); border-color: rgba(180, 83, 9, 0.18); }
    .s-awaiting_manual { background: var(--red-soft);   color: var(--red);   border-color: rgba(185, 28, 28, 0.18); }
    .s-done            { background: var(--green-soft); color: var(--green); border-color: rgba(21, 128, 61, 0.18); }

    .actions {
      display: flex;
      gap: var(--space-4);
      align-items: center;
      justify-content: flex-end;
    }
    .actions .open {
      color: var(--blue);
      font-weight: 600;
      font-size: var(--fs-sm);
      text-decoration: none;
    }
    .actions .open span { transition: transform 0.12s ease; display: inline-block; }
    .actions .open:hover span { transform: translateX(2px); }
    button.link {
      background: none; border: none; padding: 0; cursor: pointer;
      font-size: var(--fs-sm); color: var(--blue);
    }
    button.link.danger { color: var(--red); }
    button.link.danger:hover { text-decoration: underline; }
    button.link:disabled { opacity: 0.4; cursor: default; }
    tr.dimmed { opacity: 0.4; }
  `],
})
export class HistoryComponent implements OnInit {
  private svc = inject(DraftService);

  drafts = signal<DraftSummary[]>([]);
  loading = signal(true);
  deleting = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    await this.refresh();
  }

  private async refresh(): Promise<void> {
    this.loading.set(true);
    try {
      this.drafts.set(await this.svc.listDrafts());
    } finally {
      this.loading.set(false);
    }
  }

  async remove(id: string): Promise<void> {
    if (!confirm(`Delete draft ${id.slice(0, 8)}…? This cannot be undone.`)) return;
    this.deleting.set(id);
    try {
      await this.svc.deleteDraft(id);
      this.drafts.update((rows) => rows.filter((r) => r.draft_id !== id));
    } catch (e) {
      alert(`Failed to delete draft: ${String(e)}`);
    } finally {
      this.deleting.set(null);
    }
  }
}
