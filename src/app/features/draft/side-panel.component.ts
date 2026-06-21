import { CommonModule } from '@angular/common';
import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { DraftService } from '../../core/services/draft.service';
import { AuthService } from '../../core/services/auth.service';
import { ReasonPromptService } from '../../core/services/reason-prompt.service';
import { ProgressPhase } from '../../core/models/contract';

interface PhaseStep {
  key: ProgressPhase;
  label: string;
}

const PHASE_STEPS: PhaseStep[] = [
  { key: 'retrieve', label: 'Retrieving context' },
  { key: 'fill', label: 'Filling sections' },
  { key: 'evaluate', label: 'Evaluating confidence' },
  { key: 'ask', label: 'Preparing follow-ups' },
];

@Component({
  selector: 'side-panel',
  imports: [CommonModule, FormsModule],
  template: `
    @let d = drafts.draft();
    @if (d) {
      <div class="card panel">
        <div class="status-row">
          <span class="status-pill" [class]="'s-' + d.status">{{ d.status }}</span>
          <span class="ws-pill" [class]="'ws-' + d.workflow_status">{{ d.workflow_status }}</span>
          <span class="iter">loop {{ d.iteration }}</span>
        </div>

        @if (d.workflow_status === 'rejected' && d.rejection_reason) {
          <div class="reject-banner">
            <strong>Rejected by checker</strong>
            <p>{{ d.rejection_reason }}</p>
            <p class="soft small">Address the feedback above, then re-submit for review.</p>
          </div>
        }

        @if (d.workflow_status === 'approved') {
          <div class="approved-banner">
            <strong>Approved</strong>
            <p class="soft small">
              Approved by {{ d.checker_user_id || 'checker' }}
              @if (d.decided_at) { · {{ d.decided_at | date:'medium' }} }
            </p>
          </div>
        }

        @if (auth.isMaker() && (d.workflow_status === 'draft' || d.workflow_status === 'rejected')) {
          <div class="block">
            <button
              class="primary block"
              [disabled]="!canFinalize() || submitting()"
              (click)="submit()"
            >
              {{ submitting() ? 'Submitting…' : 'Submit for Review' }}
            </button>
            <p class="hint soft small">
              Sends the report to a checker. You will not be able to edit fields
              while it's under review.
            </p>
          </div>
        }

        @if (auth.isChecker() && d.workflow_status === 'submitted') {
          <div class="block">
            <button
              class="primary block"
              [disabled]="!canFinalize() || deciding() || isOwnDraft()"
              (click)="approve()"
            >
              {{ deciding() ? 'Approving…' : 'Approve' }}
            </button>
            <button
              class="block reject-btn"
              [disabled]="deciding() || isOwnDraft()"
              (click)="reject()"
            >
              Reject (with reason)
            </button>
            @if (isOwnDraft()) {
              <p class="hint soft small error">
                You created this draft — segregation of duties prevents you from reviewing it.
              </p>
            }
          </div>
        }

        @if (drafts.running()) {
          @let p = drafts.progress();
          <div class="block">
            <div class="prog-header">
              <h3>Agent progress</h3>
              <span class="elapsed">{{ elapsedLabel() }}</span>
            </div>

            <ol class="phases">
              @for (step of phaseSteps; track step.key) {
                <li [class]="'phase ' + phaseStatus(step.key)">
                  <span class="dot">
                    @switch (phaseStatus(step.key)) {
                      @case ('done')    { ✓ }
                      @case ('running') { <span class="spinner"></span> }
                      @default          { · }
                    }
                  </span>
                  <span class="phase-label">{{ step.label }}</span>
                  @if (step.key === 'retrieve' && p.retrieve) {
                    <span class="phase-sub">
                      {{ p.retrieve.guide_chunks }} guide · {{ p.retrieve.incidents }} similar
                    </span>
                  }
                  @if (step.key === 'evaluate' && p.evaluate) {
                    <span class="phase-sub">
                      {{ p.evaluate.required_total - p.evaluate.low_confidence_required }}/{{ p.evaluate.required_total }} required confident
                    </span>
                  }
                </li>
              }
            </ol>

            @if (p.phase === 'fill' && p.sections.length > 0) {
              <div class="sections">
                <div class="sec-head">
                  <span>Sections</span>
                  <span class="muted small">{{ filledCount() }} filled</span>
                </div>
                <ul class="sec-list">
                  @for (item of groupedSectionItems(); track item.key) {
                    @if (item.kind === 'group') {
                      <li class="grp-row">{{ item.label }}</li>
                    } @else {
                      <li [class]="'sec ' + item.sec!.status" [class.indented]="item.indented">
                        <span class="sec-status">
                          @switch (item.sec!.status) {
                            @case ('done')    { ✓ }
                            @case ('running') { <span class="spinner"></span> }
                            @case ('error')   { ! }
                            @default          { · }
                          }
                        </span>
                        <span class="sec-name">{{ item.sec!.name }}</span>
                        @if (item.sec!.status === 'done') {
                          <span class="sec-meta">
                            {{ item.sec!.filled ?? 0 }}/{{ item.sec!.fields_in_section ?? '?' }}
                            @if (item.sec!.elapsed_ms != null) { · {{ (item.sec!.elapsed_ms / 1000) | number:'1.0-0' }}s }
                          </span>
                        }
                        @if (item.sec!.status === 'running' && item.sec!.fields_in_section != null) {
                          <span class="sec-meta muted">{{ item.sec!.fields_in_section }} fields</span>
                        }
                      </li>
                    }
                  }
                </ul>
              </div>
            }

            <details class="log-details">
              <summary>Raw activity log ({{ drafts.activity().length }})</summary>
              <ul class="log">
                @for (line of drafts.activity(); track line + $index) {
                  <li>{{ line }}</li>
                }
                @if (drafts.activity().length === 0) {
                  <li class="muted">starting...</li>
                }
              </ul>
            </details>
          </div>
        }

        @if (d.workflow_status === 'submitted') {
          <div class="block submitted-banner">
            <strong>Submitted for review</strong>
            <p class="soft small">
              This draft is locked for editing while a checker reviews it.
              You'll be notified when the checker approves or rejects.
            </p>
            @if (d.submitted_at) {
              <p class="soft small">Submitted {{ d.submitted_at | date:'medium' }}.</p>
            }
          </div>
        }

        @if (d.status === 'awaiting_user' && d.workflow_status === 'draft') {
          @let pending = unansweredQuestions();
          @let hadQuestions = d.pending_questions.length > 0;
          <div class="block">
            @if (pending.length > 0) {
              <h3>Follow-up questions</h3>
              <p class="hint soft small">
                You can either <strong>edit any field directly</strong> in the form
                (click a question to jump to it), or describe the missing details in
                the box below and let the agent refill them.
              </p>
              <ol class="qs">
                @for (q of pending; track q.field_id) {
                  <li>
                    <button class="q-jump" type="button" (click)="jumpToField(q.field_id)">
                      <span class="q-field">{{ q.field_label }}</span>
                      <span class="q-arrow">↗ edit</span>
                    </button>
                    <div class="q-text">{{ q.question }}</div>
                  </li>
                }
              </ol>
            }

            @if (canFinalize() && !auth.isMaker()) {
              <button
                class="primary block"
                [disabled]="finalizing()"
                (click)="finalize()"
              >
                {{ finalizing() ? 'Saving...' : 'Save & Finalize' }}
              </button>
              <p class="hint soft small">
                All required fields are filled. You can finalize now, or keep going
                with the agent below.
              </p>
            }

            @if (pending.length > 0) {
              <details class="agent-reply" [open]="!canFinalize()">
                <summary>Or reply to the agent</summary>
                <textarea
                  rows="5"
                  [(ngModel)]="reply"
                  placeholder="Add the missing details here. The agent will use them to refill the report."
                ></textarea>
                <button
                  class="primary block"
                  [disabled]="reply().trim().length < 5 || drafts.running()"
                  (click)="resume()"
                >
                  Continue with agent
                </button>
              </details>
            } @else if (!canFinalize()) {
              <!-- All asked follow-ups have been answered, but some required
                   fields are still empty. Surface them with click-to-jump and
                   only enable Continue-with-agent when the agent can help. -->
              @let g = remainingGaps();
              <h3>Still required ({{ g.all.length }})</h3>
              <p class="hint soft small">
                The agent answered every follow-up question, but these required
                fields are still empty. Click one to jump to it.
              </p>
              <ol class="qs">
                @for (f of g.all; track f.id) {
                  <li>
                    <button class="q-jump" type="button" (click)="jumpToField(f.id)">
                      <span class="q-field">{{ f.label }}</span>
                      <span class="q-arrow">↗ edit</span>
                    </button>
                    <div class="q-text">
                      {{ f.section }}
                      @if (f.source_mode === 'manual' || f.source_mode === 'optional') {
                        · <em>manual entry only</em>
                      }
                    </div>
                  </li>
                }
              </ol>

              @if (g.agent.length > 0) {
                <button
                  class="primary block"
                  [disabled]="drafts.running()"
                  (click)="resume()"
                >
                  Continue with agent ({{ g.agent.length }} agent-addressable)
                </button>
                <details class="agent-reply">
                  <summary>Add optional context for the next pass</summary>
                  <textarea
                    rows="4"
                    [(ngModel)]="reply"
                    placeholder="Optional — extra context for the agent."
                  ></textarea>
                </details>
              } @else {
                <p class="hint soft small">
                  All remaining gaps are <strong>manual</strong> — the agent
                  cannot close them. Fill them in the form, then Submit for Review.
                </p>
              }
            }
          </div>
        }

        @if (d.status === 'awaiting_manual' && d.workflow_status === 'draft') {
          <div class="block">
            <h3>Manual fill required</h3>
            <p class="soft small">
              The agent could not confidently fill these {{ d.unresolved_field_ids.length }}
              field(s). Click one to jump to it, edit it in the form, then finalize.
            </p>
            @if (unresolvedFields().length > 0) {
              <ol class="qs">
                @for (f of unresolvedFields(); track f.id) {
                  <li>
                    <button class="q-jump" type="button" (click)="jumpToField(f.id)">
                      <span class="q-field">{{ f.label }}</span>
                      <span class="q-arrow">↗ edit</span>
                    </button>
                    <div class="q-text">{{ f.section }}</div>
                  </li>
                }
              </ol>
            }
            @if (!auth.isMaker()) {
              <button
                class="primary block"
                [disabled]="!canFinalize() || finalizing()"
                (click)="finalize()"
              >
                {{ finalizing() ? 'Saving...' : 'Save & Finalize' }}
              </button>
            }
          </div>
        }

        @if (d.status === 'done') {
          <div class="block">
            <h3>Finalized</h3>
            <p class="soft small">
              Saved to <code>drafts/{{ d.draft_id }}.json</code>.
            </p>
            <button class="block" (click)="downloadJson()">Download JSON</button>
          </div>
        }

        @if (finalizeError()) {
          <p class="error">{{ finalizeError() }}</p>
        }
      </div>
    }
  `,
  styles: [`
    .panel {
      position: sticky;
      top: calc(var(--topbar-height) + var(--space-5));
      box-shadow: var(--shadow-sm);
    }
    .status-row {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      flex-wrap: wrap;
      padding-bottom: var(--space-3);
      margin-bottom: var(--space-3);
      border-bottom: 1px solid var(--border-soft);
    }
    .status-pill {
      display: inline-flex;
      align-items: center;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: var(--fs-xs);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border: 1px solid transparent;
    }
    .status-pill::before {
      content: "";
      width: 6px;
      height: 6px;
      border-radius: 50%;
      margin-right: 6px;
      background: currentColor;
    }
    .iter {
      margin-left: auto;
      font-size: var(--fs-xs);
      color: var(--text-muted);
      font-family: var(--font-mono);
    }
    .s-running         { background: var(--blue-soft);  color: var(--blue); }
    .s-awaiting_user   { background: var(--amber-soft); color: var(--amber); }
    .s-awaiting_manual { background: var(--red-soft);   color: var(--red); }
    .s-done            { background: var(--green-soft); color: var(--green); }

    .ws-pill {
      padding: 3px 10px;
      border-radius: 999px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-left: 6px;
    }
    .ws-draft     { background: #e5e7eb; color: #374151; }
    .ws-submitted { background: #fef3c7; color: #92400e; }
    .ws-approved  { background: #dcfce7; color: #166534; }
    .ws-rejected  { background: #fee2e2; color: #991b1b; }

    .submitted-banner {
      margin-top: 12px;
      padding: 10px 12px;
      border-radius: 6px;
      background: #fef3c7;
      border-left: 4px solid #d97706;
      color: #78350f;
      font-size: 13px;
    }
    .submitted-banner p { margin: 6px 0 0; }
    .reject-banner {
      margin-top: 12px;
      padding: 10px 12px;
      border-radius: 6px;
      background: #fef2f2;
      border-left: 4px solid #ef4444;
      color: #991b1b;
      font-size: 13px;
    }
    .reject-banner p { margin: 6px 0 0; }
    .approved-banner {
      margin-top: 12px;
      padding: 10px 12px;
      border-radius: 6px;
      background: #ecfdf5;
      border-left: 4px solid #10b981;
      color: #065f46;
      font-size: 13px;
    }
    .approved-banner p { margin: 6px 0 0; }
    .reject-btn {
      margin-top: 6px;
      background: #fee2e2;
      color: #991b1b;
      border: 1px solid #fecaca;
    }
    .reject-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    .block {
      margin-top: 16px;
    }
    h3 { margin: 0 0 8px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-soft); }

    .log {
      list-style: none;
      padding: 0;
      margin: 0;
      max-height: 180px;
      overflow-y: auto;
      font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
      font-size: 12px;
      color: var(--text-soft);
    }
    .log li { padding: 2px 0; }

    .qs {
      list-style: none;
      padding: 0;
      margin: 0 0 12px;
    }
    .qs li {
      margin-bottom: 8px;
      padding-bottom: 8px;
      border-bottom: 1px dashed var(--border, #e5e7eb);
    }
    .qs li:last-child { border-bottom: none; }
    .q-jump {
      display: flex;
      width: 100%;
      align-items: center;
      justify-content: space-between;
      padding: 4px 0;
      background: none;
      border: none;
      cursor: pointer;
      text-align: left;
    }
    .q-jump:hover .q-field { text-decoration: underline; }
    .q-field { font-weight: 600; font-size: 12px; color: var(--text); }
    .q-arrow { font-size: 11px; color: var(--blue); margin-left: 8px; white-space: nowrap; }
    .q-text { color: var(--text-soft); font-size: 12px; margin-top: 2px; }

    .hint { margin: 0 0 10px; }
    .hint.ok {
      padding: 8px 10px;
      background: #ecfdf5;
      color: #065f46;
      border-left: 3px solid #10b981;
      border-radius: 4px;
    }
    .agent-reply { margin-top: 10px; }
    .agent-reply > summary {
      font-size: 12px; color: var(--text-soft); cursor: pointer;
      padding: 4px 0;
    }

    button.block { display: block; width: 100%; margin-top: 8px; }
    .small { font-size: 12px; }
    .error { color: var(--red); margin-top: 8px; font-size: 13px; }

    /* progress */
    .prog-header { display: flex; justify-content: space-between; align-items: baseline; }
    .elapsed {
      font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
      font-size: 12px;
      color: var(--text-soft);
    }
    .phases {
      list-style: none;
      padding: 0;
      margin: 0 0 12px;
    }
    .phase {
      display: grid;
      grid-template-columns: 18px 1fr auto;
      align-items: center;
      gap: 8px;
      padding: 4px 0;
      font-size: 13px;
      color: var(--text-soft);
    }
    .phase.done .phase-label { color: var(--text); }
    .phase.running .phase-label { color: var(--text); font-weight: 600; }
    .phase-sub { font-size: 11px; color: var(--text-muted); }
    .dot {
      display: inline-flex; align-items: center; justify-content: center;
      width: 18px; height: 18px; border-radius: 50%;
      background: var(--surface-2, #eee);
      font-size: 11px; color: var(--text-muted);
    }
    .phase.done .dot { background: var(--green-soft); color: var(--green); }
    .phase.running .dot { background: var(--blue-soft); color: var(--blue); }

    .sections {
      border-top: 1px solid var(--border, #eee);
      padding-top: 10px;
      margin-bottom: 12px;
    }
    .sec-head {
      display: flex; justify-content: space-between;
      font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;
      color: var(--text-soft); margin-bottom: 6px;
    }
    .sec-list { list-style: none; padding: 0; margin: 0; }
    .sec {
      display: grid;
      grid-template-columns: 18px 1fr auto;
      align-items: center;
      gap: 8px;
      padding: 3px 0;
      font-size: 12px;
      color: var(--text-soft);
    }
    .sec.done    { color: var(--text); }
    .sec.running { color: var(--text); }
    .sec.error   { color: var(--red); }
    .sec.indented { padding-left: 14px; }
    .grp-row {
      list-style: none;
      margin-top: 6px;
      padding: 4px 0;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--blue, #2563eb);
    }
    .sec-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .sec-meta {
      font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
      font-size: 11px;
      color: var(--text-muted);
    }
    .sec-status {
      display: inline-flex; align-items: center; justify-content: center;
      width: 18px; height: 18px; border-radius: 50%;
      background: var(--surface-2, #eee); font-size: 10px;
    }
    .sec.done .sec-status    { background: var(--green-soft); color: var(--green); }
    .sec.running .sec-status { background: var(--blue-soft); color: var(--blue); }
    .sec.error .sec-status   { background: var(--red-soft); color: var(--red); }

    .spinner {
      width: 10px; height: 10px; border-radius: 50%;
      border: 2px solid currentColor;
      border-right-color: transparent;
      display: inline-block;
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .reconnect-banner {
      padding: 12px 14px;
      background: var(--blue-soft);
      border: 1px solid rgba(37, 99, 235, 0.2);
      border-radius: var(--radius);
      color: #1e3a8a;
    }
    .reconnect-banner .rb-head {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      margin-bottom: 6px;
    }
    .reconnect-banner .rb-head .spinner {
      width: 12px; height: 12px;
      color: var(--blue);
      flex-shrink: 0;
    }
    .reconnect-banner p { margin: 0; }
    .reconnect-banner p + p { margin-top: 4px; }

    .log-details { margin-top: 10px; }
    .log-details > summary {
      font-size: 11px; color: var(--text-muted); cursor: pointer;
      text-transform: uppercase; letter-spacing: 0.5px;
    }
    .muted { color: var(--text-muted); }
  `],
})
export class SidePanelComponent implements OnDestroy {
  drafts = inject(DraftService);
  auth = inject(AuthService);
  private reasonPrompt = inject(ReasonPromptService);
  submitting = signal(false);
  deciding = signal(false);
  reply = signal('');
  finalizing = signal(false);
  finalizeError = signal<string | null>(null);

