import { Injectable, computed, inject, signal } from '@angular/core';
import { Subscription, firstValueFrom } from 'rxjs';

import { DraftsApi } from '../api/drafts.api';
import { AgentStream } from '../api/agent-stream';
import {
  AgentEvent,
  Draft,
  DraftSummary,
  FieldFill,
  FieldQuestion,
  FieldSpec,
  ProgressEvent,
  ProgressPhase,
} from '../models/contract';

export type SectionStatus = 'pending' | 'running' | 'done' | 'error';

export interface SectionProgress {
  name: string;
  status: SectionStatus;
  fields_in_section?: number;
  filled?: number;
  elapsed_ms?: number;
}

export interface AgentProgress {
  /** Most recent phase the agent emitted progress for. */
  phase: ProgressPhase | null;
  /** Which phases have completed at least once this run. */
  completedPhases: Set<ProgressPhase>;
  /** Per-section progress for the parallel fill phase (in spec order). */
  sections: SectionProgress[];
  /** Stats from the retrieval phase. */
  retrieve?: { guide_chunks: number; incidents: number };
  /** Stats from evaluate phase. */
  evaluate?: { low_confidence_required: number; required_total: number };
  /** Count of follow-up questions the agent decided to ask. */
  askCount?: number;
  /** Wall-clock start (epoch ms) of the current run, for the elapsed timer. */
  startedAtMs: number | null;
}

/**
 * Single source of truth for the active draft + the field spec.
 * Components inject this and read from the signals.
 */
@Injectable({ providedIn: 'root' })
export class DraftService {
  private api = inject(DraftsApi);
  private stream = inject(AgentStream);

  // ---- spec (loaded once at app start) ----
  private _spec = signal<FieldSpec[] | null>(null);
  readonly spec = this._spec.asReadonly();

  readonly specBySection = computed<Record<string, FieldSpec[]>>(() => {
    const out: Record<string, FieldSpec[]> = {};
    for (const f of this._spec() ?? []) {
      (out[f.section] ??= []).push(f);
    }
    return out;
  });

  readonly specById = computed<Record<string, FieldSpec>>(() => {
    const out: Record<string, FieldSpec> = {};
    for (const f of this._spec() ?? []) out[f.id] = f;
    return out;
  });

  // ---- active draft ----
  private _draft = signal<Draft | null>(null);
  readonly draft = this._draft.asReadonly();

  // ---- live activity log (last node + per-section progress) ----
  private _activity = signal<string[]>([]);
  readonly activity = this._activity.asReadonly();

  private _running = signal(false);
  readonly running = this._running.asReadonly();

  // ---- structured progress for the UI ----
  private _progress = signal<AgentProgress>(this.emptyProgress());
  readonly progress = this._progress.asReadonly();

  // ---- cross-component "open this field for editing" signal ----
  // Side-panel sets this; field-row reacts to it. Use a {id, nonce} pair so
  // requesting the same field twice still triggers an effect.
  private _editRequest = signal<{ id: string; nonce: number } | null>(null);
  readonly editRequest = this._editRequest.asReadonly();

  // ---- last user-facing error (LLM connection / SSE failure) ----
  // Shown as a global banner; set whenever an SSE error or a section
  // failure with a connection-style message arrives. Components can call
  // clearError() to dismiss.
  private _lastError = signal<{ message: string; at: number } | null>(null);
  readonly lastError = this._lastError.asReadonly();

  clearError(): void {
    this._lastError.set(null);
  }

  private setError(message: string): void {
    this._lastError.set({ message, at: Date.now() });
  }

  requestEdit(fieldId: string): void {
    this._editRequest.set({ id: fieldId, nonce: Date.now() });
  }

  private emptyProgress(): AgentProgress {
    return {
      phase: null,
      completedPhases: new Set<ProgressPhase>(),
      sections: [],
      startedAtMs: null,
    };
  }

  // ---- bootstrapping ----
  async loadSpec(): Promise<void> {
    if (this._spec()) return;
    const spec = await firstValueFrom(this.api.getFieldSpec());
    this._spec.set(spec);
  }

  // ---- list ----
  async listDrafts(): Promise<DraftSummary[]> {
    return firstValueFrom(this.api.listDrafts());
  }

