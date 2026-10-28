# Campus Auction (mini eBay) — Project Architecture & File Directory

This document provides a comprehensive, detailed breakdown of every folder and file in the **Campus Auction** application. It explains the purpose, architectural role, and core functions of each component across both the **Frontend** and **Backend**.

---

## 📁 High-Level Architecture Overview

```text
mini_eBuy/
├── backend/            # Express.js REST API, MongoDB models, WebSockets & Cron service
├── frontend/           # React 18 + Vite + Tailwind CSS Single Page Application
├── client/             # Symlink / junction pointing to frontend
├── server/             # Symlink / junction pointing to backend
├── package.json        # Root package convenience scripts
├── README.md           # Project documentation and quickstart instructions
├── session.md          # Architectural history and session change log
├── FOLDER.MD           # Comprehensive directory and file explanation (This document)
└── .gitignore          # Git exclusion rules for node_modules, build artifacts, and env files
```

---

## 🗂️ Root Files

| File / Folder | Type | Description |
|---|---|---|
| `backend/` | Directory | The complete Node.js / Express backend application and MongoDB database layer. |
| `frontend/` | Directory | The complete React 18 / Vite frontend client application. |
| `client/` | Junction / Link | Directory link pointing to `frontend/` for convenience in dual-naming workflows. |
| `server/` | Junction / Link | Directory link pointing to `backend/` for convenience in dual-naming workflows. |
| `package.json` | File | Root configuration file containing unified convenience scripts (`npm run dev`, `npm run seed`, `npm test`). |
| `README.md` | File | Comprehensive developer guide covering project overview, tech stack, installation, testing, and lifecycle flow. |
| `session.md` | File | Detailed technical audit log of previous development milestones, architectural fixes, and state machine changes. |
| `FOLDER.MD` | File | This exhaustive file-by-file directory reference and architecture documentation. |
| `.gitignore` | File | Specifies intentionally untracked files that Git should ignore (e.g., `node_modules/`, `dist/`, `.env`, temporary logs). |

---

## 🖥️ Backend Architecture (`backend/`)

The backend is built with **Node.js**, **Express.js**, **MongoDB** (running locally via Mongoose), **Socket.IO** (for real-time updates), **JWT** (for session authentication), **Multer** (for photo uploads), and **node-cron** (for automated timer expiration).

```text
backend/
├── config/
│   └── db.js
├── controllers/
│   ├── auctionController.js
│   ├── authController.js
│   ├── notificationController.js
│   └── userController.js
├── middleware/
│   ├── auth.js
│   └── upload.js
├── models/
│   ├── Auction.js (Item.js)
│   ├── Bid.js
│   ├── Notification.js
│   └── User.js
├── routes/
│   ├── auctionRoutes.js
│   ├── authRoutes.js
│   ├── notificationRoutes.js
│   └── userRoutes.js
├── scripts/
│   ├── clean-mock-data.js
│   ├── seed.js
│   └── verify-all.js
├── services/
│   └── auctionService.js
├── sockets/
│   └── socketManager.js
├── test/
│   └── rules.test.js
├── uploads/
├── utils/
│   └── money.js
├── .env
├── .env.example
├── package.json
└── server.js
```

### 1. Root Configuration & Entry Point
- **`server.js`**
  - **Purpose:** Primary application entry point.
  - **Responsibilities:**
    - Initializes Express app and HTTP server.
    - Attaches Socket.IO with CORS origins matching the client.
    - Connects to local MongoDB (`127.0.0.1:27017/campus_auction`).
    - Mounts global middleware (JSON parser, URL encoder, cookie parser, static uploads serving).
    - Registers API route endpoints under `/api/auth`, `/api/auctions`, `/api/users`, and `/api/notifications`.
    - Starts the background auction expiration cron service.
    - Handles graceful server shutdown on `SIGINT`.
- **`.env`**
  - **Purpose:** Environment variables for local execution (e.g., `PORT=5000`, `MONGODB_URI`, `JWT_SECRET`, `CLIENT_URL`).
- **`.env.example`**
  - **Purpose:** Example environment template for new team members and production deployments.
- **`package.json`**
  - **Purpose:** Backend dependency definitions (`express`, `mongoose`, `jsonwebtoken`, `bcryptjs`, `multer`, `node-cron`, `socket.io`) and scripts (`npm start`, `npm test`, `npm run seed`, `npm run clean-db`).

---

