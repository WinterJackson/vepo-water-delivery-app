import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableScale } from "@/components/ui/PressableScale";
import { ERROR_BOUNDARY, BRAND } from '@/constants/brandColors';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  resetCount: number;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onReset?: () => void;
}

const MAX_RESETS = 3;

/**
 * ErrorBoundary — shared across all 3 Vepo apps.
 * Wrap at the navigator level to prevent full-app crashes.
 * Usage: <ErrorBoundary><NavigatorComponent /></ErrorBoundary>
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, resetCount: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log to your monitoring service here (e.g. Sentry)
    if (__DEV__) console.error('[ErrorBoundary] Caught error:', error.message, info.componentStack);
  }

  handleReset = () => {
    if (this.state.resetCount >= MAX_RESETS) {
        if (__DEV__) console.warn('Max ErrorBoundary resets reached. Crashing gracefully.');
        return;
    }
    
    this.setState((prev) => ({ hasError: false, error: null, resetCount: prev.resetCount + 1 }));
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      const isMaxResets = this.state.resetCount >= MAX_RESETS;

      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message} numberOfLines={3}>
            {this.state.error?.message ?? 'An unexpected error occurred.'}
          </Text>
          <PressableScale style={styles.button} onPress={this.handleReset}>
            <Text style={styles.buttonText}>Try Again</Text>
          </PressableScale>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: ERROR_BOUNDARY.bgDark,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: ERROR_BOUNDARY.textDark,
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: ERROR_BOUNDARY.textDark,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  button: {
    backgroundColor: BRAND.blue,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  buttonText: {
    color: ERROR_BOUNDARY.textDark,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ErrorBoundary;
