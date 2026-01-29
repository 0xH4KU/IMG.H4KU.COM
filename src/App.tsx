import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Login } from './pages/Login';
import { Admin } from './pages/Admin';
import { Landing } from './pages/Landing';
import styles from './App.module.css';

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const [isConsoleRoute, setIsConsoleRoute] = useState(false);

  useEffect(() => {
    const checkRoute = () => {
      setIsConsoleRoute(window.location.pathname.startsWith('/console'));
    };
    checkRoute();
    window.addEventListener('popstate', checkRoute);
    return () => window.removeEventListener('popstate', checkRoute);
  }, []);

  if (!isConsoleRoute) {
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
