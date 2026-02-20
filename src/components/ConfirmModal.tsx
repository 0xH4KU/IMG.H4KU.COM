import { useId } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import styles from './ConfirmModal.module.css';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmModal({
  open,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  danger = false,
  onCancel,
  onConfirm,
}: ConfirmModalProps) {
  const titleId = useId();
  const trapRef = useFocusTrap<HTMLDivElement>(open);

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div
        ref={trapRef}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={event => event.stopPropagation()}
      >
        <h3 id={titleId} className={styles.title}>{title}</h3>
        <p className={styles.message}>{message}</p>
        <div className={styles.actions}>
          <button className={styles.secondary} onClick={onCancel}>{cancelText}</button>
          <button className={`${styles.primary} ${danger ? styles.danger : ''}`} onClick={onConfirm}>{confirmText}</button>
        </div>
      </div>
    </div>
  );
}
