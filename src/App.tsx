import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Login } from './pages/Login';
import { Admin } from './pages/Admin';
import { Landing } from './pages/Landing';
import styles from './App.module.css';

function AppContent() {
  const { isAuthenticated } = useAuth();
  const [isAdminRoute, setIsAdminRoute] = useState(false);

  useEffect(() => {
    const checkRoute = () => {
      setIsAdminRoute(window.location.pathname.startsWith('/admin'));
    };
    checkRoute();
    window.addEventListener('popstate', checkRoute);
    return () => window.removeEventListener('popstate', checkRoute);
  }, []);

  if (!isAdminRoute) {
    return <Landing />;
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
