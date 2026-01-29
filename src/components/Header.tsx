import { LogOut, Sun, Moon, Menu, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import styles from './Header.module.css';

interface HeaderProps {
  selectedDomain: 'h4ku' | 'lum';
  onDomainChange: (domain: 'h4ku' | 'lum') => void;
  onLogout: () => void;
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
  onLogoClick: () => void;
}

export function Header({ selectedDomain, onDomainChange, onLogout, onToggleSidebar, sidebarOpen, onLogoClick }: HeaderProps) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const current = document.documentElement.getAttribute('data-theme') as 'light' | 'dark';
    setTheme(current || 'light');
  }, []);

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    setTheme(next);
  };

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <button
          className={styles.menuBtn}
          onClick={onToggleSidebar}
          aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
        >
          {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <button className={styles.logo} onClick={onLogoClick} title="All Images">
          <span className={styles.logoText}>IMG</span>
          <span className={styles.logoDivider}>/</span>
          <span className={styles.logoSub}>Admin</span>
        </button>
      </div>

      <div className={styles.controls}>
        <div className={styles.domainSwitch}>
          <button
            className={`${styles.domainBtn} ${selectedDomain === 'h4ku' ? styles.active : ''}`}
            onClick={() => onDomainChange('h4ku')}
          >
            h4ku.com
          </button>
          <button
            className={`${styles.domainBtn} ${selectedDomain === 'lum' ? styles.active : ''}`}
            onClick={() => onDomainChange('lum')}
          >
            lum.bio
          </button>
        </div>

        <button className={styles.iconBtn} onClick={toggleTheme} title="Toggle theme">
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>

        <button className={styles.iconBtn} onClick={onLogout} title="Logout">
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}
