import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface TranslateResponse {
  translated: string;
  input_lang: 'ar' | 'en' | 'unknown';
}

@Injectable({ providedIn: 'root' })
export class TranslateApi {
  private http = inject(HttpClient);
  private base = environment.apiBaseUrl;

  translate(text: string): Observable<TranslateResponse> {
    return this.http.post<TranslateResponse>(
      `${this.base}/api/translate`,
      { text },
    );
  }
}

/** Cheap Arabic-character probe so the UI can hide the button when there's
 *  nothing to translate. Matches the BE regex. */
export function containsArabic(text: string): boolean {
  return /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/.test(text);
}
