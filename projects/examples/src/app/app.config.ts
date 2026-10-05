import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { DesktopMotion, provideDesktopConfig } from '@omnidyon/ngx-desktop';

/** `?motion=full` or `?motion=none` in the demo URL tries the motion setting; otherwise it follows the system. */
function motionFromUrl(): DesktopMotion {
  const motion = new URLSearchParams(globalThis.location?.search ?? '').get('motion');
  return motion === 'full' || motion === 'none' ? motion : 'system';
}

export const appConfig: ApplicationConfig = {
  providers: [provideBrowserGlobalErrorListeners(), provideDesktopConfig({ motion: motionFromUrl() })],
};