  phaseSteps = PHASE_STEPS;

  // Ticks every second while a run is active so the elapsed timer updates.
  private _tick = signal(0);
  private _tickHandle: ReturnType<typeof setInterval> = setInterval(
    () => this._tick.update((n) => n + 1),
    1000,
  );

  ngOnDestroy(): void {
    clearInterval(this._tickHandle);
  }

  elapsedLabel = computed(() => {
    this._tick(); // dependency to refresh every second
    const started = this.drafts.progress().startedAtMs;
    if (!started) return '';
    const sec = Math.max(0, Math.floor((Date.now() - started) / 1000));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  });

  filledCount = computed(() => {
    const secs = this.drafts.progress().sections;
    return secs.reduce((acc, s) => acc + (s.filled ?? 0), 0);
  });

  /** Interleave PDF-style group headings (e.g. "Section 2 – IMPACT DETAILS")
   *  among the live section progress rows so the side panel mirrors the
   *  form's two-level hierarchy. Section→group lookup uses the static spec. */
  groupedSectionItems = computed(() => {
    const sections = this.drafts.progress().sections;
    const spec = this.drafts.spec() ?? [];
    const groupBySection = new Map<string, string>();
    for (const s of spec) groupBySection.set(s.section, s.group ?? '');
    const items: Array<
      | { kind: 'group'; key: string; label: string }
      | { kind: 'sec'; key: string; sec: import('../../core/services/draft.service').SectionProgress; indented: boolean }
    > = [];
    let lastGroup: string | null = null;
    let gKey = 0;
    sections.forEach((sec, i) => {
      const g = groupBySection.get(sec.name) ?? '';
      if (g !== lastGroup) {
        if (g) items.push({ kind: 'group', key: `g-${gKey++}`, label: g });
        lastGroup = g;
      }
      items.push({ kind: 'sec', key: `s-${i}-${sec.name}`, sec, indented: !!g });
    });
    return items;
  });

