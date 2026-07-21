# Drop Vendor App 🏪

> The store management application for the Drop Multivendor Water Delivery Platform. Built with Expo, React Native, and Tailwind CSS (NativeWind).

## 📱 Overview

The Drop Vendor App allows water station owners (Retail and Wholesale) to manage their inventory, accept and dispatch orders, monitor rider fleets, and track daily earnings.

### Core Features
- **Store & Product Management**: Toggle store open/closed status, add products, adjust prices, and manage bottle deposits.
- **Order Processing**: Receive live notifications for new orders. Accept, prepare, and mark orders ready for pickup.
- **Fleet Management**: View In-House riders and assign them to orders, or rely on the Drop Gig Rider network for auto-dispatch.
- **Empty Bottle Reconciliation**: Log and verify empty bottle returns from riders via the "Receive Bottles" workflow.
- **Financial Dashboard**: Track earnings, pending payouts, and request withdrawals via M-Pesa.
- **Staff Roles**: Add staff members to help manage operations without giving them access to financial payouts.

## 🛠️ Tech Stack

- **Framework**: React Native with [Expo SDK 54](https://expo.dev/)
- **Routing**: [Expo Router](https://docs.expo.dev/router/introduction/) (File-based routing)
- **Styling**: [NativeWind v4](https://www.nativewind.dev/) (Tailwind CSS)
- **State Management**: [Zustand](https://zustand-demo.pmnd.rs/) & [TanStack Query v5](https://tanstack.com/query/latest)
- **Authentication**: [Clerk](https://clerk.com/) (Email, Phone OTP, OAuth)
- **Real-time**: `socket.io-client` for WebSockets (Order Updates)
- **Push Notifications**: `expo-notifications`

## 🚀 Getting Started

### Prerequisites
- Node.js (v20+)
- pnpm
- Expo CLI (`npm i -g expo-cli`)
- iOS Simulator or Android Emulator

### Installation

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Configure Environment Variables:
   Create a `.env` file in the root of this app and add:
   ```env
   EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
   EXPO_PUBLIC_BACKEND_BASE_URL=http://<YOUR_IP>:8000
   ```

3. Run the app:
   ```bash
   pnpm start
   ```

## 📂 Project Structure

```
drop-vendor-app/
├── app/
│   ├── (Auth)/           # Authentication (Login, Store Setup)
│   ├── (screens)/        # Core app screens (Orders, Products, Riders, Wallet)
│   └── _layout.tsx       # Root layout
├── API/
│   └── routes/           # Strictly typed Vendor API definitions
├── components/
│   ├── orders/           # Order cards, status pills
│   ├── products/         # Product listing and editing UI
│   └── ui/               # Base UI elements
├── constants/            # Theme, images, icons
├── context/              # Context providers
├── hooks/
│   └── queries/          # TanStack Query data fetching
└── lib/                  # Utilities (Toast, Image Upload logic)
```

## 🔄 Business Logic Details

### Order Workflow
1. Customer pays → Vendor receives Push Notification & WebSocket event (`NEW_ORDER`).
2. Order appears in "Pending" tab.
3. Vendor taps "Accept" → Backend changes status to `accepted`.
4. Vendor physically prepares the water → taps "Ready for Pickup" (`ready`).
5. Backend auto-assigns rider (In-House first, then Trip Radar).
6. Rider arrives, scans/confirms, takes order → Status becomes `picked_up`.
7. Rider delivers water → Status becomes `delivered`. Funds are released to the vendor wallet.

### Product Image Uploads
Vendors can upload photos for their products. The app compresses the image locally to WebP (via `expo-image-manipulator`) before passing it to the backend `SecureUpload` utility which routes it to a private AWS S3 bucket. All image URLs returned by the API are 15-minute presigned S3 URLs to ensure privacy and security.
