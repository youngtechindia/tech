import { Injectable, signal } from '@angular/core';

/** Options that drive what the reason-prompt modal displays. */
export interface ReasonPromptOptions {
  /** Big heading at the top of the modal. */
  title: string;
  /** Optional one-liner under the heading. */
  intro?: string;
  /** Field label to highlight in the body (e.g. "Incident Type"). */
  fieldLabel?: string;
  /** Previous / current value, for visual diff. */
  oldValue?: unknown;
  /** New value the user is about to commit. */
  newValue?: unknown;
  /** Free-text label for the confirm button. Defaults to "Save change". */
  confirmLabel?: string;
  /** If true, the confirm button uses the destructive red styling. */
  destructive?: boolean;
  /** Minimum reason length required (default 3). 0 to allow empty. */
  minLength?: number;
  /** Quick-pick chips above the textarea. */
  suggestions?: string[];
  /** Placeholder for the textarea. */
  placeholder?: string;
  /** Optional disclosure text below the textarea (e.g. audit notice). */
  hint?: string;
}

interface PendingPrompt {
  opts: ReasonPromptOptions;
  resolve: (value: string | null) => void;
}

/**
 * Singleton service that opens the global ReasonPromptComponent and resolves
 * a Promise with the user's reason text (or null if cancelled).
 *
 * Components ask: `const reason = await prompt.ask({ title: '…' });`
 */
@Injectable({ providedIn: 'root' })
export class ReasonPromptService {
  private _pending = signal<PendingPrompt | null>(null);
  readonly pending = this._pending.asReadonly();

  ask(opts: ReasonPromptOptions): Promise<string | null> {
    // Cancel any in-flight prompt (rare; only happens if a developer calls
    // ask while another one is still open).
    const previous = this._pending();
    if (previous) previous.resolve(null);

    return new Promise<string | null>((resolve) => {
      this._pending.set({ opts, resolve });
    });
  }

  /** Called by the modal component when the user confirms. */
  confirm(reason: string): void {
    const p = this._pending();
    if (!p) return;
    this._pending.set(null);
    p.resolve(reason);
  }

  /** Called by the modal component when the user cancels. */
  cancel(): void {
    const p = this._pending();
    if (!p) return;
    this._pending.set(null);
    p.resolve(null);
  }
}