  /** Follow-up questions still awaiting an answer — drops any whose field
   *  has since been filled (so the list shrinks as the user edits). */
  unansweredQuestions = computed(() => {
    const d = this.drafts.draft();
    if (!d) return [];
    return d.pending_questions.filter((q) => {
      const f = d.fields[q.field_id];
      return !f || f.value === null || f.value === undefined || f.value === '';
    });
  });

  /** All required (dep-aware) fields still empty — split by source_mode so
   *  we can surface what the agent can close vs what only the user can. */
  remainingGaps = computed(() => {
    const d = this.drafts.draft();
    const spec = this.drafts.spec() ?? [];
    if (!d) return { all: [] as { id: string; label: string; section: string; source_mode: string }[], agent: [], manual: [] };
    const fills = d.fields;
    const depOk = (s: import('../../core/models/contract').FieldSpec) => {
      const dep = s.depends_on;
      if (!dep) return true;
      const p = fills[dep.field_id];
      if (!p || p.value === null || p.value === undefined || p.value === '') return false;
      return p.value === dep.equals;
    };
    const all = spec
      .filter((s) => s.required && depOk(s))
      .filter((s) => {
        const f = fills[s.id];
        return !f || f.value === null || f.value === undefined || f.value === '';
      })
      .map((s) => ({ id: s.id, label: s.label, section: s.section, source_mode: s.source_mode }));
    const agent  = all.filter((g) => g.source_mode === 'application' || g.source_mode === 'hybrid');
    const manual = all.filter((g) => g.source_mode === 'manual' || g.source_mode === 'optional');
    return { all, agent, manual };
  });

