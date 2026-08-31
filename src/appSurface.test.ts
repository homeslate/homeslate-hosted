import { describe, expect, it } from 'vitest';
import { resolveAppSurface } from './appSurface';

const base = {
  isAuthenticated: false,
  displayId: null as string | null,
  preview: false,
};

describe('resolveAppSurface', () => {
  it('keeps pairing available without a Google sign-in', () => {
    expect(resolveAppSurface({ ...base, pathname: '/pair' })).toBe('pair');
  });

  it('opens a registered wall display before any marketing or auth screen', () => {
    expect(
      resolveAppSurface({
        ...base,
        pathname: '/',
        displayId: 'display-1',
      }),
    ).toBe('display');
  });

  it('shows the public homepage at / without requiring sign-in', () => {
    expect(resolveAppSurface({ ...base, pathname: '/' })).toBe('home');
  });

  it('still shows the public homepage at / when the visitor is signed in', () => {
    expect(
      resolveAppSurface({
        ...base,
        pathname: '/',
        isAuthenticated: true,
      }),
    ).toBe('home');
  });

  it('shows the privacy policy without requiring sign-in', () => {
    expect(resolveAppSurface({ ...base, pathname: '/privacy' })).toBe('privacy');
  });

  it('still shows the privacy policy when the visitor is signed in', () => {
    expect(
      resolveAppSurface({
        ...base,
        pathname: '/privacy',
        isAuthenticated: true,
      }),
    ).toBe('privacy');
  });

  it('shows the terms of service without requiring sign-in', () => {
    expect(resolveAppSurface({ ...base, pathname: '/terms' })).toBe('terms');
  });

  it('still shows the terms of service when the visitor is signed in', () => {
    expect(
      resolveAppSurface({
        ...base,
        pathname: '/terms',
        isAuthenticated: true,
      }),
    ).toBe('terms');
  });

  it('asks unauthenticated visitors to sign in before the management app', () => {
    expect(resolveAppSurface({ ...base, pathname: '/displays' })).toBe('auth');
  });

  it('opens the management app for signed-in visitors on /displays', () => {
    expect(
      resolveAppSurface({
        ...base,
        pathname: '/displays',
        isAuthenticated: true,
      }),
    ).toBe('app');
  });
});