### 2. Configuration (`backend/config/`)
- **`config/db.js`**
  - **Purpose:** Establishes and manages the Mongoose connection to the local MongoDB database.
  - **Key Features:** Graceful connection logging, error handling with troubleshooting tips, and reconnection management.

---

### 3. Controllers (`backend/controllers/`)
Controllers contain the core business logic and request/response handlers:

- **`controllers/auctionController.js`**
  - **Purpose:** Manages the entire lifecycle of timed auctions and live bidding.
  - **Functions:**
    - `getAuctions`: Query active auctions with search keywords, categories, conditions, price range, and sorting.
    - `getAuctionById`: Retrieve full auction detail with populated seller and winner details.
    - `getAuctionBids`: Retrieve public bid history for a specific listing in reverse chronological order.
    - `createAuction`: Create a new listing with uploaded photos, validating closing time and pricing.
    - `placeBid`: Places a new bid using atomic concurrency checks to ensure bids meet or exceed minimum increments, preventing self-bidding and late bids.
    - `approveBid`: Allows sellers to accept a leading bid (both early on active auctions or after the countdown ends), transition the listing to `Reserved`, and store handover notes.
    - `rejectBid`: Rejects a leading bid, rolls back the auction to the prior highest bid, and updates the price.
    - `confirmHandover`: Finalizes the in-person transaction, marks the auction as `Sold`, records sold timestamp, and notifies parties.
    - `recordFailedPickup`: Handles cases where buyer/seller fails to meet, recording the outcome reason.
    - `cancelAuction`: Allows sellers to cancel an active listing before winning commitments.
    - `getCategories` & `getStats`: Returns dynamic categories and live database statistics.

- **`controllers/authController.js`**
  - **Purpose:** Handles student authentication and role management.
  - **Functions:**
    - `register`: Validates college email, hashes password with bcrypt, and creates student user accounts.
    - `login`: Verifies student credentials, generates signed JWT tokens, and sets secure HTTP-only cookies.
    - `logout`: Clears authentication cookies.
    - `getMe`: Returns authenticated user profile data.
    - `switchRole`: Toggles student profile perspective between `bidder` and `seller`.

- **`controllers/notificationController.js`**
  - **Purpose:** Manages in-app alerts and notifications.
  - **Functions:**
    - `getNotifications`: Fetches student notifications sorted by creation date with pagination.
    - `markAsRead`: Marks an individual notification as read.
    - `markAllAsRead`: Marks all unread alerts for the logged-in student as read.

- **`controllers/userController.js`**
  - **Purpose:** Provides user profile summaries and role dashboards.
  - **Functions:**
    - `getMyListings`: Fetches all auctions created by the logged-in student, grouped by status.
    - `getMyBids`: Fetches all auctions where the student has placed bids, categorized by active, won, outbid, and reserved.
    - `getUserProfile`: Returns public student profile details and auction feedback.

---

### 4. Middleware (`backend/middleware/`)
- **`middleware/auth.js`**
  - **Purpose:** Route protection and JWT token verification.
  - **Features:**
    - `protect`: Extracts JWT from cookies or `Authorization: Bearer <token>` header, verifies token validity, and attaches the user document to `req.user`.
    - `optionalAuth`: Attaches user if token exists, but permits unauthenticated guests to view public routes.
- **`middleware/upload.js`**
  - **Purpose:** Multipart/form-data image upload handler using Multer.
  - **Features:** Validates image file extensions (JPG, PNG, WebP), limits size to 5MB, and assigns unique timestamped filenames.

---

### 5. Models (`backend/models/`)
Mongoose schemas defining the database structure:

- **`models/Item.js` (Auction)**
  - **Purpose:** Stores auction listing details.
  - **Fields:** `title`, `category`, `description`, `condition` (`New`, `Like New`, `Good`, `Fair`, `Poor`), `photos` (array of image URLs), `startingPrice` (paise), `minimumIncrement` (paise), `currentLeadingBid` (paise), `currentLeadingBidder` (ref to User), `bidCount`, `closingAt`, `status` (`Active`, `Pending Approval`, `Reserved`, `Sold`, `Unsold`, `Cancelled`), `provisionalWinner`, `winningAmount`, `handoverMeetingNote`, `soldAt`.
- **`models/Bid.js`**
  - **Purpose:** Stores individual public bids.
  - **Fields:** `auction` (ref to Item), `bidder` (ref to User), `amount` (integer paise), `idempotencyKey`, `createdAt`.