  async deleteDraft(id: string): Promise<void> {
    await firstValueFrom(this.api.deleteDraft(id));
    if (this._draft()?.draft_id === id) this._draft.set(null);
  }

  // ---- create + load ----
  async createAndStart(description: string): Promise<Draft> {
    const draft = await firstValueFrom(this.api.createDraft({ description }));
    this._draft.set(draft);
    this._activity.set([]);
    this.startRun(draft.draft_id);
    return draft;
  }

  async loadDraft(id: string): Promise<Draft> {
    const draft = await firstValueFrom(this.api.getDraft(id));
    this._draft.set(draft);
    return draft;
  }

  // ---- run / resume agent (SSE) ----
  // Tracks the live SSE subscription so a new startRun cancels any previous
  // one. Without this, a wedged subscription (e.g. the BE was killed mid-
  // stream and the fetch reader is stuck pending) would leave `_running=true`
  // and every future startRun would silently no-op.
  private _activeSub: Subscription | null = null;

  startRun(draftId: string, additionalDescription?: string): void {
    // Cancel any in-flight stream — calling unsubscribe aborts the fetch.
    this._activeSub?.unsubscribe();
    this._activeSub = null;

    this._running.set(true);
    this._activity.set([]);
    this._progress.set({ ...this.emptyProgress(), startedAtMs: Date.now() });
    // Stale errors from a previous run shouldn't linger across attempts
    this._lastError.set(null);

    const sub: Subscription = this.stream
      .run(draftId, additionalDescription ? { additional_description: additionalDescription } : {})
      .subscribe({
        next: (evt) => this.handleEvent(evt),
        complete: async () => {
          if (this._activeSub === sub) {
            this._running.set(false);
            this._activeSub = null;
          }
          // Re-fetch the canonical state from the server.
          try {
            await this.loadDraft(draftId);
          } catch {
            /* ignore */
          }
        },
        error: (e: unknown) => {
          if (this._activeSub === sub) {
            this._running.set(false);
            this._activeSub = null;
          }
          // Network or stream-level failure (BE unreachable, SSE dropped, etc.)
          const msg = e instanceof Error ? e.message : String(e);
          this.setError(`Lost connection to backend (${msg}). The agent run did not complete.`);
        },
      });
    this._activeSub = sub;
  }

  private handleEvent(evt: AgentEvent): void {
    const cur = this._draft();
    if (!cur) return;

    switch (evt.event) {
      case 'iteration':
        this._draft.update((d) => (d ? { ...d, iteration: evt.data.iteration } : d));
        this.log(`iteration ${evt.data.iteration}`);
        break;

      case 'node_start':
        this.log(
          `node: ${evt.data.node}` + (evt.data.section ? ` (${evt.data.section})` : ''),
        );
        break;

      case 'field_update': {
        const ff: FieldFill = evt.data.fill;
        this._draft.update((d) =>
          d
            ? {
                ...d,
                fields: { ...d.fields, [evt.data.field_id]: ff },
              }
            : d,
        );
        break;
      }

      case 'awaiting_user':
        this._draft.update((d) =>
          d
            ? {
                ...d,
                status: 'awaiting_user',
                pending_questions: evt.data.pending_questions,
              }
            : d,
        );
        this.log(`asking ${evt.data.pending_questions.length} follow-up question(s)`);
        break;

      case 'awaiting_manual':
        this._draft.update((d) =>
          d
            ? {
                ...d,
                status: 'awaiting_manual',
                unresolved_field_ids: evt.data.unresolved_field_ids,
              }
            : d,
        );
        this.log(`manual finalize — ${evt.data.unresolved_field_ids.length} unresolved`);
        break;

      case 'done':
        this._draft.set(evt.data.draft);
        this.log('done');
        break;

      case 'progress':
        this.applyProgress(evt.data);
        break;

      case 'error':
        this.log(`ERROR: ${evt.data.code} — ${evt.data.message}`);
        this.setError(`Agent error (${evt.data.code}): ${evt.data.message}`);
        break;
    }
  }

