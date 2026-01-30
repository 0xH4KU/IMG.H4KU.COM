import styles from './Landing.module.css';

export function Landing() {
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <h1 className={styles.title}>IMG.H4KU.COM</h1>
        <p className={styles.subtitle}>Image Hosting Service</p>
        <p className={styles.description}>
          Private console for uploads, folders, and deliveries.
        </p>
        <div className={styles.actions}>
          <a href="/console" className={styles.link}>
            Open Admin Console
          </a>
          <span className={styles.helper}>Deliveries: /share/&lt;id&gt;</span>
        </div>
      </div>
    </div>
  );
}