- **`models/User.js`**
  - **Purpose:** Stores campus student accounts.
  - **Fields:** `name`, `email` (unique, lowercase), `passwordHash`, `role` (`bidder`, `seller`, `admin`), `profilePhoto`, `createdAt`.
  - **Methods:** `comparePassword()` using bcrypt, `toPublicJSON()` to safely omit sensitive hashes.
- **`models/Notification.js`**
  - **Purpose:** Stores user alerts.
  - **Fields:** `user` (ref to User), `type` (`BID_OUTBID`, `AUCTION_WON`, `AUCTION_CLOSED`, `ITEM_RESERVED`, `SALE_COMPLETED`), `message`, `auction` (ref to Item), `readAt`, `createdAt`.

---

### 6. Routes (`backend/routes/`)
REST endpoint mappings:
- **`routes/auctionRoutes.js`:** Maps `/api/auctions` endpoints (search, detail, create, bid, approve, reject, handover).
- **`routes/authRoutes.js`:** Maps `/api/auth` endpoints (register, login, logout, me, switch-role).
- **`routes/notificationRoutes.js`:** Maps `/api/notifications` endpoints (list, read, mark-all).
- **`routes/userRoutes.js`:** Maps `/api/users` endpoints (my-listings, my-bids, profile).

---

### 7. Services & Sockets (`backend/services/` & `backend/sockets/`)
- **`services/auctionService.js`**
  - **Purpose:** Automated background lifecycle supervisor.
  - **Functionality:** Runs a periodic cron check (every 10 seconds) that queries for expired auctions (`status: 'Active'` and `closingAt <= now`). Automatically closes auctions, marks listings with bids as `Pending Approval` (or selects provisional winner), marks listings with zero bids as `Unsold`, sends notifications, and emits real-time WebSocket events.
- **`sockets/socketManager.js`**
  - **Purpose:** WebSocket real-time communication engine.
  - **Functionality:** Manages auction rooms (`join:auction`, `leave:auction`), broadcasts `bid:placed` events, and emits `auction:status_changed` notifications so users see bids update instantly without refreshing.

---

### 8. Utilities & Tests (`backend/utils/` & `backend/test/`)
- **`utils/money.js`**
  - **Purpose:** Handles financial currency arithmetic.
  - **Functionality:** Converts between Indian Rupees (INR) and integer paise (1 INR = 100 paise) to prevent IEEE 754 floating-point rounding bugs during bidding and increments.
- **`test/rules.test.js`**
  - **Purpose:** Automated regression test suite containing 16 unit and state machine tests verifying currency precision, anti-self-bidding rules, minimum increment enforcement, and state transitions.

---

### 9. Maintenance Scripts (`backend/scripts/`)
- **`scripts/clean-mock-data.js`:** Administrative script to safely remove seeded test data while keeping authentic student accounts.
- **`scripts/seed.js`:** Fixture script for optional initial development fixtures and test graphics.
- **`scripts/verify-all.js`:** Automated system diagnostic checking database connectivity, collection health, and API routes.

---

## 🎨 Frontend Architecture (`frontend/`)

The frontend is a single-page application built with **React 18**, **Vite**, **Tailwind CSS**, **React Router DOM**, **Axios**, **Socket.IO Client**, and **Lucide React** icons.

```text
frontend/
├── public/
│   └── placeholder.svg
├── src/
│   ├── api/
│   │   ├── auctionApi.js
│   │   ├── authApi.js
│   │   ├── axios.js
│   │   ├── notificationApi.js
│   │   └── userApi.js
│   ├── assets/
│   ├── components/
│   │   ├── AuctionCard.jsx
│   │   ├── BidHistory.jsx
│   │   ├── CountdownTimer.jsx
│   │   ├── Footer.jsx
│   │   ├── Navbar.jsx
│   │   ├── NotificationBell.jsx
│   │   ├── ProtectedRoute.jsx
│   │   ├── SearchFilters.jsx
│   │   └── StatusBadge.jsx
│   ├── context/
│   │   ├── AuthContext.jsx
│   │   └── SocketContext.jsx
│   ├── hooks/
│   │   └── useCountdown.js
│   ├── pages/
│   │   ├── AuctionDetails.jsx
│   │   ├── CreateListing.jsx
│   │   ├── Home.jsx
│   │   ├── Login.jsx
│   │   ├── MyBids.jsx
│   │   ├── MyListings.jsx
│   │   ├── NotFound.jsx
│   │   ├── Notifications.jsx
│   │   ├── Register.jsx
│   │   └── SellerDashboard.jsx
│   ├── App.jsx
│   ├── index.css
│   └── main.jsx
├── .env
├── .env.example
├── index.html
├── package.json
├── postcss.config.js
├── tailwind.config.js
└── vite.config.js
```

