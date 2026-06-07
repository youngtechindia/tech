import { CommonModule } from '@angular/common';
import { Component, ElementRef, Input, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { environment } from '../../../environments/environment';
import { FieldFill, FieldSpec } from '../../core/models/contract';
import { DraftService } from '../../core/services/draft.service';

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
            </div>
          }
        </div>
      } @else if (editing()) {
        <div class="value">
          @switch (spec.type) {
            @case ('long_text') {
              <textarea rows="3" [(ngModel)]="draftValue"></textarea>
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
            </div>
          }
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
  `],
})
export class FieldRowComponent {
  @Input({ required: true }) spec!: FieldSpec;
  @Input() fill?: FieldFill | null;
  @Input() unresolved: string[] = [];
  @Input() pending: string[] = [];
  @Input() isDisabled = false;

  private drafts = inject(DraftService);
  private host = inject(ElementRef<HTMLElement>);
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
    await this.drafts.patchField(this.spec.id, v);
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
  }

  cancel(): void {
    this.editing.set(false);
  }

  async save(): Promise<void> {
    let v: unknown = this.draftValue;
    if (this.spec.type === 'number' && typeof v === 'string') {
      v = v === '' ? null : Number(v);
    }
    await this.drafts.patchField(this.spec.id, v);
    this.editing.set(false);
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
