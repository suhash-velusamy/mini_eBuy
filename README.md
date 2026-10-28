# Campus Auction — Full-Stack College Marketplace & Timed Auction Web App

> A production-grade, 100% dynamic mini eBay platform designed specifically for college campuses. Graduating seniors can list used items (bicycles, calculators, textbooks, lab equipment, laptops, and hostel gear) through timed auctions. Junior students can browse listings, place bids, receive real-time outbid alerts via Socket.IO, and win items fairly with safe on-campus in-person handovers.
>
> **100% Fully Dynamic & Zero Hardcoding:** All static and dummy arrays have been eliminated. Every listing, category, public bid history, user profile, notification, and platform metric is fetched and aggregated live from the local MongoDB database.

---

## 1. Project Overview & Architecture

Campus Auction solves the common college problem of passing down valuable academic, technical, and hostel supplies from departing seniors to incoming juniors. 

### Key System Highlights:
- **Unified Student Authentication:** Clean, role-free registration and login. Every registered student account can seamlessly both list items for auction and participate in bidding.
- **Server-Authoritative Enforcement:** Timers, closing dates, bid increments, and permissions are enforced strictly on the server—never trusting the browser clock.
- **Active Listing Management:** Sellers can edit their active listings directly from **My Listings** or the listing details page. Pricing and closing time can be updated before bidding starts; once bids are placed, pricing and countdowns are strictly locked to protect bidder commitments.
- **Atomic Concurrency Protection:** MongoDB atomic conditional updates (`findOneAndUpdate`) with retry loops prevent race conditions, ensuring two simultaneous bids cannot win at an outdated price.
- **Real-Time Bidding & Alerts:** Instant Socket.IO event broadcasting for new leading bids, outbid notifications, countdown resyncs, and status transitions without requiring page refreshes.
- **Automated Expiration Scheduler:** `node-cron` checks for expired auctions every 10 seconds and upon server boot to guarantee zero active orphaned auctions.
- **Strict Seller Workflow:** `Active → Pending Approval → Reserved → Sold`, along with explicit audit trails for `Unsold`, `Cancelled`, `Rejected`, and `Failed Pickup`.
- **Exact Money Accounting:** Currency amounts stored internally as integer paise (1 INR = 100 paise) using `toPaise` and `formatINR` utilities to eliminate JavaScript floating-point errors.
- **Live User & Platform Metrics:** The homepage features a live 4-stat metrics bar showing Total Bids, Active Listings, Campus Sales, and Verified Campus Students directly from MongoDB.

---

## 2. Technology Stack

### Frontend
- **Framework:** React 18 with Vite
- **Styling:** Tailwind CSS (modern, responsive college theme with dark blue accents)
- **Routing:** React Router DOM v6
- **API Client:** Axios with `withCredentials: true`, environment-based `VITE_API_URL`, and token interceptors
- **Real-Time Client:** Socket.IO Client v4
- **State Management:** React Context API (`AuthContext` & `SocketContext`)
- **Icons:** Lucide React

### Backend
- **Runtime:** Node.js (v20+ / v22+)
- **Server Framework:** Express.js
- **Database:** Local MongoDB (`mongodb://127.0.0.1:27017/campus_auction`)
- **ODM:** Mongoose v8
- **Real-Time Server:** Socket.IO v4 (authenticated user rooms & public auction channels)
- **Authentication:** JWT (JSON Web Tokens) with HTTP-only cookies and Bearer headers
- **Password Security:** bcryptjs (10 salt rounds)
- **File Uploads:** Multer with file type validation (JPEG/PNG/WEBP) and 5MB size limits
- **Scheduler:** `node-cron` (runs every 10 seconds)
- **AI Engine:** Anthropic Claude Messages API proxy with hard safety guardrails and human-in-the-loop bid confirmation
- **Rate Limiting:** `express-rate-limit` for authentication, bidding, Q&A, and AI assistant protection

---

## 3. Environment Variables

