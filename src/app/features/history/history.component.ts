import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { DraftService } from '../../core/services/draft.service';
import { DraftSummary } from '../../core/models/contract';

@Component({
  selector: 'app-history',
  imports: [CommonModule, RouterLink, DatePipe],
  template: `
    <div class="card">
      <h1>History</h1>
      <p class="soft">All drafts created on this device.</p>

      @if (loading()) {
        <p class="muted">Loading…</p>
      } @else if (drafts().length === 0) {
        <p class="muted">No drafts yet. <a routerLink="/new">Create one →</a></p>
      } @else {
        <table class="tbl">
          <thead>
            <tr>
              <th>ID</th>
              <th>Status</th>
              <th>Loop</th>
              <th>Updated</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (d of drafts(); track d.draft_id) {
              <tr [class.dimmed]="deleting() === d.draft_id">
                <td><code>{{ d.draft_id.slice(0, 8) }}…</code></td>
                <td>
                  <span class="status-pill" [class]="'s-' + d.status">{{ d.status }}</span>
                </td>
                <td>{{ d.iteration }}</td>
                <td>{{ d.updated_at | date:'medium' }}</td>
                <td class="actions">
                  <a [routerLink]="['/draft', d.draft_id]">Open →</a>
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
    h1 { margin: 0 0 4px; font-size: 20px; }
    .tbl {
      width: 100%;
      border-collapse: collapse;
      margin-top: 12px;
    }
    .tbl th, .tbl td {
      text-align: left;
      padding: 10px 12px;
      border-bottom: 1px solid var(--border);
      font-size: 13px;
    }
    .tbl th { font-weight: 600; color: var(--text-soft); font-size: 12px; }
    .tbl a  { color: var(--blue); text-decoration: none; }
    .status-pill {
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 600;
    }
    .s-running         { background: var(--blue-soft);  color: var(--blue); }
    .s-awaiting_user   { background: var(--amber-soft); color: var(--amber); }
    .s-awaiting_manual { background: var(--red-soft);   color: var(--red); }
    .s-done            { background: var(--green-soft); color: var(--green); }

    .actions { display: flex; gap: 12px; align-items: center; }
    button.link {
      background: none; border: none; padding: 0; cursor: pointer;
      font-size: 13px; color: var(--blue);
    }
    button.link.danger { color: var(--red); }
    button.link:disabled { opacity: 0.5; cursor: default; }
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
