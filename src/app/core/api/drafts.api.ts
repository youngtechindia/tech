import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  CreateDraftRequest,
  Draft,
  DraftSummary,
  FieldSpec,
  IngestRequest,
  IngestResponse,
  PatchFieldsRequest,
} from '../models/contract';

@Injectable({ providedIn: 'root' })
export class DraftsApi {
  private http = inject(HttpClient);
  private base = environment.apiBaseUrl;

  // ---- spec ----
  getFieldSpec(): Observable<FieldSpec[]> {
    return this.http.get<FieldSpec[]>(`${this.base}/api/spec/fields`);
  }

  // ---- drafts ----
  createDraft(body: CreateDraftRequest): Observable<Draft> {
    return this.http.post<Draft>(`${this.base}/api/drafts`, body);
  }

  listDrafts(): Observable<DraftSummary[]> {
    return this.http.get<DraftSummary[]>(`${this.base}/api/drafts`);
  }

  getDraft(id: string): Observable<Draft> {
    return this.http.get<Draft>(`${this.base}/api/drafts/${id}`);
  }

  patchFields(id: string, body: PatchFieldsRequest): Observable<Draft> {
    return this.http.patch<Draft>(
      `${this.base}/api/drafts/${id}/fields`,
      body,
    );
  }

  finalizeDraft(id: string): Observable<Draft> {
    return this.http.post<Draft>(
      `${this.base}/api/drafts/${id}/finalize`,
      {},
    );
  }

  deleteDraft(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/api/drafts/${id}`);
  }

  // ---- workflow (maker/checker) ----
  submitForReview(id: string): Observable<Draft> {
    return this.http.post<Draft>(`${this.base}/api/drafts/${id}/submit`, {});
  }

  approveDraft(id: string): Observable<Draft> {
    return this.http.post<Draft>(`${this.base}/api/drafts/${id}/approve`, {});
  }

  rejectDraft(id: string, reason: string): Observable<Draft> {
    return this.http.post<Draft>(`${this.base}/api/drafts/${id}/reject`, { reason });
  }

  // ---- admin ----
  ingest(body: IngestRequest = {}): Observable<IngestResponse> {
    return this.http.post<IngestResponse>(
      `${this.base}/api/admin/ingest`,
      body,
    );
  }
}