### Backend (`backend/.env`)
| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `5000` | Backend Express API Port |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/campus_auction` | Local MongoDB Connection URI |
| `JWT_SECRET` | `campus_auction_jwt_secret_dev_key_2026` | Secret key for signing JSON Web Tokens |
| `JWT_EXPIRES_IN` | `7d` | Token expiration duration |
| `CLIENT_URL` | `http://localhost:5174` | Allowed CORS and Socket.IO Origin |
| `ALLOWED_EMAIL_DOMAIN` | `""` *(empty allows all)* | Restrict registration to college domain (e.g. `@kongu.edu` or `@campus.edu`) |
| `MAX_FILE_SIZE_MB` | `5` | Maximum upload size per photo |
| `ANTHROPIC_API_KEY` | *(optional in dev/test)* | Anthropic API key for AI shopping assistant |
| `ANTHROPIC_MODEL` | `claude-3-5-sonnet-20241022` | Claude model name for assistant proxy |

### Frontend (`frontend/.env`)
| Variable | Default | Purpose |
|---|---|---|
| `VITE_API_URL` | *(empty string for proxy)* | Backend API Base URL |
| `VITE_SOCKET_URL` | `http://localhost:5000` | Backend Socket.IO Server URL |

---

## 4. Advanced Platform Features

### Unified Authentication (No Role Selection Required)
- **Simplified Signup & Login:** Students register with **Full Name**, **College Email**, and **Password**. There is no requirement to pick a Buyer or Seller role during onboarding.
- **Universal Capabilities:** Every authenticated student can list items, browse active auctions, place bids, set auto-bidding limits, and track saved wants.
- **Object-Level Authorization:** 
  - Students cannot bid on their own items (`item.seller !== req.user._id`).
  - Only the verified seller can edit, cancel, approve winning bids, or confirm handovers.

### Active Listing Edit Engine
- **Access Points:** Edit button on every active listing in **My Listings** (`/my-listings`) and in the **Seller Control Panel** on the listing details page (`/auctions/:id`).
- **Editable Fields:** Title, description, category, condition, and photo management (remove existing / upload new photos up to 5 total).
- **Rule-Based Locking:**
  - **Zero Bids (`bidCount === 0`):** Starting price, minimum bid increment, and closing countdown can be updated.
  - **Active Bids (`bidCount > 0`):** Pricing, minimum increment, and closing countdown are **strictly locked** to protect bidder commitments and auction integrity.
- **Safety:** Cancelled, Closed, or Sold listings cannot be modified.

### Phase 1: Last-Minute Bid Extensions ("Anti-Sniping")
- **Rule:** If a valid bid is placed when `(closesAt - now) <= 30 seconds`, `closesAt` is automatically extended to `bidTime + 60 seconds`.
- **Atomic Concurrency:** Extension is applied in the same atomic `findOneAndUpdate` that accepts the bid.
- **Socket Event:** `auctionExtended` `{ itemId, closesAt, extensionCount }`.
- **UI:** Countdown timer resyncs and flashes an animated "Extended +60s" badge.

### Phase 2: Automatic Proxy Bidding
- **Rule:** A buyer sets a maximum ceiling. The system automatically counter-bids on their behalf only as much as needed to maintain the lead (`min(theirMax, currentPrice + increment)`).
- **Resolution:** If two auto-bids compete, the higher ceiling wins at `loserMax + increment`. Earlier timestamp breaks ties.
- **Public Ceilings:** Auto-bid ceilings are completely transparent and listed publicly in the active auto-bidders panel.
- **Endpoints:**
  - `PUT /api/auctions/:id/auto-bid` — Register or raise maximum (lowering rejected).
  - `GET /api/auctions/:id/auto-bids` — Public list of auto-bidders and limits.
  - `DELETE /api/auctions/:id/auto-bid` — Cancel auto-bid (blocked if user is currently leading).

### Phase 3: Saved Wants ("Search Alerts")
- **Rule:** Standing search alerts for keywords, categories, and max price limits (max 10 active alerts per student).
- **Matching:** Conjunctive case-insensitive keyword match across `title + description`.
- **De-duplication:** Exactly one notification per `(watch, item)` pair stored persistently in DB.
- **Endpoints:**
  - `POST /api/watches` — Create standing want alert.
  - `GET /api/watches` — List user's active wants with unread match count.
  - `PUT /api/watches/:id` — Update or toggle alert status.
  - `DELETE /api/watches/:id` — Delete want alert.

