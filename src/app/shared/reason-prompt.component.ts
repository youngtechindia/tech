import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ReasonPromptService } from '../core/services/reason-prompt.service';

@Component({
  selector: 'reason-prompt',
  imports: [CommonModule, FormsModule],
  template: `
    @let p = service.pending();
    @if (p) {
      <div class="overlay" (click)="onBackdrop($event)">
        <div class="dialog" role="dialog" aria-modal="true"
             [class.destructive]="p.opts.destructive"
             (click)="$event.stopPropagation()">
          <header class="head">
            <div class="head-icon" [class.destructive]="p.opts.destructive">
              @if (p.opts.destructive) {
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
                     stroke="currentColor" stroke-width="2"
                     stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              } @else {
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
                     stroke="currentColor" stroke-width="2"
                     stroke-linecap="round" stroke-linejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              }
            </div>
            <div class="head-text">
              <h2>{{ p.opts.title }}</h2>
              @if (p.opts.intro) { <p class="soft">{{ p.opts.intro }}</p> }
            </div>
            <button class="close" type="button" (click)="cancel()" aria-label="Close">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none"
                   stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </header>

          @if (p.opts.fieldLabel) {
            <div class="diff">
              <div class="diff-row">
                <span class="diff-key">Field</span>
                <span class="diff-val field-label">{{ p.opts.fieldLabel }}</span>
              </div>
              @if (hasOldValue(p.opts)) {
                <div class="diff-row">
                  <span class="diff-key">From</span>
                  <span class="diff-val old">{{ fmt(p.opts.oldValue) }}</span>
                </div>
              }
              @if (hasNewValue(p.opts)) {
                <div class="diff-row">
                  <span class="diff-key">To</span>
                  <span class="diff-val new">{{ fmt(p.opts.newValue) }}</span>
                </div>
              }
            </div>
          }

          <label class="reason-label">
            <span class="lbl">Reason for change</span>
            @if (minLen() > 0) {
              <span class="req-mark">required</span>
            }
          </label>

          @if (p.opts.suggestions?.length) {
            <div class="suggestions">
              @for (s of p.opts.suggestions; track s) {
                <button type="button" class="chip" (click)="pick(s)">{{ s }}</button>
              }
            </div>
          }

          <textarea
            #reasonInput
            rows="3"
            [ngModel]="reason()"
            (ngModelChange)="reason.set($event)"
            (keydown)="onKeyDown($event)"
            [placeholder]="p.opts.placeholder || 'Explain why you are changing this value…'"
            [class.error]="showError()"
          ></textarea>

          @if (showError()) {
            <p class="err-text">Please provide a reason of at least {{ minLen() }} characters.</p>
          }

          @if (p.opts.hint) {
            <p class="hint">{{ p.opts.hint }}</p>
          } @else {
            <p class="hint">
              This reason will be recorded in the audit trail against your user ID.
            </p>
          }

          <footer class="actions">
            <button type="button" class="ghost" (click)="cancel()">Cancel</button>
            <button
              type="button"
              [class]="p.opts.destructive ? 'danger' : 'primary'"
              [disabled]="!canSubmit()"
              (click)="confirm()"
            >
              {{ p.opts.confirmLabel || 'Save change' }}
            </button>
          </footer>
        </div>
      </div>
    }
  `,
  styles: [`
    .overlay {
      position: fixed; inset: 0;
      background: rgba(15, 23, 42, 0.45);
      backdrop-filter: blur(2px);
      -webkit-backdrop-filter: blur(2px);
      display: grid;
      place-items: center;
      z-index: 100;
      padding: var(--space-4);
      animation: fade 0.12s ease-out;
    }
    @keyframes fade { from { opacity: 0; } to { opacity: 1; } }

    .dialog {
      width: 100%;
      max-width: 480px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      box-shadow: 0 20px 40px -10px rgba(15, 23, 42, 0.30),
                  0 8px 16px -4px rgba(15, 23, 42, 0.15);
      padding: var(--space-6);
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      animation: pop 0.16s cubic-bezier(0.34, 1.30, 0.64, 1) both;
    }
    @keyframes pop {
      from { opacity: 0; transform: translateY(8px) scale(0.97); }
      to   { opacity: 1; transform: none; }
    }

    .head {
      display: grid;
      grid-template-columns: 40px 1fr 32px;
      gap: var(--space-3);
      align-items: start;
    }
    .head-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 40px; height: 40px;
      border-radius: 10px;
      background: var(--brand-soft);
      color: var(--brand);
    }
    .head-icon.destructive {
      background: var(--red-soft);
      color: var(--red);
    }
    .head-text h2 {
      margin: 0 0 2px;
      font-size: var(--fs-lg);
      letter-spacing: -0.015em;
    }
    .head-text p { margin: 0; font-size: var(--fs-sm); }
    .close {
      width: 32px; height: 32px;
      padding: 0;
      background: transparent;
      border: 1px solid transparent;
      border-radius: var(--radius);
      color: var(--text-muted);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .close:hover {
      background: var(--surface-2);
      color: var(--text);
      border-color: var(--border);
    }

    /* Diff card ---------------------------------------------- */
    .diff {
      background: var(--surface-2);
      border: 1px solid var(--border-soft);
      border-radius: var(--radius-md);
      padding: 10px 14px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .diff-row {
      display: grid;
      grid-template-columns: 56px 1fr;
      gap: 10px;
      align-items: baseline;
      font-size: var(--fs-sm);
    }
    .diff-key {
      font-size: 10.5px;
      font-weight: 700;
      letter-spacing: 0.7px;
      text-transform: uppercase;
      color: var(--text-muted);
      padding-top: 1px;
    }
    .diff-val {
      color: var(--text);
      word-break: break-word;
      line-height: 1.45;
    }
    .diff-val.field-label { font-weight: 600; }
    .diff-val.old {
      color: var(--text-soft);
      text-decoration: line-through;
      text-decoration-color: rgba(185, 28, 28, 0.35);
    }
    .diff-val.new {
      color: var(--green);
      font-weight: 600;
    }

    /* Reason label + chips ----------------------------------- */
    .reason-label {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: -4px;
    }
    .lbl {
      font-size: var(--fs-xs);
      font-weight: 600;
      color: var(--text-soft);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .req-mark {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.6px;
      text-transform: uppercase;
      color: var(--red);
    }

    .suggestions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .chip {
      padding: 4px 10px;
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--text-soft);
      border-radius: 999px;
      font-size: 12px;
      cursor: pointer;
      transition: background 0.12s ease, color 0.12s ease, border-color 0.12s ease;
    }
    .chip:hover {
      background: var(--brand-soft);
      color: var(--brand);
      border-color: var(--brand-mid);
    }

    textarea {
      font-family: inherit;
      resize: vertical;
      min-height: 84px;
    }
    textarea.error {
      border-color: var(--red);
      box-shadow: 0 0 0 3px rgba(185, 28, 28, 0.12);
    }
    .err-text {
      margin: -4px 0 0;
      font-size: var(--fs-sm);
      color: var(--red);
    }
    .hint {
      margin: 0;
      font-size: var(--fs-xs);
      color: var(--text-muted);
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .hint::before {
      content: "🔒";
      font-size: 11px;
    }

    /* Footer ------------------------------------------------- */
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-2);
      padding-top: var(--space-2);
      border-top: 1px solid var(--border-soft);
    }
    .actions button { min-width: 96px; }
  `],
})
export class ReasonPromptComponent implements AfterViewInit {
  service = inject(ReasonPromptService);
  @ViewChild('reasonInput') private reasonInputRef?: ElementRef<HTMLTextAreaElement>;

