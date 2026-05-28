declare module '@clerk/clerk-expo' {
    export function useAuth(): {
        getToken: (options?: any) => Promise<string | null>;
        isSignedIn: boolean;
        isLoaded: boolean;
        userId: string | null;
        sessionId: string | null;
        signOut: () => Promise<void>;
    };
    export const SignedIn: any;
    export const SignedOut: any;
    export const ClerkProvider: any;
    export const useUser: () => any;
    export const useOAuth: (opts?: any) => any;
}

declare module '@clerk/clerk-expo/token-cache' {
    export const tokenCache: any;
}

declare module '@react-navigation/native' {
    export const DarkTheme: any;
    export const DefaultTheme: any;
    export const ThemeProvider: any;
}