  unresolvedFields = computed(() => {
    const d = this.drafts.draft();
    const spec = this.drafts.spec() ?? [];
    if (!d) return [];
    const byId = new Map(spec.map((s) => [s.id, s]));
    return d.unresolved_field_ids
      .map((id) => byId.get(id))
      .filter((s): s is NonNullable<typeof s> => !!s)
      .map((s) => ({ id: s.id, label: s.label, section: s.section }));
  });

  phaseStatus(p: ProgressPhase): 'pending' | 'running' | 'done' {
    const prog = this.drafts.progress();
    if (prog.completedPhases.has(p)) return 'done';
    if (prog.phase === p) return 'running';
    // Earlier phases reached → mark prior ones as done even if their event
    // was missed (defensive: covers fast nodes that go straight to 'done').
    const order: ProgressPhase[] = ['retrieve', 'fill', 'evaluate', 'ask'];
    const curIdx = prog.phase ? order.indexOf(prog.phase) : -1;
    const myIdx = order.indexOf(p);
    if (curIdx > myIdx) return 'done';
    return 'pending';
  }

  resume(): void {
    const d = this.drafts.draft();
    if (!d) return;
    this.drafts.startRun(d.draft_id, this.reply().trim());
    this.reply.set('');
  }

  jumpToField(fieldId: string): void {
    this.drafts.requestEdit(fieldId);
  }

