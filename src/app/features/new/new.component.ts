import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { containsArabic, TranslateApi } from '../../core/api/translate.api';
import { DraftService } from '../../core/services/draft.service';
import { TranslationCompareService } from '../../core/services/translation-compare.service';

@Component({
  selector: 'app-new-report',
  imports: [FormsModule],
  template: `
    <div class="page-head">
      <span class="eyebrow">New report</span>
      <h1>Describe the incident</h1>
      <p class="soft">
        Write a plain-language summary in English or Arabic. The AI assistant
        will pre-fill the report and ask follow-up questions for anything it
        isn't sure about.
      </p>
    </div>

    <div class="card">
      <textarea
        rows="14"
        dir="auto"
        [(ngModel)]="description"
        placeholder="On 03/05/2026 at 14:22, the Riyadh HQ Cards team discovered..."
      ></textarea>
      <div class="actions">
        <span class="soft hint">{{ description().length }} chars</span>
        <span class="grow"></span>
        @if (originalArabic() !== null) {
          <button
            type="button"
            class="translate-btn ghost"
            (click)="openCompare()"
            title="Open a side-by-side comparison of the original Arabic and the English translation"
          >
            🔀 Compare original
          </button>
        }
        @if (showTranslate()) {
          <button
            type="button"
            class="translate-btn"
            [disabled]="translating() || description().trim().length === 0"
            (click)="translate()"
            title="Translate Arabic text to English. The final report must be in English."
          >
            {{ translating() ? 'Translating…' : '🌐 Translate to English' }}
          </button>
        }
        <button
          class="primary"
          [disabled]="description().trim().length < 30 || submitting() || hasArabic()"
          [title]="hasArabic()
            ? 'Translate the description to English before generating the draft. The final report must be in English.'
            : null"
          (click)="submit()"
        >
          {{ submitting() ? 'Starting...' : 'Generate Draft' }}
        </button>
      </div>
      @if (hasArabic()) {
        <p class="block-arabic">
          ✦ Translate the description to English before generating the draft —
          the final report must be in English.
        </p>
      }
      @if (translateError()) {
        <p class="error">{{ translateError() }}</p>
      }
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
    .page-head {
      margin-bottom: var(--space-5);
    }
    .page-head h1 {
      font-size: var(--fs-2xl);
      margin: var(--space-1) 0 var(--space-2);
    }
    .page-head p {
      color: var(--text-soft);
      max-width: 640px;
    }
    .actions {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      margin-top: var(--space-4);
    }
    .grow { flex: 1 1 auto; }
    .hint { font-size: 12px; }
    .error { color: var(--red); margin-top: 12px; }

    .block-arabic {
      margin-top: var(--space-3);
      padding: 10px 14px;
      background: var(--amber-soft);
      border-left: 3px solid var(--amber);
      border-radius: var(--radius);
      color: #78350f;
      font-size: var(--fs-sm);
      line-height: 1.5;
    }
    .translate-btn {
      background: #eef4ff;
      color: var(--blue, #2563eb);
      border: 1px solid #dbeafe;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 13px;
      cursor: pointer;
    }
    .translate-btn:hover:not(:disabled) { background: #dbeafe; }
    .translate-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .translate-btn.ghost {
      background: transparent;
      border-color: var(--border, #e5e7eb);
      color: var(--text-soft);
    }
    .translate-btn.ghost:hover:not(:disabled) {
      background: #f3f4f6;
      color: var(--text);
    }

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
  private translateApi = inject(TranslateApi);
  private compare = inject(TranslationCompareService);

  description = signal('');
  submitting = signal(false);
  error = signal<string | null>(null);
  translating = signal(false);
  translateError = signal<string | null>(null);

  // After a successful Arabic→English translation we stash the original
  // Arabic so the user can toggle back to it for side-by-side comparison.
  originalArabic = signal<string | null>(null);
  showingOriginal = signal(false);

  /** Show the Translate button only when the input contains Arabic AND we
   *  haven't already translated this content (avoid double-translation). */
  showTranslate = computed(() =>
    containsArabic(this.description()) && this.originalArabic() === null,
  );

  /** Final reports must be in English. Block Generate Draft while the
   *  description still contains any Arabic characters. */
  hasArabic = computed(() => containsArabic(this.description()));

  /** Open the side-by-side compare modal. If the user clicks
   *  "Restore original Arabic", swap the textarea content back. */
  async openCompare(): Promise<void> {
    const orig = this.originalArabic();
    if (orig === null) return;
    const result = await this.compare.open({
      title: 'Compare translation',
      intro: 'Review the Arabic you entered alongside the English translation before submitting.',
      original: orig,
      translated: this.description(),
      originalLang: 'ar',
      translatedLang: 'en',
    });
    if (result.kind === 'restore-original') {
      const currentTranslation = this.description();
      this.description.set(orig);
      this.originalArabic.set(currentTranslation);
      this.showingOriginal.set(true);
    }
  }

  async translate(): Promise<void> {
    const text = this.description().trim();
    if (!text) return;
    this.translating.set(true);
    this.translateError.set(null);
    try {
      const res = await firstValueFrom(this.translateApi.translate(text));
      // Only stash + offer the toggle when the BE actually performed a
      // translation (input was detected as ar / unknown). For pure-English
      // pass-through there's nothing to compare against.
      if (res.input_lang !== 'en') {
        this.originalArabic.set(text);
        this.showingOriginal.set(false);
      }
      this.description.set(res.translated);
    } catch (e: unknown) {
      this.translateError.set(`Translation failed: ${this.formatError(e)}`);
    } finally {
      this.translating.set(false);
    }
  }

  private formatError(e: unknown): string {
    if (e && typeof e === 'object') {
      const any = e as Record<string, unknown>;
      const err = any['error'];
      if (err && typeof err === 'object') {
        const d = (err as Record<string, unknown>)['detail'];
        if (typeof d === 'string') return d;
      }
      if (typeof any['message'] === 'string') return any['message'] as string;
    }
    return String(e);
  }

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
