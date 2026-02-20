import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error('[ErrorBoundary]', error, info.componentStack);
    }

    render() {
        if (!this.state.hasError) {
            return this.props.children;
        }

        if (this.props.fallback) {
            return this.props.fallback;
        }

        return (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100vh',
                padding: '2rem',
                fontFamily: 'var(--font-primary, monospace)',
                color: 'var(--color-text, #e5e2dd)',
                background: 'var(--color-background, #1a1a1a)',
                textAlign: 'center',
                gap: '1rem',
            }}>
                <h1 style={{ fontSize: '1.25rem', fontWeight: 'normal', opacity: 0.9 }}>
                    Something went wrong
                </h1>
                <p style={{ fontSize: '0.875rem', opacity: 0.5, maxWidth: '40ch' }}>
                    {this.state.error?.message || 'An unexpected error occurred.'}
                </p>
                <button
                    onClick={() => window.location.reload()}
                    style={{
                        marginTop: '0.5rem',
                        padding: '0.5rem 1.5rem',
                        border: '1px solid var(--color-border, #333)',
                        borderRadius: 'var(--radius-md, 8px)',
                        background: 'var(--color-surface, #0f0f0f)',
                        color: 'inherit',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        fontSize: '0.875rem',
                    }}
                >
                    Reload
                </button>
            </div>
        );
    }
}
