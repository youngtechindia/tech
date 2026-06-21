import { CommonModule } from '@angular/common';
import { Component, HostListener, inject, signal } from '@angular/core';

import { TranslationCompareService } from '../core/services/translation-compare.service';

@Component({
  selector: 'translation-compare',
  imports: [CommonModule],
  template: `
    @let p = service.pending();
    @if (p) {
      <div class="overlay" (click)="onBackdrop($event)">
        <div class="dialog" role="dialog" aria-modal="true"
             (click)="$event.stopPropagation()">
          <header class="head">
            <div class="head-icon">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
                   stroke="currentColor" stroke-width="2"
                   stroke-linecap="round" stroke-linejoin="round">
                <path d="M5 8l6 6"/>
                <path d="M4 14l6-6 2-3"/>
                <path d="M2 5h12"/>
                <path d="M7 2h1"/>
                <path d="M22 22l-5-10-5 10"/>
                <path d="M14 18h6"/>
              </svg>
            </div>
            <div class="head-text">
              <h2>{{ p.opts.title || 'Compare translation' }}</h2>
              @if (p.opts.intro) {
                <p class="soft">{{ p.opts.intro }}</p>
              } @else {
                <p class="soft">Original and English translation, side by side.</p>
              }
              @if (p.opts.fieldLabel) {
                <p class="field-tag">{{ p.opts.fieldLabel }}</p>
              }
            </div>
            <button class="close" type="button" (click)="close()" aria-label="Close">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none"
                   stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </header>

          <div class="compare">
            <div class="pane original">
              <div class="pane-head">
                <span class="lang-flag">🇸🇦</span>
                <span class="lang-label">Original</span>
                <span class="lang-code">{{ (p.opts.originalLang || 'ar') | uppercase }}</span>
                <button class="copy" type="button" (click)="copy(p.opts.original, 'original')"
                        [class.done]="copied() === 'original'">
                  @if (copied() === 'original') {
                    ✓ Copied
                  } @else {
                    📋 Copy
                  }
                </button>
              </div>
              <div class="pane-body rtl" dir="rtl" lang="ar">
                {{ p.opts.original }}
              </div>
            </div>

            <div class="divider" aria-hidden="true">
              <svg viewBox="0 0 12 12" width="14" height="14" fill="none"
                   stroke="currentColor" stroke-width="2"
                   stroke-linecap="round" stroke-linejoin="round">
                <path d="M2 4l4 0"/>
                <path d="M10 8l-4 0"/>
                <path d="M8 2l2 2-2 2"/>
                <path d="M4 6l-2 2 2 2"/>
              </svg>
            </div>

            <div class="pane translated">
              <div class="pane-head">
                <span class="lang-flag">🇬🇧</span>
                <span class="lang-label">English translation</span>
                <span class="lang-code">{{ (p.opts.translatedLang || 'en') | uppercase }}</span>
                <button class="copy" type="button" (click)="copy(p.opts.translated, 'translated')"
                        [class.done]="copied() === 'translated'">
                  @if (copied() === 'translated') {
                    ✓ Copied
                  } @else {
                    📋 Copy
                  }
                </button>
              </div>
              <div class="pane-body ltr" dir="ltr" lang="en">
                {{ p.opts.translated }}
              </div>
            </div>
          </div>

          <footer class="actions">
            <p class="footnote soft">
              The final report must be in English. The original Arabic is kept
              only for your reference; it is not saved with the report.
            </p>
            <div class="btn-group">
              <button type="button" class="ghost" (click)="restoreOriginal()">
                Restore original Arabic
              </button>
              <button type="button" class="primary" (click)="close()">
                Keep English
              </button>
            </div>
          </footer>
        </div>
      </div>
    }
  `,
  styles: [`
    .overlay {
      position: fixed; inset: 0;
      background: rgba(15, 23, 42, 0.50);
      backdrop-filter: blur(3px);
      -webkit-backdrop-filter: blur(3px);
      display: grid;
      place-items: center;
      z-index: 100;
      padding: var(--space-4);
      animation: fade 0.12s ease-out;
    }
    @keyframes fade { from { opacity: 0; } to { opacity: 1; } }

    .dialog {
      width: 100%;
      max-width: 920px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      box-shadow:
        0 20px 40px -10px rgba(15, 23, 42, 0.30),
        0 8px 16px -4px rgba(15, 23, 42, 0.15);
      padding: var(--space-6);
      display: flex;
      flex-direction: column;
      gap: var(--space-5);
      animation: pop 0.16s cubic-bezier(0.34, 1.30, 0.64, 1) both;
      max-height: 92vh;
    }
    @keyframes pop {
      from { opacity: 0; transform: translateY(8px) scale(0.98); }
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
    .head-text h2 {
      margin: 0 0 2px;
      font-size: var(--fs-lg);
      letter-spacing: -0.015em;
    }
    .head-text p { margin: 0; font-size: var(--fs-sm); }
    .head-text .field-tag {
      display: inline-block;
      margin-top: 4px;
      padding: 2px 9px;
      background: var(--surface-3);
      color: var(--text-soft);
      border: 1px solid var(--border);
      border-radius: 999px;
      font-size: var(--fs-xs);
      font-weight: 600;
    }
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

    /* Compare grid ------------------------------------------- */
    .compare {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      gap: var(--space-3);
      min-height: 0;
      overflow: hidden;
    }
    .divider {
      align-self: center;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px; height: 28px;
      border-radius: 50%;
      background: var(--surface-2);
      color: var(--brand);
      border: 1px solid var(--border);
    }

    .pane {
      display: flex;
      flex-direction: column;
      min-height: 0;
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      background: var(--surface);
      overflow: hidden;
    }
    .pane.original   { background: linear-gradient(180deg, #fef9c3 0%, #fffbeb 12%, var(--surface) 100%); }
    .pane.translated { background: linear-gradient(180deg, #dbeafe 0%, #eef4ff 12%, var(--surface) 100%); }

    .pane-head {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 9px 12px;
      border-bottom: 1px solid var(--border);
      background: rgba(255, 255, 255, 0.6);
    }
    .lang-flag { font-size: 14px; }
    .lang-label {
      font-size: var(--fs-xs);
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: var(--text-soft);
    }
    .lang-code {
      font-family: var(--font-mono);
      font-size: 10.5px;
      padding: 1px 6px;
      border-radius: 4px;
      background: var(--surface-3);
      color: var(--text-soft);
      font-weight: 600;
    }
    .copy {
      margin-left: auto;
      padding: 3px 8px;
      font-size: var(--fs-xs);
      background: transparent;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      color: var(--text-soft);
      cursor: pointer;
      transition: background 0.12s ease, color 0.12s ease, border-color 0.12s ease;
    }
    .copy:hover { background: var(--surface); color: var(--text); border-color: var(--border-strong); }
    .copy.done { color: var(--green); border-color: rgba(21, 128, 61, 0.3); background: var(--green-soft); }

    .pane-body {
      flex: 1 1 auto;
      padding: 16px 18px;
      overflow-y: auto;
      font-size: var(--fs-md);
      line-height: 1.65;
      color: var(--text);
      white-space: pre-wrap;
      word-wrap: break-word;
      min-height: 220px;
      max-height: 60vh;
    }
    .pane-body.rtl {
      font-family: 'Tahoma', 'Geeza Pro', 'Arial', sans-serif;
      font-size: 16px;
    }
    .pane-body.ltr {
      font-family: var(--font-sans);
    }

    /* Footer ------------------------------------------------- */
    .actions {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      padding-top: var(--space-3);
      border-top: 1px solid var(--border-soft);
    }
    .footnote {
      margin: 0;
      font-size: var(--fs-sm);
      line-height: 1.5;
    }
    .btn-group {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-2);
    }
    .btn-group button { min-width: 120px; }

    /* Responsive: stack panes on narrow screens -------------- */
    @media (max-width: 720px) {
      .compare {
        grid-template-columns: 1fr;
      }
      .divider {
        transform: rotate(90deg);
      }
      .pane-body { max-height: 30vh; }
    }
  `],
})
export class TranslationCompareComponent {
  service = inject(TranslationCompareService);

  /** Flashes a "Copied" state on the active pane's copy button. */
  copied = signal<'original' | 'translated' | null>(null);

  async copy(text: string, which: 'original' | 'translated'): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.copied.set(which);
      setTimeout(() => {
        if (this.copied() === which) this.copied.set(null);
      }, 1500);
    } catch {
      // Clipboard might be unavailable (insecure context); silently no-op.
    }
  }

  close(): void {
    this.service.resolve({ kind: 'close' });
  }

  restoreOriginal(): void {
    this.service.resolve({ kind: 'restore-original' });
  }

  onBackdrop(ev: MouseEvent): void {
    if (ev.target === ev.currentTarget) this.close();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.service.pending()) this.close();
  }
}
