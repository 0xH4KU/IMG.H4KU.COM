import { useCallback, useState } from 'react';

interface ConfirmState {
  open: boolean;
  title: string;
  message: string;
  danger: boolean;
  resolve: ((confirmed: boolean) => void) | null;
}

interface PromptState {
  open: boolean;
  title: string;
  label: string;
  defaultValue: string;
  resolve: ((value: string | null) => void) | null;
}

export function useConfirmDialog() {
  const [state, setState] = useState<ConfirmState>({
    open: false,
    title: '',
    message: '',
    danger: false,
    resolve: null,
  });

  const confirm = useCallback((message: string, options?: { title?: string; danger?: boolean }): Promise<boolean> => {
    return new Promise(resolve => {
      setState({
        open: true,
        title: options?.title || 'Confirm',
        message,
        danger: options?.danger ?? false,
        resolve,
      });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    state.resolve?.(true);
    setState(prev => ({ ...prev, open: false, resolve: null }));
  }, [state.resolve]);

  const handleCancel = useCallback(() => {
    state.resolve?.(false);
    setState(prev => ({ ...prev, open: false, resolve: null }));
  }, [state.resolve]);

  return {
    confirm,
    confirmProps: {
      open: state.open,
      title: state.title,
      message: state.message,
      danger: state.danger,
      onConfirm: handleConfirm,
      onCancel: handleCancel,
    },
  };
}

export function usePromptDialog() {
  const [state, setState] = useState<PromptState>({
    open: false,
    title: '',
    label: '',
    defaultValue: '',
    resolve: null,
  });

  const prompt = useCallback((label: string, defaultValue = '', options?: { title?: string }): Promise<string | null> => {
    return new Promise(resolve => {
      setState({
        open: true,
        title: options?.title || 'Input',
        label,
        defaultValue,
        resolve,
      });
    });
  }, []);

  const handleConfirm = useCallback((value: string) => {
    state.resolve?.(value);
    setState(prev => ({ ...prev, open: false, resolve: null }));
  }, [state.resolve]);

  const handleCancel = useCallback(() => {
    state.resolve?.(null);
    setState(prev => ({ ...prev, open: false, resolve: null }));
  }, [state.resolve]);

  return {
    prompt,
    promptProps: {
      open: state.open,
      title: state.title,
      label: state.label,
      defaultValue: state.defaultValue,
      onConfirm: handleConfirm,
      onCancel: handleCancel,
    },
  };
}
