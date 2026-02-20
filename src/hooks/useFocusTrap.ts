import { useEffect, useRef, useCallback } from 'react';

/**
 * Traps focus inside the referenced element when `active` is true.
 * Returns a ref to attach to the dialog container.
 */
export function useFocusTrap<T extends HTMLElement = HTMLElement>(active: boolean) {
    const ref = useRef<T>(null);

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key !== 'Tab' || !ref.current) return;

        const focusable = ref.current.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
            if (document.activeElement === first) {
                e.preventDefault();
                last.focus();
            }
        } else {
            if (document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
    }, []);

    useEffect(() => {
        if (!active || !ref.current) return;

        // Focus first focusable element on open
        const focusable = ref.current.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length > 0) {
            // Delay to allow render to complete
            requestAnimationFrame(() => focusable[0]?.focus());
        }

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [active, handleKeyDown]);

    return ref;
}
