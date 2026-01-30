import { useState, FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getBrandDomainLabel } from '../utils/brand';
import { Lock, AlertCircle } from 'lucide-react';
import styles from './Login.module.css';

export function Login() {
  const { login } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;

    setLoading(true);
    setError('');

    const success = await login(password);
    if (!success) {
      setError('Invalid password');
    }
    setLoading(false);
  };

  return (
    <div className={styles.container}>
      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.header}>
          <div className={styles.brand}>{getBrandDomainLabel()}</div>
          <Lock size={32} strokeWidth={1.5} />
          <h1 className={styles.title}>Admin Login</h1>
          <p className={styles.subtitle}>Use your admin password to continue.</p>
        </div>

        {error && (
          <div className={styles.error}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <div className={styles.field}>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password"
            className={styles.input}
            autoFocus
            disabled={loading}
          />
        </div>

        <button type="submit" className={styles.button} disabled={loading}>
          {loading ? 'Verifying...' : 'Login'}
        </button>
      </form>
    </div>
  );
}
