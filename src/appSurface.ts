export type AppSurface = 'pair' | 'display' | 'home' | 'privacy' | 'terms' | 'auth' | 'app' | 'preview';

export function resolveAppSurface(opts: {
  pathname: string;
  isAuthenticated: boolean;
  displayId: string | null;
  preview: boolean;
}): AppSurface {
  if (opts.pathname === '/pair') return 'pair';
  if (opts.displayId) return 'display';
  if (opts.pathname === '/' || opts.pathname === '') return 'home';
  if (opts.pathname === '/privacy') return 'privacy';
  if (opts.pathname === '/terms') return 'terms';
  if (opts.preview && opts.isAuthenticated) return 'preview';
  if (!opts.isAuthenticated) return 'auth';
  return 'app';
}