### 1. Root Configuration & Boot
- **`index.html`:** HTML5 template, viewport configuration, and root DOM container (`#root`).
- **`vite.config.js`:** Vite build settings, `@vitejs/plugin-react`, and dev server proxy to `http://localhost:5000`.
- **`tailwind.config.js`:** Custom color palette, typography styles, and animation definitions.
- **`postcss.config.js`:** PostCSS processor configuration enabling Tailwind and Autoprefixer.
- **`src/main.jsx`:** React 18 bootstrap mounting the application into `#root` with `BrowserRouter`.
- **`src/App.jsx`:** Main routing manifest defining paths, layout wraps, and protected route access.
- **`src/index.css`:** Global styles, Tailwind directives, custom font imports, and animations.

---

### 2. API Communication Layer (`frontend/src/api/`)
- **`api/axios.js`**
  - **Purpose:** Centralized Axios instance configured with `withCredentials: true` (ensuring HTTP-only JWT cookies are sent automatically) and standard base URLs.
- **`api/auctionApi.js`**
  - **Purpose:** Frontend methods for auction endpoints: search, view details, get bids, place bids, approve bids, reject bids, confirm handover, and fetch metrics.
- **`api/authApi.js`**
  - **Purpose:** Authentication requests: login, registration, logout, fetch current profile (`/me`), and role toggling.
- **`api/notificationApi.js`**
  - **Purpose:** Notification requests: list alerts, mark individual alert as read, and mark all alerts as read.
- **`api/userApi.js`**
  - **Purpose:** User dashboard queries: fetch seller listings, fetch student bids, and fetch seller metrics.

---

### 3. State Management & Contexts (`frontend/src/context/`)
- **`context/AuthContext.jsx`**
  - **Purpose:** Global authentication state provider.
  - **State & Actions:** Manages `user`, `isAuthenticated`, `loading`, `login()`, `register()`, `logout()`, and `switchRole()`.
- **`context/SocketContext.jsx`**
  - **Purpose:** Global WebSocket connection manager.
  - **State & Actions:** Maintains an active Socket.IO connection to `http://localhost:5000`, reconnecting automatically and providing real-time event distribution.

---

### 4. Custom Hooks (`frontend/src/hooks/`)
- **`hooks/useCountdown.js`**
  - **Purpose:** Live countdown calculation hook.
  - **Outputs:** Calculates remaining days, hours, minutes, seconds, and an `isExpired` boolean flag, updating every second and notifying listeners when an auction expires.

---

### 5. UI Components (`frontend/src/components/`)
- **`components/Navbar.jsx`**
  - **Purpose:** Global top navigation bar.
  - **Features:** Campus Auction branding, search shortcut, "Browse Auctions", "List an Item" button, real-time notification bell, role switcher, and user avatar dropdown menu.
- **`components/Footer.jsx`**
  - **Purpose:** Global footer featuring mission statement, safety guidelines, category links, and campus verification credentials.
- **`components/AuctionCard.jsx`**
  - **Purpose:** Card component representing an auction item in discovery grids.
  - **Features:** Product photo preview, status badge, category tag, countdown timer pill, item title, current leading price, and total bid count.
- **`components/CountdownTimer.jsx`**
  - **Purpose:** Visual timer badge with dynamic warning color changes (e.g., turning red when under 10 minutes remain).
- **`components/BidHistory.jsx`**
  - **Purpose:** Displays live chronological bid history table.
  - **Features:** Shows bidder names, timestamps, formatted amounts in ₹, leading bid badge, and inline **Accept** and **Reject** buttons for sellers.
- **`components/SearchFilters.jsx`**
  - **Purpose:** Discovery control panel with keyword search, category pills, condition filters, price range sliders, and sorting options.
- **`components/NotificationBell.jsx`**
  - **Purpose:** Interactive header bell displaying live unread badges and a dropdown list of recent alerts.
- **`components/ProtectedRoute.jsx`**
  - **Purpose:** Route guard component that redirects unauthenticated users to the `/login` page with return-path tracking.
