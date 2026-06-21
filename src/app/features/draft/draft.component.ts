import { CommonModule } from '@angular/common';
import {
  Component,
  Input,
  OnInit,
  computed,
  inject,
} from '@angular/core';

import { FieldSpec, FieldFill } from '../../core/models/contract';
import { DraftService } from '../../core/services/draft.service';
import { FieldRowComponent } from './field-row.component';
import { SidePanelComponent } from './side-panel.component';

type RenderBlock =
  | { kind: 'group'; key: string; label: string }
  | { kind: 'section'; key: string; label: string; fields: FieldSpec[] };

@Component({
  selector: 'app-draft',
  imports: [CommonModule, FieldRowComponent, SidePanelComponent],
  template: `
    @let d = drafts.draft();
    @if (!d) {
      <p class="muted">Loading…</p>
    } @else {
      <div class="layout">
        <div class="left">
          <div class="card desc-card">
            <h2>Original description</h2>
            <p class="desc">{{ d.description }}</p>
          </div>

          @for (block of renderBlocks(); track block.key) {
            @if (block.kind === 'group') {
              <div class="group-head">{{ block.label }}</div>
            } @else {
              <div class="card section">
                <div class="section-head">{{ block.label }}</div>
                @for (s of block.fields!; track s.id) {
                  <field-row
                    [spec]="s"
                    [fill]="d.fields[s.id]"
                    [unresolved]="d.unresolved_field_ids"
                    [pending]="pendingFieldIds()"
                    [isDisabled]="!isApplicable(s)"
                  />
                }
              </div>
            }
          }
        </div>

        <div class="right">
          <side-panel />
        </div>
      </div>
    }
  `,
  styles: [`
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 380px;
      gap: var(--space-6);
      align-items: start;
    }
    @media (max-width: 1100px) {
      .layout { grid-template-columns: 1fr; }
    }
    .desc-card {
      box-shadow: var(--shadow-sm);
    }
    .desc-card h2 {
      margin: 0 0 var(--space-2);
      font-size: var(--fs-xs);
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: var(--text-soft);
      font-weight: 600;
    }
    .desc {
      margin: 0;
      white-space: pre-wrap;
      color: var(--text-soft);
      line-height: 1.6;
    }
    .section {
      padding: 0;
      margin-top: var(--space-4);
      overflow: hidden;
      box-shadow: var(--shadow-xs);
    }
    .section-head {
      padding: 12px var(--space-5);
      font-weight: 600;
      font-size: var(--fs-md);
      color: var(--text);
      background: var(--surface-2);
      border-bottom: 1px solid var(--border);
    }
    .group-head {
      margin-top: var(--space-7);
      margin-bottom: -8px;
      padding: 12px var(--space-5);
      font-size: var(--fs-xs);
      font-weight: 700;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      color: var(--brand);
      background: linear-gradient(180deg, #eef2ff 0%, #e0e7ff 100%);
      border: 1px solid var(--brand-mid);
      border-bottom: none;
      border-radius: var(--radius-md) var(--radius-md) 0 0;
      box-shadow: var(--shadow-xs);
    }
    .group-head + .section {
      margin-top: 0;
      border-top-left-radius: 0;
      border-top-right-radius: 0;
      border-top: none;
    }
  `],
})
export class DraftComponent implements OnInit {
  @Input() id!: string;

  drafts = inject(DraftService);

  // Build an ordered render plan in YAML/PDF order. We emit a group heading
  // whenever the current spec's `group` changes (e.g. "Section 2 – IMPACT
  // DETAILS"), then a section card under it. Groups can interleave with
  // bare (group="") sections.
  renderBlocks = computed<RenderBlock[]>(() => {
    const specs = this.drafts.spec() ?? [];
    const blocks: RenderBlock[] = [];
    let lastGroup: string | null = null;
    let lastSection: string | null = null;
    let cur: FieldSpec[] | null = null;
    let secKey = 0;
    let grpKey = 0;
    for (const s of specs) {
      const g = s.group ?? '';
      if (g !== lastGroup) {
        if (g) blocks.push({ kind: 'group', key: `g-${grpKey++}`, label: g });
        lastGroup = g;
        lastSection = null; // force new section card
      }
      if (s.section !== lastSection) {
        cur = [];
        blocks.push({ kind: 'section', key: `s-${secKey++}`, label: s.section, fields: cur });
        lastSection = s.section;
      }
      cur!.push(s);
    }
    return blocks;
  });

  pendingFieldIds = computed(() =>
    (this.drafts.draft()?.pending_questions ?? []).map((q) => q.field_id),
  );

  /** True if the field's depends_on is currently satisfied (or it has none).
   *  Disabled fields stay visible in the form but the row is greyed and
   *  non-editable until the parent applicability flips. */
  isApplicable(s: FieldSpec): boolean {
    const dep = s.depends_on;
    if (!dep) return true;
    const fills: Record<string, FieldFill> = this.drafts.draft()?.fields ?? {};
    const parent = fills[dep.field_id];
    if (!parent || parent.value === null || parent.value === undefined || parent.value === '') {
      return false;
    }
    return parent.value === dep.equals;
  }

  async ngOnInit(): Promise<void> {
    if (!this.drafts.spec()) {
      await this.drafts.loadSpec();
    }
    const cur = this.drafts.draft();
    if (!cur || cur.draft_id !== this.id) {
      await this.drafts.loadDraft(this.id);
    }
  }
}