### Phase 4: Community Questions & Answers (Q&A)
- **Rule:** Public inquiries on listings with duplicate detection (Token Jaccard similarity >= 0.7).
- **Moderation:** 3 flags auto-hide questions. Sellers can reply, hide, or restore visibility. Answered questions are pinned on top.
- **Endpoints:**
  - `GET /api/auctions/:id/questions` — Public Q&A feed.
  - `POST /api/auctions/:id/questions` — Ask question (10–300 chars, max 3/user/item).
  - `POST /api/auctions/:id/questions/check-duplicate` — Live duplicate check while typing.
  - `POST /api/auctions/:id/questions/:qId/answer` — Seller-only answer.
  - `POST /api/auctions/:id/questions/:qId/flag` — Community moderation flag.
  - `PATCH /api/auctions/:id/questions/:qId/status` — Seller hide/restore toggle.

### Phase 5: AI Assistant Tab
- **Rule:** Natural language shopping assistant proxying Claude with strict safety guardrails.
- **Zero Auto-Bidding:** Assistant tools can only `search_auctions`, `get_auction`, and `propose_bid`. Proposing creates a `PendingAction` and renders a confirmation card; **money is never committed until the student clicks Confirm**.
- **Privacy:** Never discloses email, phone, or password. Untrusted item content wrapped in `<untrusted_item_content>` delimiters.
- **Endpoints:**
  - `POST /api/assistant/chat` `{ message }` — Rate-limited chat endpoint (20 msgs/10 min).
  - `GET /api/assistant/history` — Conversation history and active pending action.
  - `POST /api/assistant/actions/:id/confirm` — Re-validates auction & limit, commits Phase 2 AutoBid.
  - `POST /api/assistant/actions/:id/cancel` — Cancels proposed bid.

---

## 5. Project Directory Structure

