import { Injectable, inject } from '@angular/core';
import { Observable, Subject } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AgentEvent, RunRequest } from '../models/contract';
import { AuthService } from '../services/auth.service';

/**
 * Run (or resume) the agent for a draft.
 *
 * The browser's EventSource cannot POST a body, so we fetch() with stream
 * reading and parse SSE manually. The server emits typed events
 * (`event: <name>\ndata: <json>\n\n`) per the API contract.
 */
@Injectable({ providedIn: 'root' })
export class AgentStream {
  private auth = inject(AuthService);

  /**
   * Returns an Observable that emits typed AgentEvents until the server
   * closes the stream. Subscribers can unsubscribe to abort.
   */
  run(draftId: string, body: RunRequest = {}): Observable<AgentEvent> {
    const url = `${environment.apiBaseUrl}/api/drafts/${draftId}/run`;
    const subject = new Subject<AgentEvent>();
    const ctrl = new AbortController();
    const session = this.auth.session();

    (async () => {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        };
        if (session) {
          headers['X-User'] = session.username;
          headers['X-Role'] = session.role;
        }
        const res = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) {
          subject.next({
            event: 'error',
            data: {
              code: `http_${res.status}`,
              message: await res.text().catch(() => res.statusText),
            },
          });
          subject.complete();
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buf = '';

        // SSE event separator is a blank line. The spec allows LF, CR, or CRLF
        // — sse-starlette emits CRLF (\r\n\r\n), so we split on either form.
        const SEP_RE = /\r\n\r\n|\n\n|\r\r/;

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });

          while (true) {
            const m = SEP_RE.exec(buf);
            if (!m) break;
            const raw = buf.slice(0, m.index);
            buf = buf.slice(m.index + m[0].length);
            const evt = parseSseEvent(raw);
            if (evt) subject.next(evt);
          }
        }
        subject.complete();
      } catch (err: unknown) {
        if (ctrl.signal.aborted) {
          subject.complete();
          return;
        }
        subject.next({
          event: 'error',
          data: { code: 'fetch_error', message: String(err) },
        });
        subject.complete();
      }
    })();

    return new Observable<AgentEvent>((sub) => {
      const inner = subject.subscribe(sub);
      return () => {
        inner.unsubscribe();
        ctrl.abort();
      };
    });
  }
}

function parseSseEvent(raw: string): AgentEvent | null {
  let event = 'message';
  const dataLines: string[] = [];

  // Lines inside an event are separated by LF, CR, or CRLF (SSE spec).
  for (const line of raw.split(/\r\n|\n|\r/)) {
    // SSE comment lines (used as keepalives by sse-starlette) start with ":"
    if (!line || line.startsWith(':')) continue;
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const field = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim();
    if (field === 'event') event = value;
    else if (field === 'data') dataLines.push(value);
  }

  if (dataLines.length === 0) return null;
  let data: unknown;
  try {
    data = JSON.parse(dataLines.join('\n'));
  } catch {
    return null;
  }
  return { event, data } as AgentEvent;
}