  reason = signal('');
  touched = signal(false);

  /** Effective minimum length: defaults to 3 when not specified. */
  minLen = computed(() => this.service.pending()?.opts.minLength ?? 3);

  canSubmit = computed(() => this.reason().trim().length >= this.minLen());
  showError = computed(() =>
    this.touched() && !this.canSubmit() && this.service.pending() !== null,
  );

  constructor() {
    // Whenever a fresh prompt arrives, reset state + focus the textarea.
    effect(() => {
      const p = this.service.pending();
      if (p) {
        this.reason.set('');
        this.touched.set(false);
        queueMicrotask(() => this.reasonInputRef?.nativeElement.focus());
      }
    });
  }

  ngAfterViewInit(): void {
    // No-op; effect handles focus after the dialog appears.
  }

  fmt(v: unknown): string {
    if (v === undefined || v === null || v === '') return '—';
    if (typeof v === 'boolean') return v ? 'Yes' : 'No';
    return String(v);
  }

  hasOldValue(o: { oldValue?: unknown }): boolean {
    return o.oldValue !== undefined;
  }
  hasNewValue(o: { newValue?: unknown }): boolean {
    return o.newValue !== undefined;
  }

  pick(s: string): void {
    this.reason.set(s);
    queueMicrotask(() => this.reasonInputRef?.nativeElement.focus());
  }

  confirm(): void {
    this.touched.set(true);
    if (!this.canSubmit()) return;
    this.service.confirm(this.reason().trim());
  }

  cancel(): void {
    this.service.cancel();
  }

  onBackdrop(ev: MouseEvent): void {
    // Only treat clicks on the overlay (not its children) as cancels.
    if (ev.target === ev.currentTarget) this.cancel();
  }

  onKeyDown(ev: KeyboardEvent): void {
    // Cmd/Ctrl+Enter submits; plain Enter starts a new line (normal behaviour).
    if ((ev.metaKey || ev.ctrlKey) && ev.key === 'Enter') {
      ev.preventDefault();
      this.confirm();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.service.pending()) this.cancel();
  }
}