  private applyProgress(p: ProgressEvent): void {
    this._progress.update((cur) => {
      const next: AgentProgress = {
        ...cur,
        phase: p.phase,
        completedPhases: new Set(cur.completedPhases),
        sections: cur.sections.slice(),
      };

      if (p.status === 'done') {
        // Section-level "done" should not promote the whole phase yet.
        if (!p.section) next.completedPhases.add(p.phase);
      }

      if (p.phase === 'retrieve' && p.status === 'done') {
        next.retrieve = {
          guide_chunks: p.guide_chunks ?? 0,
          incidents: p.incidents ?? 0,
        };
        this.log(
          `retrieved ${p.guide_chunks ?? 0} guide chunks, ${p.incidents ?? 0} similar incidents`,
        );
      }

      if (p.phase === 'fill' && p.status === 'start' && p.sections) {
        next.sections = p.sections.map((name) => ({
          name,
          status: 'pending',
          fields_in_section: p.section_field_counts?.[name],
        }));
        this.log(`filling ${p.sections.length} sections in parallel`);
      }

      if (p.phase === 'fill' && p.section) {
        const idx = next.sections.findIndex((s) => s.name === p.section);
        const row: SectionProgress = {
          name: p.section,
          status: (p.status === 'running' ? 'running'
                  : p.status === 'done' ? 'done'
                  : p.status === 'error' ? 'error'
                  : 'pending'),
          fields_in_section: p.fields_in_section ?? next.sections[idx]?.fields_in_section,
          filled: p.filled ?? next.sections[idx]?.filled,
          elapsed_ms: p.elapsed_ms ?? next.sections[idx]?.elapsed_ms,
        };
        if (idx >= 0) next.sections[idx] = row;
        else next.sections.push(row);

        if (p.status === 'done') {
          this.log(
            `✓ ${p.section} — filled ${p.filled ?? 0}/${row.fields_in_section ?? '?'} (${Math.round((p.elapsed_ms ?? 0) / 1000)}s)`,
          );
        } else if (p.status === 'error') {
          this.log(`✗ ${p.section} failed: ${p.message ?? ''}`);
          // Surface the first connection-style failure to the user. The
          // backend typically reports openai/httpx "Connection error." when
          // the remote LLM is unreachable.
          const msg = p.message ?? '';
          const isConn = /connection|timeout|timed out|unreachable|connect/i.test(msg);
          this.setError(
            isConn
              ? `LLM is unreachable — "${p.section}" failed (${msg}). Check the LM Studio / vLLM endpoint and retry.`
              : `Section "${p.section}" failed: ${msg}`,
          );
        }
      }

      if (p.phase === 'evaluate' && p.status === 'done') {
        next.evaluate = {
          low_confidence_required: p.low_confidence_required ?? 0,
          required_total: p.required_total ?? 0,
        };
        this.log(
          `evaluated: ${p.low_confidence_required ?? 0} of ${p.required_total ?? 0} required fields still low-confidence`,
        );
      }

      if (p.phase === 'ask' && p.status === 'done') {
        next.askCount = p.count ?? 0;
      }

      return next;
    });
  }

  // ---- manual edit + finalize ----
  async patchField(fieldId: string, value: unknown): Promise<void> {
    const cur = this._draft();
    if (!cur) return;
    const updated = await firstValueFrom(
      this.api.patchFields(cur.draft_id, { updates: { [fieldId]: { value } } }),
    );
    this._draft.set(updated);
  }

  async patchManyFields(updates: Record<string, unknown>): Promise<void> {
    const cur = this._draft();
    if (!cur) return;
    const body = {
      updates: Object.fromEntries(
        Object.entries(updates).map(([k, v]) => [k, { value: v }]),
      ),
    };
    const updated = await firstValueFrom(this.api.patchFields(cur.draft_id, body));
    this._draft.set(updated);
  }

  async finalize(): Promise<Draft> {
    const cur = this._draft();
    if (!cur) throw new Error('no active draft');
    const updated = await firstValueFrom(this.api.finalizeDraft(cur.draft_id));
    this._draft.set(updated);
    return updated;
  }

  // ---- helpers ----
  questionsBySection = computed<Record<string, FieldQuestion[]>>(() => {
    const out: Record<string, FieldQuestion[]> = {};
    for (const q of this._draft()?.pending_questions ?? []) {
      (out[q.section] ??= []).push(q);
    }
    return out;
  });

  private log(msg: string): void {
    this._activity.update((a) => [...a.slice(-19), msg]);
  }
}