```text
mini_eBuy/
├── frontend/
│   ├── public/
│   │   ├── placeholder.svg       # Local vector fallback for images
│   │   └── vite.svg
│   ├── src/
│   │   ├── api/
│   │   │   ├── axios.js          # Configured Axios instance with interceptors
│   │   │   ├── auctionApi.js     # Categories, stats, listings, bids, edit, and Q&A
│   │   │   ├── authApi.js        # Register, login, and profile
│   │   │   ├── userApi.js        # My listings, my bids, and sales metrics
│   │   │   ├── watchApi.js       # Phase 3 Saved Wants APIs
│   │   │   ├── assistantApi.js   # Phase 5 AI Assistant APIs
│   │   │   └── notificationApi.js
│   │   ├── components/
│   │   │   ├── Navbar.jsx        # Navigation, unread badges, and user profile
│   │   │   ├── Footer.jsx        # Dynamic database categories and platform links
│   │   │   ├── AuctionCard.jsx   # Live pricing in ₹, bids, and countdown
│   │   │   ├── CountdownTimer.jsx# Server-synchronized countdown with extension badge
│   │   │   ├── BidHistory.jsx    # Public transparent bid log
│   │   │   ├── SearchFilters.jsx # Live database filters (category, condition, price)
│   │   │   ├── NotificationBell.jsx # Unread notification dropdown
│   │   │   ├── ProtectedRoute.jsx# Auth route guard
│   │   │   ├── StatusBadge.jsx   # Color-coded auction status indicator
│   │   │   ├── AuctionQA.jsx     # Phase 4 Community Q&A with duplicate check
│   │   │   └── EditListingModal.jsx # Active listing edit modal with rule-based locking
│   │   ├── context/
│   │   │   ├── AuthContext.jsx   # Global user state, login, and logout
│   │   │   └── SocketContext.jsx # Real-time Socket.IO subscriptions and notifications
│   │   ├── hooks/
│   │   │   └── useCountdown.js
│   │   ├── pages/
│   │   │   ├── Home.jsx          # Live 4-stat metrics bar, user snapshot, and browse grid
│   │   │   ├── Login.jsx         # Clean role-free login
│   │   │   ├── Register.jsx      # Clean role-free registration
│   │   │   ├── AuctionDetails.jsx# Bidding, proxy bidding, Q&A, and seller control panel
│   │   │   ├── CreateListing.jsx # Multipart auction creation with photo upload
│   │   │   ├── MyListings.jsx    # Seller action center with Edit, Approve, and Handover
│   │   │   ├── MyBids.jsx        # Winning vs Outbid student dashboard
│   │   │   ├── MyWants.jsx       # Phase 3 Saved Wants management
│   │   │   ├── Assistant.jsx     # Phase 5 AI Assistant chat & confirmation
│   │   │   ├── Notifications.jsx # Complete notifications list
│   │   │   ├── SellerDashboard.jsx # Sales volume & pending approval lists
│   │   │   └── NotFound.jsx
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── .env
├── backend/
│   ├── config/
│   │   └── db.js                 # Mongoose connection to local MongoDB
│   ├── controllers/
│   │   ├── authController.js     # Unified registration & login
│   │   ├── auctionController.js  # Listing CRUD, atomic bidding, proxy bidding, and edit
│   │   ├── qaController.js       # Phase 4 Community Q&A & duplicate check
│   │   ├── userController.js     # Seller & bidder personal dashboards
│   │   ├── watchController.js    # Phase 3 Saved Wants management
│   │   ├── assistantController.js# Phase 5 AI Assistant proxy & confirmation
│   │   └── notificationController.js
│   ├── middleware/
│   │   ├── auth.js               # JWT verification & optional auth
│   │   └── upload.js             # Multer photo upload configuration
│   ├── models/
│   │   ├── User.js               # Bcrypt password hashing & user profile
│   │   ├── Item.js               # Listings with paise pricing, extension count & statuses
│   │   ├── Bid.js                # Public bid records with paise amounts & extension flags
│   │   ├── AutoBid.js            # Phase 2 proxy maximum ceilings
│   │   ├── Watch.js              # Phase 3 saved wants search alerts
│   │   ├── Question.js           # Phase 4 Q&A items, answers, and flags
│   │   ├── PendingAction.js      # Phase 5 human-in-the-loop AI bid proposals
│   │   └── Notification.js       # In-app notifications
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── auctionRoutes.js
│   │   ├── userRoutes.js
│   │   ├── watchRoutes.js
│   │   ├── assistantRoutes.js
│   │   └── notificationRoutes.js
│   ├── services/
│   │   ├── auctionService.js     # 10s node-cron auto-expiration sweeper
│   │   ├── proxyBidService.js    # Phase 2 proxy bidding resolution engine
│   │   ├── watchService.js       # Phase 3 saved wants matching evaluator
│   │   └── assistantService.js   # Phase 5 Anthropic Claude tool orchestration
│   ├── sockets/
│   │   └── socketManager.js      # Real-time room management & broadcasting
│   ├── uploads/                  # Uploaded listing photos
│   ├── utils/
│   │   └── money.js              # Integer paise <-> INR exact currency conversions
│   ├── scripts/
│   │   ├── seed.js               # Database seeder (seed users, 13 listings, bids)
│   │   └── verify-all.js         # Automated 10-step full verification suite
│   ├── test/                     # Automated unit test suites (Phases 1–5 & core rules)
│   ├── server.js
│   ├── package.json
│   └── .env
├── package.json
└── README.md
```

---

## 6. Setup & Execution Instructions (Windows)

### Prerequisites
1. **Node.js** (v18 or higher) installed. Verify with `node -v`.
2. **MongoDB** installed locally on your Windows machine (`mongod.exe`).

---

### Step 1: Start Local MongoDB
If your MongoDB Windows service is running, it listens on port `27017` automatically.

If running standalone without service permissions:
```powershell
& "C:\Program Files\MongoDB\Server\8.2\bin\mongod.exe" --dbpath ".\backend\data\db" --bind_ip 127.0.0.1 --port 27017
```

---

### Step 2: Configure Environment Variables

**Backend (`backend/.env`):**
```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/campus_auction
JWT_SECRET=campus_auction_jwt_secret_dev_key_2026
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5174
ALLOWED_EMAIL_DOMAIN=
MAX_FILE_SIZE_MB=5
```

**Frontend (`frontend/.env`):**
```env
VITE_API_URL=
VITE_SOCKET_URL=http://localhost:5000
```

