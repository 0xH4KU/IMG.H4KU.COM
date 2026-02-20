import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Login } from './pages/Login';
import { Admin } from './pages/Admin';
import { Landing } from './pages/Landing';
import { Share } from './pages/Share';
import styles from './App.module.css';

function resolveRoute(pathname: string): 'console' | 'share' | 'landing' {
  if (pathname.startsWith('/console')) return 'console';
  if (pathname.startsWith('/share/')) return 'share';
  return 'landing';
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const [route, setRoute] = useState<'console' | 'share' | 'landing'>('landing');

  useEffect(() => {
    const checkRoute = () => {
      setRoute(resolveRoute(window.location.pathname));
    };
    checkRoute();
    window.addEventListener('popstate', checkRoute);
    return () => window.removeEventListener('popstate', checkRoute);
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.setAttribute('data-route', route);
  }, [route]);

  if (route === 'share') {
    return <Share />;
  }

  if (route !== 'console') {
    return <Landing />;
  }

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  return <Admin />;
}

export function App() {
  return (
    <div className={styles.app}>
      <ErrorBoundary>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ErrorBoundary>
    </div>
  );
}
