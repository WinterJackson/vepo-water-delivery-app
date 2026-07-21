# Drop Customer App - AI Developer Guide

## 🎯 Architecture & Business Workflow
The Drop Customer App is the B2C entry point for the water delivery platform. It interacts with the centralized `BackendAPI` to discover vendors, place orders, and track deliveries. 

Key Business Workflows:
1. **Discovery**: Uses GPS coordinates to query the backend for nearby vendors. The backend uses PostGIS + H3 indexing to filter vendors within a 2km radius (retail) or 15km radius (wholesale).
2. **Checkout**: 
   - Before checking out, the app must ensure the user has selected an active delivery location.
   - Pushes cart items and location to the backend.
   - Triggers M-Pesa STK push.
   - Polls `GET_ORDERS` to see when the payment callback arrives and order status shifts from `pending` (unpaid) to `unassigned` (paid, awaiting rider).
3. **Tracking**:
   - Once the order is `picked_up`, a WebSocket connects to `/ws/track/{order_id}`.
   - Rider coordinates are received as `{ "lat": x, "lng": y }`.
   - The map interpolates the marker for smooth movement.

## 🏗️ Technical Stack
- **React Native / Expo**: SDK 54, React 19.
- **Styling**: NativeWind v4 (Tailwind CSS).
- **State**: TanStack Query v5 for API caching; Zustand for global UI state (like Theme, Location).
- **Auth**: Clerk (`@clerk/clerk-expo`). Use `getToken()` to attach the `Authorization: Bearer <jwt>` to API calls.

## 📜 Coding Guidelines

### 1. File Structure & Routing
- Expo Router is used. All screens are in `app/(screens)/`.
- Components go in `components/`. Sub-folders should organize by feature (`dashboard/`, `common/`, `ui/`).
- API calls are strictly typed in `API/routes/ApiRoutes.ts`. **Do not hardcode endpoints in components.**

### 2. Styling (NativeWind v4)
- Use standard Tailwind utility classes via `className`.
- **Theme Awareness**: The app supports Dark Mode. Always use the `darkTheme` boolean from `UIThemeContext` (or NativeWind dark variants if configured) to style elements conditionally. 
- Example: `className={darkTheme ? "bg-black text-white" : "bg-white text-black"}`
- Brand Colors: Import colors from `constants/brandColors.ts`. Do not use hardcoded hex codes for primary UI elements.

### 3. Data Fetching (TanStack Query)
- All data fetching must use Custom Hooks located in `hooks/queries/`.
- Never use raw `useEffect` + `fetch` for data loading in components.
- Rely on React Query's caching and refetching mechanisms. Use `queryClient.invalidateQueries` after mutations.

### 4. Null Safety & Error Handling
- Always use optional chaining (`?.`) when rendering API data.
- Numbers/Prices should be formatted safely. e.g., `(item.price || 0).toLocaleString()`.
- Use the central `Toast` component (`lib/toast.ts`) for user feedback on success or failure. Do not use native `Alert` for standard interactions.

### 5. Authentication Flow
- Clerk handles session state.
- Protected routes are wrapped in an authenticated layout.
- The backend expects the Clerk JWT in the `Authorization` header. Use the custom `useApiClient` hook to automatically inject the token.

### 6. Component Design
- Prefer functional components with `React.memo` if they receive complex props in lists.
- Avoid large monolithic screens. Break down `app/(screens)/xxx.tsx` into smaller chunks in `components/`.
- Touchables: Prefer using `PressableScale` over standard `TouchableOpacity` to provide a premium, animated tactile feel.