---

### Step 3: Seed the Database
Populates standard college users, demo listings across all statuses, bids, and watch alerts:
```powershell
cd backend
npm run seed
```

---

### Step 4: Run the Backend Server (Port 5000)
```powershell
cd backend
npm start
```
You will see:
```text
=========================================
 Campus Auction Backend Server Running   
 Port: 5000                           
 Host: 0.0.0.0                           
 Local URL: http://localhost:5000      
 Client URL: http://localhost:5174 
=========================================
[MongoDB] Connected to database: campus_auction @ 127.0.0.1:27017
[Auction Service] Performing startup expired auctions check...
[Auction Service] Cron job registered: checking expired auctions every 10 seconds.
```

---

### Step 5: Run the Frontend Server (Port 5174 / 5173)
In a second PowerShell terminal:
```powershell
cd frontend
npm run dev
```
Open your browser to:
👉 **`http://localhost:5174`** (or the URL displayed by Vite).

---

## 7. Comprehensive API Reference

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| **Authentication** | | | |
| `POST` | `/api/auth/register` | Register new student account (`name`, `email`, `password`) | Public |
| `POST` | `/api/auth/login` | Authenticate student and issue JWT token | Public |
| `POST` | `/api/auth/logout` | Clear auth token cookie | Public |
| `GET` | `/api/auth/me` | Fetch authenticated student profile | Private |
| **Auctions & Bidding** | | | |
| `GET` | `/api/auctions/categories` | Dynamic categories and active counts | Public |
| `GET` | `/api/auctions/stats` | Live platform metrics (bids, active items, sales, users) | Public |
| `GET` | `/api/auctions` | Filter, search, and paginate auctions | Public |
| `GET` | `/api/auctions/:id` | Auction details with seller and winner population | Public |
| `GET` | `/api/auctions/:id/bids` | Public transparent bid history | Public |
| `POST` | `/api/auctions` | Create new listing with photo uploads | Private |
| `PATCH` | `/api/auctions/:id` | **Edit active listing** (rule-locked if bids exist) | Private (Seller) |
| `POST` | `/api/auctions/:id/cancel` | Cancel an active listing | Private (Seller) |
| `POST` | `/api/auctions/:id/bids` | Place atomic manual bid | Private (Non-Seller) |
| `POST` | `/api/auctions/:id/approve`| Approve winning bid (Status → Reserved) | Private (Seller) |
| `POST` | `/api/auctions/:id/reject` | Reject winning bid (Status → Rejected / Reverted) | Private (Seller) |
| `POST` | `/api/auctions/:id/confirm-handover` | Complete in-person sale (Status → Sold) | Private (Seller) |
| `POST` | `/api/auctions/:id/failed-pickup` | Record failed campus pickup outcome | Private (Seller) |
| **Proxy Bidding (Phase 2)** | | | |
| `PUT` | `/api/auctions/:id/auto-bid` | Set or raise proxy maximum ceiling | Private (Non-Seller) |
| `GET` | `/api/auctions/:id/auto-bids`| Public list of active proxy bidders & ceilings | Public |
| `DELETE` | `/api/auctions/:id/auto-bid`| Cancel proxy auto-bid | Private |
| **Saved Wants (Phase 3)** | | | |
| `POST` | `/api/watches` | Create search alert watch | Private |
| `GET` | `/api/watches` | List user's active search alerts | Private |
| `PUT` | `/api/watches/:id` | Update search alert watch | Private |
| `DELETE` | `/api/watches/:id` | Remove search alert watch | Private |
| **Community Q&A (Phase 4)** | | | |
| `GET` | `/api/auctions/:id/questions`| List public Q&A inquiries (answered pinned on top) | Public |
| `POST` | `/api/auctions/:id/questions`| Ask question on listing | Private |
| `POST` | `/api/auctions/:id/questions/check-duplicate`| Real-time duplicate similarity check | Private |
| `POST` | `/api/auctions/:id/questions/:qId/answer`| Answer inquiry | Private (Seller) |
| `POST` | `/api/auctions/:id/questions/:qId/flag`| Flag inappropriate question | Private |
| `PATCH`| `/api/auctions/:id/questions/:qId/status`| Hide or restore question visibility | Private (Seller) |
| **AI Shopping Assistant (Phase 5)** | | | |
| `POST` | `/api/assistant/chat` | Send conversational query to assistant | Private |
| `GET` | `/api/assistant/history` | Retrieve assistant dialogue and pending action | Private |
| `POST` | `/api/assistant/actions/:id/confirm` | Confirm proposed bid ceiling | Private |
| `POST` | `/api/assistant/actions/:id/cancel` | Reject proposed bid ceiling | Private |

