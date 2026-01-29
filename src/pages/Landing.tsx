import styles from './Landing.module.css';

export function Landing() {
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <h1 className={styles.title}>IMG.H4KU.COM</h1>
        <p className={styles.subtitle}>Image Hosting Service</p>
        <a href="/console" className={styles.link}>
          Admin Panel
        </a>
      </div>
    </div>
  );
}
