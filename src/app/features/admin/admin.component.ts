import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { DraftsApi } from '../../core/api/drafts.api';
import { IngestResponse } from '../../core/models/contract';

@Component({
  selector: 'app-admin',
  imports: [CommonModule],
  template: `
    <div class="card">
      <h1>Admin</h1>
      <p class="soft">
        Tools restricted to admin users. Use with care — re-ingest rebuilds the
        Qdrant collections from <code>data/user_guide.docx</code> and
        <code>data/historical_incidents.json</code>.
      </p>
    </div>

    <div class="card section">
      <h2>Knowledge base ingest</h2>
      <p class="soft small">
        Wipes the Qdrant collections (<code>guide_chunks</code> and
        <code>historical_incidents</code>) and re-embeds from the source files
        on disk. Run after editing the user guide or the historical-incidents
        JSON so retrieval at agent time sees the latest payloads.
      </p>

      <div class="actions">
        <label class="cb">
          <input type="checkbox" [checked]="reset()" (change)="toggleReset($event)" />
          <span>Reset collections before ingest (recommended)</span>
        </label>
        <button
          class="primary"
          [disabled]="busy()"
          (click)="runIngest()"
        >
          {{ busy() ? 'Ingesting…' : 'Run ingest' }}
        </button>
      </div>

      @if (lastResult(); as r) {
        <div class="result ok">
          <strong>Ingest complete.</strong>
          <ul>
            <li>Guide chunks: <code>{{ r.guide_chunks }}</code></li>
            <li>Historical incidents: <code>{{ r.incidents }}</code></li>
          </ul>
        </div>
      }

      @if (errorMsg(); as e) {
        <div class="result err">
          <strong>Ingest failed.</strong>
          <pre>{{ e }}</pre>
        </div>
      }
    </div>
  `,
  styles: [`
    h1 { margin: 0 0 8px; font-size: 20px; }
    h2 { margin: 0 0 8px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-soft); }
    p { margin: 0 0 10px; }
    code {
      font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
      font-size: 12px;
      background: #f1f5f9;
      padding: 1px 5px;
      border-radius: 4px;
    }
    .small { font-size: 13px; }
    .section { margin-top: 16px; }
    .actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-top: 12px;
    }
    .cb {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: var(--text-soft);
      cursor: pointer;
    }
    .result {
      margin-top: 14px;
      padding: 10px 12px;
      border-radius: 6px;
      font-size: 13px;
    }
    .result ul { margin: 6px 0 0; padding-left: 20px; }
    .result.ok  { background: #ecfdf5; color: #047857; border-left: 4px solid #10b981; }
    .result.err { background: #fef2f2; color: #b91c1c; border-left: 4px solid #ef4444; }
    .result pre {
      margin: 6px 0 0;
      font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
      font-size: 12px;
      white-space: pre-wrap;
    }
  `],
})
export class AdminComponent {
  private api = inject(DraftsApi);

  reset = signal(true);
  busy = signal(false);
  lastResult = signal<IngestResponse | null>(null);
  errorMsg = signal<string | null>(null);

  toggleReset(ev: Event): void {
    this.reset.set((ev.target as HTMLInputElement).checked);
  }

  async runIngest(): Promise<void> {
    this.busy.set(true);
    this.errorMsg.set(null);
    this.lastResult.set(null);
    try {
      const r = await firstValueFrom(this.api.ingest({ reset: this.reset() }));
      this.lastResult.set(r);
    } catch (e: unknown) {
      this.errorMsg.set(this.formatError(e));
    } finally {
      this.busy.set(false);
    }
  }

  private formatError(e: unknown): string {
    if (typeof e === 'string') return e;
    if (e && typeof e === 'object') {
      const any = e as Record<string, unknown>;
      const err = any['error'];
      if (err && typeof err === 'object') {
        const d = (err as Record<string, unknown>)['detail'];
        if (typeof d === 'string') return d;
      }
      if (typeof any['message'] === 'string') return any['message'] as string;
      if (typeof any['statusText'] === 'string' && typeof any['status'] === 'number') {
        return `${any['status']} ${any['statusText']}`;
      }
    }
    return String(e);
  }
}
