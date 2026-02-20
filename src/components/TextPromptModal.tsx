import { useEffect, useId, useState } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import styles from './TextPromptModal.module.css';

interface TextPromptModalProps {
  open: boolean;
  title: string;
  label: string;
  defaultValue?: string;
  confirmText?: string;
  cancelText?: string;
  placeholder?: string;
  onCancel: () => void;
  onConfirm: (value: string) => void;
}

export function TextPromptModal({
  open,
  title,
  label,
  defaultValue = '',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  placeholder,
  onCancel,
  onConfirm,
}: TextPromptModalProps) {
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    if (!open) return;
    setValue(defaultValue);
  }, [open, defaultValue]);

  const titleId = useId();
  const trapRef = useFocusTrap<HTMLDivElement>(open);

  if (!open) return null;

  const submit = () => {
    onConfirm(value);
  };

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
        <label className={styles.field}>
          <span>{label}</span>
          <input
            value={value}
            onChange={event => setValue(event.target.value)}
            placeholder={placeholder}
            autoFocus
          />
        </label>
        <div className={styles.actions}>
          <button className={styles.secondary} onClick={onCancel}>{cancelText}</button>
          <button className={styles.primary} onClick={submit}>{confirmText}</button>
        </div>
      </div>
    </div>
  );
}
