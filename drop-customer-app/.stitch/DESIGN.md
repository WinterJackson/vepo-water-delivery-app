# Drop Customer App Design System

## 1. Brand Identity
Drop is a premium, multivendor water delivery platform. The design language must feel inherently trustworthy, clean, and highly efficient. It should evoke the same operational excellence as the Uber apps (Uber, UberEats), but uniquely tailored to water delivery.

## 2. Core Colors (Retaining Brand Identity)
- **Primary Action (Brand Blue):** `#3498db` (Used for primary buttons, active states, key icons)
- **Secondary Accent (Yellow/Gold):** `#f1c40f` & `#d9a31b` (Used for ratings, offers, premium highlights)
- **Background (Clean Base):** `#f9f9f9` (Light mode base) / Deep Black or Dark Charcoal for dark mode elements.
- **Surface (Cards/Overlays):** White `#ffffff` with subtle shadows, or Glassmorphic frosted overlays.
- **Text (High Contrast):** `#333333` for primary readability, lighter grays for secondary text.

## 3. Typography
- **Font Family:** Inter (or similar modern sans-serif).
- **Hierarchy (Scaled for Mobile):**
  - Headers: Scaled down (e.g., 20px - 24px max for main titles) to prevent overwhelming the screen.
  - Body: Crisp, highly legible (14px - 16px).
  - Line Height: Generous to maintain readability.

## 4. Layout & Rhythm (Uber-Inspired)
- **Edge-to-Edge Maps:** Maps should bleed to the edges of the screen, acting as the primary canvas where applicable.
- **Bottom Sheets:** Use heavy, rounded bottom sheets (Border Radius: 24px) that overlay the map for content and actions.
- **Bento Grids & Cards:** Gapless or tightly spaced bento grids for categories and dashboards.
- **Micro-Animations:** (For the actual React Native implementation) Elements should have smooth, spring-based transitions.
- **Whitespace & Padding:** CRITICAL - Use highly refined, generous padding inside cards (especially promotional banners) to ensure text does not feel cramped against borders. 
- **Avatars & Icons:** Perfectly circular avatars, high-quality thick-line icons.

## 5. UI Elements
- **Buttons:** Large tap targets (min 48px height), fully rounded corners or soft squircle borders.
- **Inputs:** Clean, borderless inputs with soft gray backgrounds, or minimal bottom borders.
- **Shadows:** Very soft, diffuse drop shadows for elevation.

## 6. Design System Notes for Stitch Generation
When generating screens, ALWAYS enforce:
- A strictly modern, minimal, high-contrast aesthetic.
- The use of the brand blue (#3498db) for the primary Call to Action.
- Bottom sheet overlays for dense information or map interactions.
- Refined, smaller typography for headers (mobile-appropriate scale).
- Clean, crisp surface cards with very subtle shadows, and meticulously balanced internal padding (ensure text has plenty of breathing room inside discount cards).
- If it's a map screen, show a full-bleed map with an interactive bottom sheet layered on top.
