import { CommonModule } from '@angular/common';
import { Component, ElementRef, Input, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { containsArabic, TranslateApi } from '../../core/api/translate.api';
import { FieldFill, FieldSpec } from '../../core/models/contract';
import { AuthService } from '../../core/services/auth.service';
import { DraftService } from '../../core/services/draft.service';
import { ReasonPromptService } from '../../core/services/reason-prompt.service';
import { TranslationCompareService } from '../../core/services/translation-compare.service';

@Component({
  selector: 'field-row',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="field" [id]="'field-' + spec.id"
         [class.unresolved]="isUnresolved() && !isDisabled"
         [class.pending]="isPending() && !isUnresolved() && !isDisabled"
         [class.is-disabled]="isDisabled"
         [class.flash]="flash()">
      <div class="field-head">
        <div class="label">
          {{ spec.label }}
          @if (spec.required && !isDisabled) {
            <span class="req" title="required">*</span>
          }
          @if (isDisabled) {
            <span class="na-tag" title="Not applicable — depends on a parent field">N/A</span>
          }
        </div>
        @if (fill && !isDisabled) {
          <span class="pill" [class]="confidenceClass()">
            {{ fill.source === 'user_manual' ? 'manual' : (fill.confidence * 100 | number:'1.0-0') + '%' }}
          </span>
        }
      </div>

      @if (isTickBox()) {
        <!-- Always-visible PDF-style tick boxes (boolean + small enums).
             Clicking a radio saves immediately; no edit/save dance. -->
        <div class="value">
          @if (spec.type === 'boolean') {
            <div class="radios">
              <label class="radio">
                <input
                  type="radio"
                  [name]="'r-' + spec.id"
                  [checked]="currentValue() === true"
                  [disabled]="isDisabled"
                  (change)="tickSave(true)"
                />
                <span>Yes</span>
              </label>
              <label class="radio">
                <input
                  type="radio"
                  [name]="'r-' + spec.id"
                  [checked]="currentValue() === false"
                  [disabled]="isDisabled"
                  (change)="tickSave(false)"
                />
                <span>No</span>
              </label>
            </div>
          } @else {
            <div class="radios">
              @for (opt of spec.enum; track opt) {
                <label class="radio">
                  <input
                    type="radio"
                    [name]="'r-' + spec.id"
                    [value]="opt"
                    [checked]="currentValue() === opt"
                    [disabled]="isDisabled"
                    (change)="tickSave(opt)"
                  />
                  <span>{{ opt }}</span>
                </label>
              }
            </div>
          }
          @if (!isDisabled) {
            <div class="meta">
              @if (fill?.rationale) {
                <span class="rationale" [title]="fill?.rationale">{{ fill?.rationale }}</span>
              }
              @if ((fill?.evidence_guide_refs?.length ?? 0) > 0
                   || (fill?.evidence_incident_refs?.length ?? 0) > 0) {
                <span class="ev">
                  @for (g of fill?.evidence_guide_refs; track g) {
                    <span class="badge guide" title="Guide chunk: {{ g }}">📖 guide</span>
                  }
                  @for (i of fill?.evidence_incident_refs; track i) {
                    <span class="badge incident" title="Past incident: {{ i }}">🗂 {{ i }}</span>
                  }
                </span>
              }
              <button class="link audit-link" (click)="toggleAudit()">
                {{ showAudit() ? 'Hide audit' : 'Audit' }}
              </button>
            </div>
          }
        </div>
      } @else if (editing()) {
        <div class="value">
          @switch (spec.type) {
            @case ('long_text') {
              <textarea rows="3" dir="auto" [(ngModel)]="draftValue"></textarea>
              <div class="translate-row">
                @if (showFieldTranslate()) {
                  <button
                    type="button"
                    class="translate-btn"
                    [disabled]="translating()"
                    (click)="translateField()"
                    title="Translate the entered Arabic to English"
                  >
                    {{ translating() ? 'Translating…' : '🌐 Translate to English' }}
                  </button>
                }
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
                @if (translateError()) {
                  <span class="translate-err">{{ translateError() }}</span>
                }
              </div>
            }
            @case ('enum') {
              <select [(ngModel)]="draftValue">
                <option [ngValue]="null">— choose —</option>
                @for (opt of spec.enum; track opt) {
                  <option [ngValue]="opt">{{ opt }}</option>
                }
              </select>
            }
            @case ('number') {
              <input type="number" step="0.01" [(ngModel)]="draftValue" />
            }
            @case ('date') {
              <input type="text" placeholder="DDMMYYYY" maxlength="8" [(ngModel)]="draftValue" />
            }
            @default {
              <input type="text" [(ngModel)]="draftValue" />
            }
          }
          <div class="edit-actions">
            <button (click)="cancel()">Cancel</button>
            <button class="primary" (click)="save()">Save</button>
          </div>
        </div>
      } @else {
        <div class="value">
          @if (isDisabled) {
            <div class="display empty">— not applicable —</div>
          } @else if (fill?.value !== undefined && fill?.value !== null && fill?.value !== '') {
            <div class="display">{{ formatValue(fill?.value) }}</div>
          } @else {
            <div class="display empty">— empty —</div>
          }
          @if (!isDisabled) {
            <div class="meta">
              @if (fill?.rationale) {
                <span class="rationale" [title]="fill?.rationale">
                  {{ fill?.rationale }}
                </span>
              }
              @if ((fill?.evidence_guide_refs?.length ?? 0) > 0
                   || (fill?.evidence_incident_refs?.length ?? 0) > 0) {
                <span class="ev">
                  @for (g of fill?.evidence_guide_refs; track g) {
                    <span class="badge guide" title="Guide chunk: {{ g }}">📖 guide</span>
                  }
                  @for (i of fill?.evidence_incident_refs; track i) {
                    <span class="badge incident" title="Past incident: {{ i }}">🗂 {{ i }}</span>
                  }
                </span>
              }
              <button class="link" (click)="startEdit()">Edit</button>
              <button class="link audit-link" (click)="toggleAudit()">
                {{ showAudit() ? 'Hide audit' : 'Audit' }}
              </button>
            </div>
          }
        </div>
      }

      @if (showAudit() && !isDisabled) {
        <div class="audit">
          <table>
            <thead>
              <tr><th>Layer</th><th>Value</th><th>User</th><th>Reason</th><th>When</th></tr>
            </thead>
            <tbody>
              <tr>
                <td><span class="layer ai">AI</span></td>
                <td>{{ fmt(fill?.ai_value) || '—' }}</td>
                <td>agent</td>
                <td class="reason">{{ fill?.rationale || '—' }}</td>
                <td>{{ fill?.ai_filled_at ? (fill?.ai_filled_at | date:'short') : '—' }}</td>
              </tr>
              <tr>
                <td><span class="layer maker">Maker</span></td>
                <td>{{ fmt(fill?.maker_value) || '—' }}</td>
                <td>{{ fill?.maker_user_id || '—' }}</td>
                <td class="reason">{{ fill?.maker_reason || '—' }}</td>
                <td>{{ fill?.maker_at ? (fill?.maker_at | date:'short') : '—' }}</td>
              </tr>
              <tr>
                <td><span class="layer checker">Checker</span></td>
                <td>{{ fmt(fill?.checker_value) || '—' }}</td>
                <td>{{ fill?.checker_user_id || '—' }}</td>
                <td class="reason">{{ fill?.checker_reason || '—' }}</td>
                <td>{{ fill?.checker_at ? (fill?.checker_at | date:'short') : '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
  styles: [`
    .field {
      padding: 12px 14px;
      border-top: 1px solid var(--border);
    }
    .field.unresolved {
      background: #fffaf0;
    }
    .field.pending {
      background: #fffaf0;
      box-shadow: inset 3px 0 0 var(--amber, #d97706);
    }
    .field.is-disabled {
      opacity: 0.55;
      background: #fafafa;
    }
    .field.is-disabled .label { color: var(--text-soft); }
    .na-tag {
      display: inline-block;
      margin-left: 6px;
      padding: 1px 6px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      background: #eee;
      color: var(--text-soft);
    }
    .field.flash {
      animation: rowflash 1.4s ease-out;
    }
    @keyframes rowflash {
      0%   { background: #fff3bf; }
      100% { background: transparent; }
    }
    .field-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 4px;
    }
    .label { font-weight: 500; }
    .req { color: var(--red); margin-left: 2px; }
    .pill {
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 999px;
      font-weight: 600;
    }
    .pill.high   { background: var(--green-soft); color: var(--green); }
    .pill.mid    { background: var(--amber-soft); color: var(--amber); }
    .pill.low    { background: var(--red-soft);   color: var(--red); }
    .pill.manual { background: var(--purple-soft); color: var(--purple); }

    .display { font-weight: 500; }
    .display.empty { color: var(--text-muted); font-style: italic; font-weight: 400; }

    .meta {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 4px;
      color: var(--text-soft);
      font-size: 12px;
    }
    .rationale {
      max-width: 540px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-style: italic;
    }
    .badge {
      display: inline-block;
      padding: 1px 6px;
      border-radius: 4px;
      margin-right: 4px;
      font-size: 11px;
    }
    .badge.guide    { background: #eef4ff; color: var(--blue); }
    .badge.incident { background: #f5f0ff; color: var(--purple); }

    .edit-actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      margin-top: 6px;
    }
    button.link {
      background: none;
      border: none;
      color: var(--blue);
      padding: 0;
      font-size: 12px;
    }

    .radios {
      display: flex;
      flex-wrap: wrap;
      gap: 10px 18px;
      padding: 4px 0;
    }
    .radio {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      cursor: pointer;
    }
    .radio input[type="radio"] {
      accent-color: var(--blue);
      margin: 0;
    }
    .radio input[type="radio"]:disabled + span {
      color: var(--text-muted);
    }

    .audit-link { margin-left: 12px; }

    .translate-row {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-top: 6px;
    }
    .translate-btn {
      background: #eef4ff;
      color: var(--blue, #2563eb);
      border: 1px solid #dbeafe;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 12px;
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
    .translate-err {
      color: var(--red, #b91c1c);
      font-size: 12px;
    }
    .audit {
      margin-top: 10px;
      padding: 10px 12px;
      background: #f8fafc;
      border: 1px solid var(--border, #e5e7eb);
      border-radius: 6px;
      font-size: 12px;
    }
    .audit table { width: 100%; border-collapse: collapse; }
    .audit th, .audit td {
      padding: 6px 8px;
      text-align: left;
      vertical-align: top;
      border-bottom: 1px dashed var(--border, #e5e7eb);
    }
    .audit th {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-soft);
    }
    .audit tr:last-child td { border-bottom: none; }
    .audit .layer {
      display: inline-block;
      padding: 1px 7px;
      border-radius: 999px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .audit .layer.ai      { background: #ede9fe; color: #6d28d9; }
    .audit .layer.maker   { background: #dbeafe; color: #1e40af; }
    .audit .layer.checker { background: #dcfce7; color: #166534; }
    .audit .reason { max-width: 320px; white-space: pre-wrap; }
  `],
})
export class FieldRowComponent {
  @Input({ required: true }) spec!: FieldSpec;
  @Input() fill?: FieldFill | null;
  @Input() unresolved: string[] = [];
  @Input() pending: string[] = [];
  @Input() isDisabled = false;

  private drafts = inject(DraftService);
  private auth = inject(AuthService);
  private translateApi = inject(TranslateApi);
  private reasonPrompt = inject(ReasonPromptService);
  private compare = inject(TranslationCompareService);
  private host = inject(ElementRef<HTMLElement>);
  translating = signal(false);
  translateError = signal<string | null>(null);
  // After a successful translation, stash the original Arabic so the user
  // can toggle back to it for side-by-side comparison.
  originalArabic = signal<string | null>(null);
  showingOriginal = signal(false);

  /** True when the user has typed Arabic in a long_text edit box AND we
   *  haven't already produced a translation for this content. */
  showFieldTranslate(): boolean {
    if (this.spec.type !== 'long_text') return false;
    const v = this.draftValue;
    if (typeof v !== 'string' || !containsArabic(v)) return false;
    return this.originalArabic() === null;
  }

  /** Open the side-by-side compare modal for this field. If the user clicks
   *  "Restore original Arabic", swap the editor content back. */
  async openCompare(): Promise<void> {
    const orig = this.originalArabic();
    if (orig === null) return;
    const cur = typeof this.draftValue === 'string' ? this.draftValue : '';
    const result = await this.compare.open({
      title: 'Compare translation',
      fieldLabel: this.spec.label,
      original: orig,
      translated: cur,
      originalLang: 'ar',
      translatedLang: 'en',
    });
    if (result.kind === 'restore-original') {
      this.draftValue = orig;
      this.originalArabic.set(cur);
      this.showingOriginal.set(true);
    }
  }

  async translateField(): Promise<void> {
    const v = this.draftValue;
    if (typeof v !== 'string' || !v.trim()) return;
    this.translating.set(true);
    this.translateError.set(null);
    try {
      const res = await firstValueFrom(this.translateApi.translate(v));
      if (res.input_lang !== 'en') {
        this.originalArabic.set(v);
        this.showingOriginal.set(false);
      }
      this.draftValue = res.translated;
    } catch (e: unknown) {
      this.translateError.set(this.formatTranslateError(e));
    } finally {
      this.translating.set(false);
    }
  }

  private formatTranslateError(e: unknown): string {
    if (e && typeof e === 'object') {
      const any = e as Record<string, unknown>;
      const err = any['error'];
      if (err && typeof err === 'object') {
        const d = (err as Record<string, unknown>)['detail'];
        if (typeof d === 'string') return d;
      }
      if (typeof any['message'] === 'string') return any['message'] as string;
    }
    return `Failed: ${String(e)}`;
  }
  editing = signal(false);
  flash = signal(false);
  draftValue: unknown = null;

  isUnresolved = computed(() => this.unresolved.includes(this.spec.id));
  isPending = computed(() => this.pending.includes(this.spec.id));

  /** Boolean + small enums (≤5 options) render as always-visible PDF-style
   *  tick boxes. Larger enums fall back to a select inside the edit panel. */
  isTickBox(): boolean {
    if (this.spec.type === 'boolean') return true;
    if (this.spec.type === 'enum') return (this.spec.enum?.length ?? 0) <= 5;
    return false;
  }

  currentValue(): unknown {
    return this.fill?.value ?? null;
  }

  async tickSave(v: unknown): Promise<void> {
    if (this.isDisabled) return;
    if (this.fill?.value === v) return; // no-op if already selected
    const reason = await this.askReasonIfOverride(v);
    if (reason === null) return; // user cancelled
    try {
      await this.drafts.patchField(this.spec.id, v, reason || undefined);
    } catch (e: unknown) {
      window.alert(this.formatPatchError(e));
    }
  }

  /** Show an inline audit drawer when the user clicks "Audit" on a field. */
  showAudit = signal(false);
  toggleAudit(): void { this.showAudit.update((v) => !v); }

  /** True when there's already a value (AI, maker, or checker) — used to
   *  decide whether to prompt for a "reason for change". */
  hasExistingValue(): boolean {
    if (!this.fill) return false;
    const vals = [this.fill.ai_value, this.fill.maker_value, this.fill.checker_value, this.fill.value];
    return vals.some((v) => v !== undefined && v !== null && v !== '');
  }

  /** Open the styled reason-prompt modal if we're overriding an existing value.
   *  Returns the reason string, '' if no prompt was needed (first fill), or
   *  null if the user cancelled. */
  private async askReasonIfOverride(newValue: unknown): Promise<string | null> {
    if (!this.hasExistingValue()) return '';
    const role = this.auth.role();
    const isChecker = role === 'checker';
    const oldEffective = this.fill?.value;

    const suggestions = isChecker
      ? [
          'Maker classification not aligned with policy',
          'Correcting an error introduced by maker',
          'Aligning with current User Guide definition',
          'Updating after discussion with Risk Steward',
        ]
      : [
          'AI classification not aligned with the incident',
          'Updated based on new information',
          'Correcting a typo / formatting',
          'Refined per User Guide guidance',
        ];

    const reason = await this.reasonPrompt.ask({
      title: isChecker ? 'Checker reason for change' : 'Reason for change',
      intro: isChecker
        ? 'You are overriding the maker\'s value. Provide the reason for your change.'
        : 'You are overriding a previously-filled value. Provide the reason for your change.',
      fieldLabel: this.spec.label,
      oldValue: oldEffective,
      newValue,
      confirmLabel: 'Save change',
      minLength: 5,
      suggestions,
      placeholder: 'Briefly explain why this change is being made…',
    });
    return reason;
  }

  private formatPatchError(e: unknown): string {
    if (e && typeof e === 'object') {
      const any = e as Record<string, unknown>;
      const err = any['error'];
      if (err && typeof err === 'object') {
        const d = (err as Record<string, unknown>)['detail'];
        if (typeof d === 'string') return d;
        if (d && typeof d === 'object' && typeof (d as Record<string, unknown>)['message'] === 'string') {
          return (d as Record<string, unknown>)['message'] as string;
        }
      }
      if (typeof any['message'] === 'string') return any['message'] as string;
    }
    return `Save failed: ${String(e)}`;
  }

  constructor() {
    // React when the side-panel requests this field to be opened for edit.
    effect(() => {
      const req = this.drafts.editRequest();
      if (req && req.id === this.spec?.id && !this.isDisabled) {
        this.startEdit();
        // Scroll + flash in the next tick so the row exists in its edited form.
        queueMicrotask(() => {
          this.host.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          this.flash.set(true);
          setTimeout(() => this.flash.set(false), 1500);
        });
      }
    });
  }

  confidenceClass(): string {
    if (!this.fill) return 'low';
    if (this.fill.source === 'user_manual') return 'manual';
    const c = this.fill.confidence;
    if (c >= environment.confidenceThreshold) return 'high';
    if (c >= 0.4) return 'mid';
    return 'low';
  }

  startEdit(): void {
    this.draftValue = this.fill?.value ?? null;
    this.editing.set(true);
    this.resetTranslationState();
  }

  cancel(): void {
    this.editing.set(false);
    this.resetTranslationState();
  }

  private resetTranslationState(): void {
    this.originalArabic.set(null);
    this.showingOriginal.set(false);
    this.translateError.set(null);
  }

  async save(): Promise<void> {
    let v: unknown = this.draftValue;
    if (this.spec.type === 'number' && typeof v === 'string') {
      v = v === '' ? null : Number(v);
    }
    const reason = await this.askReasonIfOverride(v);
    if (reason === null) return;
    try {
      await this.drafts.patchField(this.spec.id, v, reason || undefined);
      this.editing.set(false);
      this.resetTranslationState();
    } catch (e: unknown) {
      window.alert(this.formatPatchError(e));
    }
  }

  /** Compact value formatter used in the audit drawer. */
  fmt(v: unknown): string {
    if (v === null || v === undefined || v === '') return '';
    return this.formatValue(v);
  }

  formatValue(v: unknown): string {
    if (v === null || v === undefined || v === '') return '';
    if (this.spec.type === 'date' && typeof v === 'string' && v.length === 8) {
      return `${v.slice(0, 2)}/${v.slice(2, 4)}/${v.slice(4)}`;
    }
    if (this.spec.type === 'boolean') return v ? 'Yes' : 'No';
    return String(v);
  }
}
