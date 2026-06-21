import { Injectable, signal } from '@angular/core';

export interface TranslationCompareOptions {
  /** Heading shown at the top of the modal. */
  title?: string;
  /** Optional one-liner under the heading. */
  intro?: string;
  /** Original-language text (typically Arabic). */
  original: string;
  /** Translated text (typically English). */
  translated: string;
  /** Language code of the original (default 'ar'). */
  originalLang?: 'ar' | 'unknown';
  /** Language code of the translation (default 'en'). */
  translatedLang?: 'en';
  /** Optional label to show next to the field this translation belongs to. */
  fieldLabel?: string;
}

export type CompareResult =
  /** User dismissed the modal without changing the textarea value. */
  | { kind: 'close' }
  /** User asked to restore the original (Arabic) into the textarea. */
  | { kind: 'restore-original' };

interface Pending {
  opts: TranslationCompareOptions;
  resolve: (result: CompareResult) => void;
}

/**
 * Singleton driver for the global TranslationCompareComponent. Components
 * call `open()` to display the Arabic vs English side-by-side modal and
 * await a CompareResult.
 */
@Injectable({ providedIn: 'root' })
export class TranslationCompareService {
  private _pending = signal<Pending | null>(null);
  readonly pending = this._pending.asReadonly();

  open(opts: TranslationCompareOptions): Promise<CompareResult> {
    const previous = this._pending();
    if (previous) previous.resolve({ kind: 'close' });
    return new Promise<CompareResult>((resolve) => {
      this._pending.set({ opts, resolve });
    });
  }

  resolve(result: CompareResult): void {
    const p = this._pending();
    if (!p) return;
    this._pending.set(null);
    p.resolve(result);
  }
}
