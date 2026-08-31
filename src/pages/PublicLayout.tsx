import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@mantine/core';
import { IconBrandGoogle } from '@tabler/icons-react';
import { useAuth } from '../contexts/AuthContext';
import classes from './PublicLayout.module.css';

export function PublicLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated, signIn, isLoading } = useAuth();

  useEffect(() => {
    document.documentElement.classList.add('public-site');
    return () => {
      document.documentElement.classList.remove('public-site');
    };
  }, []);

  return (
    <div className={classes.shell}>
      <header className={classes.header}>
        <Link to="/" className={classes.brand}>
          <img src="/icon.svg" alt="" width={32} height={32} />
          <span>Homeslate</span>
        </Link>
        <nav className={classes.nav} aria-label="Site">
          <Link to="/privacy" className={classes.navLink}>Privacy</Link>
          <Link to="/terms" className={classes.navLink}>Terms</Link>
          {isAuthenticated ? (
            <Button component={Link} to="/displays" size="sm" radius="md">
              Open your displays
            </Button>
          ) : (
            <Button
              size="sm"
              radius="md"
              leftSection={<IconBrandGoogle size={16} />}
              onClick={signIn}
              loading={isLoading}
            >
              Sign in with Google
            </Button>
          )}
        </nav>
      </header>
      <main className={classes.main}>{children}</main>
      <footer className={classes.footer}>
        <p>Homeslate — home displays you arrange yourself.</p>
        <p>
          <Link to="/privacy">Privacy Policy</Link>
          {' · '}
          <Link to="/terms">Terms of Service</Link>
          {' · '}
          <a href="mailto:support@homeslate.dev">support@homeslate.dev</a>
        </p>
      </footer>
    </div>
  );
}
