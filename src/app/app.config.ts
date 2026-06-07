import {
  ApplicationConfig,
  provideAppInitializer,
  inject,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter, withComponentInputBinding } from '@angular/router';

import { routes } from './app.routes';
import { DraftService } from './core/services/draft.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(),
    provideRouter(routes, withComponentInputBinding()),
    // Load the field spec once at app start; views can read it synchronously after.
    provideAppInitializer(async () => {
      const drafts = inject(DraftService);
      await drafts.loadSpec().catch(() => {
        /* leave empty; views will retry */
      });
    }),
  ],
};
