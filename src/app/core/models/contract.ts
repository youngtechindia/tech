/**
 * TypeScript mirror of the BE API contract (backend/app/agent/schemas.py).
 * Keep this file in sync with that Pydantic source.
 */

// ---------- Field spec ----------

export type FieldType =
  | 'string'
  | 'long_text'
  | 'enum'
  | 'date'
  | 'number'
  | 'boolean';

// Per-field input semantics from the PDF template's Guidance / Input column.
//   application — agent fills from event description / guide / past incidents
//   manual      — pure manual entry (agent does not attempt to fill)
//   hybrid      — manual primary input that the agent may refine, or
//                 application pre-fill that needs manual validation
//   optional    — manual + non-required (e.g. Helios ID, recovery date)
export type SourceMode = 'application' | 'manual' | 'hybrid' | 'optional';

export interface FieldDependency {
  field_id: string;
  equals: unknown;
}

export interface FieldSpec {
  id: string;
  section: string;
  label: string;
  type: FieldType;
  required: boolean;
  enum?: string[];
  hist_columns?: string[];
  guide_keywords?: string[];
  source_mode: SourceMode;
  guidance: string;
  /** Inline definitions and classification rules used by the agent in place
   *  of RAG over the long-form procedure document. May be multi-paragraph. */
  domain_knowledge?: string;
  depends_on?: FieldDependency | null;
  /** Optional PDF heading group, e.g. "Section 2 – IMPACT DETAILS".
   *  When set, the FE renders this above the section header. */
  group?: string;
}

// ---------- Field-level fill ----------

export type FillSource = 'agent' | 'user_manual';

export interface FieldFill {
  // effective (legacy compat)
  value: unknown | null;
  confidence: number; // 0..1
  rationale: string;
  evidence_guide_refs: string[];
  evidence_incident_refs: string[];
  source: FillSource;
  updated_at: string; // ISO timestamp
  // AI snapshot (frozen on first agent fill)
  ai_value?: unknown | null;
  ai_confidence?: number;
  ai_filled_at?: string | null;
  // maker layer
  maker_user_id?: string | null;
  maker_value?: unknown | null;
  maker_reason?: string | null;
  maker_at?: string | null;
  // checker layer
  checker_user_id?: string | null;
  checker_value?: unknown | null;
  checker_reason?: string | null;
  checker_at?: string | null;
}

// ---------- Follow-up question ----------

export interface FieldQuestion {
  field_id: string;
  field_label: string;
  section: string;
  question: string;
  current_value?: unknown | null;
  current_confidence: number;
}

// ---------- Draft ----------

export type DraftStatus =
  | 'running'
  | 'awaiting_user'
  | 'awaiting_manual'
  | 'done';

export type WorkflowStatus = 'draft' | 'submitted' | 'approved' | 'rejected';

export interface Draft {
  draft_id: string;
  status: DraftStatus;
  iteration: number;
  description: string;
  description_history: string[];
  fields: Record<string, FieldFill>;
  pending_questions: FieldQuestion[];
  unresolved_field_ids: string[];
  created_at: string;
  updated_at: string;
  // Maker/checker workflow
  workflow_status: WorkflowStatus;
  maker_user_id?: string | null;
  checker_user_id?: string | null;
  submitted_at?: string | null;
  decided_at?: string | null;
  rejection_reason?: string | null;
}

export interface DraftSummary {
  draft_id: string;
  status: DraftStatus;
  workflow_status: WorkflowStatus;
  iteration: number;
  title?: string | null;
  maker_user_id?: string | null;
  checker_user_id?: string | null;
  created_at: string;
  updated_at: string;
}

// ---------- Request bodies ----------

export interface CreateDraftRequest {
  description: string;
}

export interface RunRequest {
  additional_description?: string;
}

export interface PatchFieldsRequest {
  updates: Record<string, { value: unknown; reason?: string }>;
}

export interface RejectRequest {
  reason: string;
}

export interface IngestRequest {
  reset?: boolean;
}

export interface IngestResponse {
  guide_chunks: number;
  incidents: number;
}

// ---------- Progress (custom in-node stream) ----------

export type ProgressPhase = 'retrieve' | 'fill' | 'evaluate' | 'ask' | 'finalize' | 'manual';
export type ProgressStatus = 'start' | 'running' | 'done' | 'error';

export interface ProgressEvent {
  phase: ProgressPhase;
  status?: ProgressStatus;
  section?: string;            // for phase='fill', per-section events
  sections?: string[];         // emitted on fill start: all section names
  section_field_counts?: Record<string, number>;
  fields_in_section?: number;
  filled?: number;
  total?: number;
  guide_chunks?: number;
  incidents?: number;
  count?: number;
  low_confidence_required?: number;
  low_confidence_agent?: number;   // agent-addressable required fields still under-confident
  low_confidence_manual?: number;  // pure-manual required fields still unfilled
  required_total?: number;
  elapsed_ms?: number;
  message?: string;
}

// ---------- SSE event union ----------

export type AgentEvent =
  | { event: 'node_start'; data: { node: string; section?: string } }
  | { event: 'field_update'; data: { field_id: string; fill: FieldFill } }
  | { event: 'iteration'; data: { iteration: number } }
  | { event: 'awaiting_user'; data: { pending_questions: FieldQuestion[] } }
  | { event: 'awaiting_manual'; data: { unresolved_field_ids: string[] } }
  | { event: 'done'; data: { draft: Draft } }
  | { event: 'progress'; data: ProgressEvent }
  | { event: 'error'; data: { code: string; message: string } };
