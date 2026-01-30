import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Login } from './pages/Login';
import { Admin } from './pages/Admin';
import { Landing } from './pages/Landing';
import { Share } from './pages/Share';
import styles from './App.module.css';

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const [route, setRoute] = useState<'console' | 'share' | 'landing'>('landing');

  useEffect(() => {
    const checkRoute = () => {
      const path = window.location.pathname;
      if (path.startsWith('/console')) {
        setRoute('console');
      } else if (path.startsWith('/share/')) {
        setRoute('share');
      } else {
        setRoute('landing');
      }
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
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </div>
  );
}
