import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { DraftService } from '../../core/services/draft.service';

@Component({
  selector: 'app-new-report',
  imports: [FormsModule],
  template: `
    <div class="card">
      <h1>New Incident Report</h1>
      <p class="soft">
        Describe the incident in plain language. The AI assistant will pre-fill
        the report and ask follow-up questions for anything it isn't sure about.
      </p>
      <textarea
        rows="14"
        [(ngModel)]="description"
        placeholder="On 03/05/2026 at 14:22, the Riyadh HQ Cards team discovered..."
      ></textarea>
      <div class="actions">
        <span class="soft hint">{{ description().length }} chars</span>
        <button
          class="primary"
          [disabled]="description().trim().length < 30 || submitting()"
          (click)="submit()"
        >
          {{ submitting() ? 'Starting...' : 'Generate Draft' }}
        </button>
      </div>
      @if (error()) {
        <p class="error">{{ error() }}</p>
      }
    </div>

    <div class="card guidelines">
      <h2>For best results, include</h2>
      <div class="cols">
        <div>
          <h3>What happened</h3>
          <ul>
            <li>The function or team involved (e.g. "Payments Operations") — not individuals' names</li>
            <li>The process or system affected (e.g. "SWIFT outbound batch")</li>
            <li>A concise factual sequence of events</li>
          </ul>
        </div>
        <div>
          <h3>When &amp; how it was found</h3>
          <ul>
            <li>Date of occurrence, date of discovery, date of escalation</li>
            <li>How the incident was detected (e.g. reconciliation, customer call, alert)</li>
            <li>Times of day if relevant to severity</li>
          </ul>
        </div>
        <div>
          <h3>Impact</h3>
          <ul>
            <li>Financial impact in <strong>SAR</strong> (gross, net, recoveries)</li>
            <li>Number of customers / transactions affected</li>
            <li>Any service disruption, regulatory or policy breach, reputational exposure</li>
          </ul>
        </div>
        <div>
          <h3>Response &amp; cause</h3>
          <ul>
            <li>Who the event was escalated to (e.g. Head of OpRisk, CRO)</li>
            <li>Immediate containment actions already taken</li>
            <li>Suspected root cause across people / process / system / external</li>
          </ul>
        </div>
      </div>

      <div class="dos-donts">
        <div class="do">
          <h4>Do</h4>
          <ul>
            <li>Refer to functions and teams, not named individuals</li>
            <li>Use clear language; expand acronyms on first use</li>
            <li>Quote amounts in SAR and dates as DDMMMYYYY (e.g. 18MAY2026)</li>
            <li>Give a logical, factual sequence</li>
          </ul>
        </div>
        <div class="dont">
          <h4>Don't</h4>
          <ul>
            <li>Don't name individuals involved in the event</li>
            <li>Don't use undefined abbreviations or internal jargon</li>
            <li>Don't speculate beyond what's known; mark uncertain items as "estimated" or "pending"</li>
          </ul>
        </div>
      </div>
    </div>
  `,
  styles: [`
    h1 { margin: 0 0 8px; font-size: 20px; }
    p { margin: 0 0 12px; }
    .actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 12px;
    }
    .hint { font-size: 12px; }
    .error { color: var(--red); margin-top: 12px; }

    .guidelines {
      margin-top: 16px;
      background: #f8fafc;
      border-left: 4px solid var(--blue, #2563eb);
    }
    .guidelines h2 {
      margin: 0 0 12px;
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-soft);
    }
    .guidelines h3 {
      margin: 0 0 6px;
      font-size: 13px;
      color: var(--text);
    }
    .guidelines ul {
      margin: 0;
      padding-left: 18px;
      color: var(--text-soft);
      font-size: 13px;
      line-height: 1.55;
    }
    .guidelines li { margin-bottom: 3px; }
    .cols {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px 28px;
    }
    @media (max-width: 760px) {
      .cols { grid-template-columns: 1fr; }
    }

    .dos-donts {
      margin-top: 16px;
      padding-top: 14px;
      border-top: 1px dashed var(--border, #e5e7eb);
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px 28px;
    }
    @media (max-width: 760px) {
      .dos-donts { grid-template-columns: 1fr; }
    }
    .dos-donts h4 {
      margin: 0 0 6px;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .dos-donts .do h4    { color: var(--green, #047857); }
    .dos-donts .dont h4  { color: var(--red, #b91c1c); }
  `],
})
export class NewReportComponent {
  private drafts = inject(DraftService);
  private router = inject(Router);

  description = signal('');
  submitting = signal(false);
  error = signal<string | null>(null);

  async submit(): Promise<void> {
    this.submitting.set(true);
    this.error.set(null);
    try {
      const draft = await this.drafts.createAndStart(this.description().trim());
      this.router.navigate(['/draft', draft.draft_id]);
    } catch (e: unknown) {
      this.error.set(`Failed to create draft: ${String(e)}`);
      this.submitting.set(false);
    }
  }
}