  canFinalize(): boolean {
    const d = this.drafts.draft();
    if (!d) return false;
    const spec = this.drafts.spec() ?? [];
    const fills = d.fields;
    const depSatisfied = (s: { depends_on?: { field_id: string; equals: unknown } | null }) => {
      const dep = s.depends_on;
      if (!dep) return true;
      const parent = fills[dep.field_id];
      if (!parent || parent.value === null || parent.value === undefined || parent.value === '') {
        return false;
      }
      return parent.value === dep.equals;
    };
    for (const s of spec) {
      if (!s.required) continue;
      // Fields hidden by an unmet depends_on don't block finalization
      if (!depSatisfied(s)) continue;
      const f = fills[s.id];
      if (!f || f.value === null || f.value === undefined || f.value === '') {
        return false;
      }
    }
    return true;
  }

  /** Render an HttpErrorResponse / Error / unknown into a readable message
   *  instead of letting it stringify to "[object Object]". */
  private formatError(e: unknown): string {
    if (typeof e === 'string') return e;
    if (e && typeof e === 'object') {
      const any = e as Record<string, unknown>;
      // Angular HttpErrorResponse: detail can be {message, missing} or a string
      const err = any['error'];
      if (err && typeof err === 'object') {
        const d = (err as Record<string, unknown>)['detail'];
        if (typeof d === 'string') return d;
        if (d && typeof d === 'object') {
          const dd = d as Record<string, unknown>;
          if (typeof dd['message'] === 'string') return dd['message'] as string;
        }
        if (typeof (err as Record<string, unknown>)['detail'] === 'string') {
          return (err as Record<string, unknown>)['detail'] as string;
        }
      }
      if (typeof err === 'string') return err;
      if (typeof any['message'] === 'string') return any['message'] as string;
      if (typeof any['statusText'] === 'string' && typeof any['status'] === 'number') {
        return `${any['status']} ${any['statusText']}`;
      }
    }
    return String(e);
  }

