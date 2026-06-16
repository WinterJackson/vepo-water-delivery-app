import * as Sentry from "@sentry/react-native";

export function initSentry() {
    if (process.env.EXPO_PUBLIC_SENTRY_DSN) {
        Sentry.init({
            dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
            tracesSampleRate: 1.0,
            _experiments: {
                profilesSampleRate: 1.0,
            },
        });
    }
}

export function captureError(error: Error, context?: Record<string, any>) {
    Sentry.withScope((scope: any) => {
        if (context) {
            scope.setExtras(context);
        }
        Sentry.captureException(error);
    });
}

export function setSentryUser(userId: string, email?: string) {
    Sentry.setUser({ id: userId, email });
}

export function clearSentryUser() {
    Sentry.setUser(null);
}