---

## 8. Complete Verification & Testing

### 1. Automated Full Verification Suite (`scripts/verify-all.js`)
Run the comprehensive 10-step end-to-end verification script against the live database:
```powershell
node backend/scripts/verify-all.js
```

**Expected Output:**
```text
====================================================
  CAMPUS AUCTION FULL END-TO-END VERIFICATION SUITE  
====================================================

[1/10] MongoDB Connection: OK
[2/10] Seed Users & Bcrypt Password Hashing: PASS
[3/10] Sample Auction Listings Count: PASS (13 auctions found across statuses)
[4/10] Phase 1: Verifying Last-Minute Extensions...
       - Last-minute bid extension (+60s) & extensionCount increment: PASS
[5/10] Phase 2: Verifying Automatic Proxy Bidding Engine...
       - Proxy vs Proxy resolution (higher max wins at loserMax + inc): PASS
[6/10] Phase 3: Verifying Saved Wants Matching & De-duplication...
       - Saved wants conjunctive matching & deduplication: PASS
[7/10] Phase 4: Verifying Q&A Section & Duplicate Detection...
       - Q&A posting, duplicate detection (Jaccard >= 0.7), & seller answer: PASS
[8/10] Phase 5: Verifying AI Assistant Safety & PendingAction Validation...
       - AI Assistant public-only data, non-bidding propose_bid, & confirmation: PASS
[9/10] Testing Seller Workflow (Pending Approval -> Reserved -> Sold)...
       - Seller Approved: Status -> Reserved (Campus Handover arranged): PASS
       - Seller Confirmed Handover: Status -> Sold: PASS
[10/10] Testing Dynamic Categories & Platform Stats Calculation...
        - Dynamic Categories in DB: PASS (6 distinct categories found)
        - Live Platform Metrics: PASS (4 active, 5 sold, 8 registered users)

====================================================
  ALL 10 VERIFICATION CHECKS COMPLETED SUCCESSFULLY! 
====================================================
```

### 2. Unit Test Suites (60 Automated Tests)
Run all Node.js test runner suites:
```powershell
cd backend
node --test --test-concurrency=1 test/*.test.js
```
**Test Results:** `60 tests passed, 0 failed, 3 suites passed`.

### 3. Frontend Production Build
Verify zero syntax, JSX, or bundling errors:
```powershell
cd frontend
npx vite build
```
**Build Result:** `✓ 1659 modules transformed. Built in ~6.5s`.

---

## 9. Troubleshooting & FAQ

### 1. MongoDB Connection Refused (`connect ECONNREFUSED 127.0.0.1:27017`)
- **Cause:** Local MongoDB instance is not currently running.
- **Solution:** Start `mongod.exe` manually:
  ```powershell
  & "C:\Program Files\MongoDB\Server\8.2\bin\mongod.exe" --dbpath ".\backend\data\db" --bind_ip 127.0.0.1 --port 27017
  ```

### 2. Port Already in Use (`EADDRINUSE: port 5000` or `5174`)
- **Find process using port 5000:**
  ```powershell
  Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue | Select-Object OwningProcess
  ```
- **Terminate process:**
  ```powershell
  Stop-Process -Id <PID> -Force
  ```

### 3. Why Can't I Edit Pricing on My Active Listing?
- In accordance with college auction fairness rules, once bids have been placed (`bidCount > 0`), the starting price, minimum increment, and closing countdown are locked to protect the integrity of existing bids. You can still edit the title, description, category, condition, and photos.

### 4. Photo Upload Rejections
- Allowed file types: `.jpg`, `.jpeg`, `.png`, `.webp`, and `.gif`.
- Maximum file size: 5MB per photo (up to 5 photos per listing).