  isOwnDraft(): boolean {
    const d = this.drafts.draft();
    if (!d) return false;
    return d.maker_user_id === this.auth.user();
  }

  async submit(): Promise<void> {
    this.submitting.set(true);
    this.finalizeError.set(null);
    try {
      await this.drafts.submitForReview();
    } catch (e: unknown) {
      this.finalizeError.set(`Submit failed: ${this.formatError(e)}`);
    } finally {
      this.submitting.set(false);
    }
  }

  async approve(): Promise<void> {
    this.deciding.set(true);
    this.finalizeError.set(null);
    try {
      await this.drafts.approveDraft();
    } catch (e: unknown) {
      this.finalizeError.set(`Approve failed: ${this.formatError(e)}`);
    } finally {
      this.deciding.set(false);
    }
  }

  async reject(): Promise<void> {
    const reason = await this.reasonPrompt.ask({
      title: 'Reject draft',
      intro: 'Send this draft back to the maker. They will see your reason and can edit then re-submit.',
      confirmLabel: 'Send back to maker',
      destructive: true,
      minLength: 10,
      placeholder: 'Explain what needs to change before this draft can be approved…',
      hint: 'This rejection note is shown to the maker and recorded in the audit trail.',
      suggestions: [
        'Required fields incomplete or inconsistent',
        'Classification not aligned with User Guide',
        'Missing supporting detail in event description',
        'Sign-off section not properly completed',
      ],
    });
    if (reason === null) return; // cancelled
    this.deciding.set(true);
    this.finalizeError.set(null);
    try {
      await this.drafts.rejectDraft(reason);
    } catch (e: unknown) {
      this.finalizeError.set(`Reject failed: ${this.formatError(e)}`);
    } finally {
      this.deciding.set(false);
    }
  }

  async finalize(): Promise<void> {
    this.finalizing.set(true);
    this.finalizeError.set(null);
    try {
      await this.drafts.finalize();
    } catch (e: unknown) {
      this.finalizeError.set(`Failed to finalize: ${this.formatError(e)}`);
    } finally {
      this.finalizing.set(false);
    }
  }

  downloadJson(): void {
    const d = this.drafts.draft();
    if (!d) return;
    const blob = new Blob([JSON.stringify(d, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `incident-report-${d.draft_id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
