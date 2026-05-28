# Vepo Customer App - Workflow Roadmap

## Core Screens (Redesign Targets)
- [ ] **Splash & Onboarding** (`app/(Auth)/Onboarding.tsx`)
- [ ] **Auth Flow** (`app/(Auth)/sign-in`, `app/(Auth)/sign-up`)
- [ ] **Home Dashboard** (`app/(screens)/index.tsx`): Primary view with categories, nearby vendors, current offers.
- [ ] **Map Explorer** (`app/(screens)/Map`): Full map view to find vendors.
- [ ] **Vendor Details** (`app/(screens)/vendor`): Storefront for a specific vendor.
- [ ] **Product Details** (`app/(screens)/product-details`): Individual item view.
- [ ] **Cart & Checkout** (`app/(screens)/Cart.tsx`, `order-confirmation.tsx`): Cart summary and payment selection.
- [ ] **Active Order Tracking** (`app/(screens)/OrderDetail.tsx`): Live tracking, driver info.
- [ ] **Profile & Settings** (`app/(screens)/Profile.tsx`, `SettingsMain.tsx`): User account.

## Generation Strategy
We will generate these screens sequentially, using the `next-prompt.md` baton file, pushing them to Stitch, then translating them into React Native NativeWind components.
