/**
 * Lightweight analytics tracking utility.
 * Can be wired to Mixpanel, Amplitude, or any analytics provider.
 *
 * For now, logs to console in dev and provides a clear interface
 * for plugging in a real analytics SDK.
 */

type EventProperties = Record<string, string | number | boolean | null | undefined>;

let analyticsProvider: {
    track: (event: string, properties?: EventProperties) => void;
    identify: (userId: string, traits?: EventProperties) => void;
    screen: (screenName: string, properties?: EventProperties) => void;
} | null = null;

/**
 * Initialize analytics with your preferred provider.
 * Call this once in root _layout.tsx on mount.
 *
 * Example with Mixpanel:
 * ```
 * import { Mixpanel } from 'mixpanel-react-native';
 * const mixpanel = new Mixpanel("YOUR_TOKEN");
 * initAnalytics({
 *   track: (e, p) => mixpanel.track(e, p),
 *   identify: (id, t) => { mixpanel.identify(id); mixpanel.people.set(t); },
 *   screen: (name, p) => mixpanel.track("Screen Viewed", { screen: name, ...p }),
 * });
 * ```
 */
export function initAnalytics(provider: typeof analyticsProvider) {
    analyticsProvider = provider;
}

/**
 * Track a custom event.
 */
export function trackEvent(event: string, properties?: EventProperties) {
    if (__DEV__) {
        console.log(`[Analytics] ${event}`, properties || "");
    }
    analyticsProvider?.track(event, properties);
}

/**
 * Identify a user (call after authentication).
 */
export function identifyUser(userId: string, traits?: EventProperties) {
    if (__DEV__) {
        console.log(`[Analytics] Identify: ${userId}`, traits || "");
    }
    analyticsProvider?.identify(userId, traits);
}

/**
 * Track a screen view.
 */
export function trackScreen(screenName: string, properties?: EventProperties) {
    if (__DEV__) {
        console.log(`[Analytics] Screen: ${screenName}`, properties || "");
    }
    analyticsProvider?.screen(screenName, properties);
}