- **`components/StatusBadge.jsx`**
  - **Purpose:** Visual badge component formatting auction statuses (`Active`, `Pending Approval`, `Reserved`, `Sold`, `Unsold`, `Cancelled`).

---

### 6. Pages (`frontend/src/pages/`)
- **`pages/Home.jsx`**
  - **Purpose:** The main marketplace homepage.
  - **Features:** Hero section with live database figures, dynamic category pills, filter panel, active auction grid, and an interactive empty state.
- **`pages/Login.jsx`**
  - **Purpose:** Student login page.
  - **Features:** Perspective role selection (Bidder, Seller, Admin), email and password inputs, error banners, and smart redirects.
- **`pages/Register.jsx`**
  - **Purpose:** Student registration page.
  - **Features:** Campus role selection, name, university email, password confirmation, and input validation.
- **`pages/AuctionDetails.jsx`**
  - **Purpose:** In-depth auction view and live bidding terminal.
  - **Features:**
    - High-resolution photo gallery with thumbnails.
    - Authoritative live countdown timer.
    - Dynamic bid input with quick increment buttons (`+₹50`, `+₹100`, `+₹250`).
    - **Custom "Confirm Your Bid" modal** for bidders (eliminating native browser popups).
    - Public Bid History with live socket updates.
    - **Seller Control Panel** with custom modal confirmation dialogs for:
      1. Accepting a leading bid early
      2. Approving winning bid with campus handover location
      3. Rejecting a bid
      4. Confirming completed handover (marking item as `Sold`)
      5. Recording failed pickups
      6. Cancelling active listings
- **`pages/CreateListing.jsx`**
  - **Purpose:** Seller listing creation form.
  - **Features:** Drag-and-drop / file selector image upload, category selection, condition grading, starting price in ₹, minimum increment, and closing duration selector (from 5 minutes up to 14 days).
- **`pages/SellerDashboard.jsx`**
  - **Purpose:** Dedicated seller workspace.
  - **Features:** Performance summary cards (total revenue, active listings, pending decisions, scheduled handovers), actionable listings section with custom modals to accept bids and confirm handovers.
- **`pages/MyListings.jsx`**
  - **Purpose:** Comprehensive seller listing management table.
  - **Features:** Tabbed status filters (`All`, `Active`, `Pending Approval`, `Reserved`, `Sold`), action buttons, and modal dialogs.
- **`pages/MyBids.jsx`**
  - **Purpose:** Student bidder dashboard.
  - **Features:** Grouped lists of live bids (leading, outbid, won items awaiting handover, completed purchases).
- **`pages/Notifications.jsx`**
  - **Purpose:** Central notification center to view all past alerts with direct links to auction items.
- **`pages/NotFound.jsx`**
  - **Purpose:** Friendly 404 page for broken routes with quick return to Home.

---

## 🔄 State Machine & Auction Lifecycle

```text
               ┌───────────────┐
               │    Active     │
               └───────┬───────┘
                       │
       ┌───────────────┴───────────────┐
       ▼                               ▼
(Timer expires with bids)     (Timer expires with 0 bids)
       │                               │
       ▼                               ▼
┌──────────────────┐           ┌───────────────┐
│ Pending Approval │           │    Unsold     │
└────────┬─────────┘           └───────────────┘
         │
         ▼ (Seller accepts / approves)
┌──────────────────┐
│     Reserved     │ ◄─── (Seller can also accept early from Active)
└────────┬─────────┘
         │
         ▼ (In-person campus handover complete)
┌──────────────────┐
│       Sold       │
└──────────────────┘
```

---

## 🛡️ Security & Architecture Guarantees

1. **No Hardcoded / Dummy Data:** All user accounts, listings, bids, and notifications are 100% dynamic, read from and written directly to the local MongoDB database.
2. **Zero Native Browser Popups:** All confirmations (bidding, price approval, handover completion, rejection) utilize custom-styled React modals with backdrop blur and inline error states.
3. **Paise Arithmetic (`money.js`):** All financial values are stored as integers (1 INR = 100 paise) to prevent floating-point rounding errors.
4. **Race Condition Prevention:** Bids are validated against the database atomically to ensure each bid strictly outbids the current leading price by at least the minimum increment.
5. **Role-Based Perspectives:** Students can seamlessly switch between **Bidder** and **Seller** perspectives while using a single unified account.

