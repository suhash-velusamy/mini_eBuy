# Campus Auction — Full-Stack College Marketplace & Timed Auction Web App

> A complete, production-grade, 100% dynamic mini eBay platform designed specifically for college campuses. Graduating seniors can list used items (bicycles, calculators, textbooks, lab equipment, laptops, and hostel gear) through timed auctions. Junior students can browse listings, place bids, receive real-time outbid alerts via Socket.IO, and win items fairly with safe on-campus in-person handovers.
>
> **100% Fully Dynamic:** All static and dummy arrays have been removed. Every listing, category, public bid history, user profile, notification, and platform metric is fetched and aggregated live from the local MongoDB database.

---

## 1. Project Overview & Architecture

Campus Auction solves the common college problem of passing down valuable academic and hostel supplies from departing seniors to incoming juniors. 

### Key Highlights:
- **Zero Hardcoded Data:** All categories, counts, listings, bid histories, and platform statistics are dynamically served via backend REST APIs and persisted in MongoDB.
- **Server-Authoritative Timers:** Real-time countdowns rendered on the frontend with server-enforced auction expiration.
- **Atomic Concurrency Protection:** MongoDB atomic conditional updates (`findOneAndUpdate`) prevent race conditions and ensure two simultaneous bids cannot win at the same outdated price.
- **Real-Time Bidding & Alerts:** Instant Socket.IO event broadcasting for new leading bids, outbid notifications, and status transitions without requiring page refreshes.
- **Automated Expiration Scheduler:** `node-cron` checks for expired auctions every 10 seconds and upon server boot to guarantee zero active orphaned auctions.
- **Strict Seller Workflow:** `Active → Pending Approval → Reserved → Sold`, along with explicit audit trails for `Unsold`, `Cancelled`, `Rejected`, and `Failed Pickup`.
- **Exact Money Accounting:** Currency amounts stored internally as integer paise (1 INR = 100 paise) to prevent JavaScript floating-point arithmetic errors.

---

## 2. Technology Stack

### Frontend
- **Framework:** React 18 with Vite
- **Styling:** Tailwind CSS (modern college aesthetic, responsive layout)
- **Routing:** React Router DOM v6
- **API Client:** Axios with credentials (`withCredentials: true`), environment-based `VITE_API_URL`, and auth interceptors
- **Real-Time Client:** Socket.IO Client v4 using `VITE_SOCKET_URL`
- **State Management:** React Context API (`AuthContext` & `SocketContext`)
- **Icons:** Lucide React

### Backend
- **Runtime:** Node.js (v20+ / v22+)
- **Server Framework:** Express.js
- **Database:** Local MongoDB (`mongodb://127.0.0.1:27017/campus_auction`)
- **ODM:** Mongoose v8
- **Real-Time Server:** Socket.IO v4 (authenticated rooms & public auction channels)
- **Authentication:** JWT (JSON Web Tokens) with HTTP-only cookies and Bearer headers
- **Password Security:** bcryptjs (10 salt rounds)
- **File Uploads:** Multer with file type validation (JPEG/PNG/WEBP) and file-size limits
- **Scheduler:** `node-cron` (runs every 10 seconds)
- **AI Engine:** Anthropic Claude Messages API (backend proxy with strict tool boundaries)
- **CORS & Rate Limiting:** `cors` configured for `http://localhost:5173`, plus `express-rate-limit` for auth, bidding, Q&A, and AI assistant abuse prevention

---

## 3. Environment Variables

### Backend (`backend/.env`)
| Variable | Default | Purpose |
|---|---|---|
| `PORT` | 5000 | Backend Express API Port |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/campus_auction` | Local MongoDB Connection URI |
| `JWT_SECRET` | `campus_auction_jwt_secret_dev_key_2026` | Secret key for signing JSON Web Tokens |
| `JWT_EXPIRES_IN` | `7d` | Token expiration duration |
| `CLIENT_URL` | `http://localhost:5174` | Allowed CORS and Socket.IO Origin |
| `ANTHROPIC_API_KEY` | *(optional in dev/test)* | Anthropic API key for AI shopping assistant |
| `ANTHROPIC_MODEL` | `claude-3-5-sonnet-20241022` | Claude model name for assistant proxy |
| `MAX_FILE_SIZE_MB` | `5` | Maximum upload size per photo |

### Frontend (`frontend/.env`)
| Variable | Default | Purpose |
|---|---|---|
| `VITE_API_URL` | `http://localhost:5000` | Backend API Base URL |
| `VITE_SOCKET_URL` | `http://localhost:5000` | Backend Socket.IO Server URL |

---

## 4. Advanced Feature Architecture & API Endpoints

### Phase 1: Last-Minute Bid Extensions
- **Rule:** If a valid bid is placed when `(closesAt - now) <= 30 seconds`, `closesAt` is automatically extended to `bidTime + 60 seconds`.
- **Atomic Concurrency:** Extension is computed and applied within the same atomic `findOneAndUpdate` that records the leading bid.
- **Socket Event:** `auctionExtended` `{ itemId, closesAt, extensionCount }`.
- **UI:** Countdown timer resyncs and flashes an animated "Extended +60s" badge.

### Phase 2: Automatic Bidding (Proxy Bidding)
- **Rule:** Buyers set a ceiling maximum. The system automatically counter-bids on their behalf up to their maximum, never higher.
- **Public Transparency:** Maximum ceilings are public. Displayed in the "Active Auto-Bidders" panel with display names and limits.
- **Endpoints:**
  - `PUT /api/auctions/:id/auto-bid` `{ maxAmount }` — Register or raise maximum (lowering rejected).
  - `GET /api/auctions/:id/auto-bids` — Public list of proxy bidders and amounts.
  - `DELETE /api/auctions/:id/auto-bid` — Cancel auto-bid (blocked if user is currently leading).
- **Socket Events:** `newBid` (for each generated step) and `autoBidUpdated` (refreshes public panel).

### Phase 3: Saved Wants ("Never Miss What You Need")
- **Rule:** Standing search alerts for keywords, categories, and max price limits (max 10 active alerts per student).
- **Matching:** Conjunctive case-insensitive keyword match across `title + description`.
- **De-duplication:** Exactly one notification per `(watch, item)` pair stored persistently in DB.
- **Endpoints:**
  - `POST /api/watches` — Create standing want alert.
  - `GET /api/watches` — List user's active wants with unread match count.
  - `PUT /api/watches/:id` — Update or toggle alert status.
  - `DELETE /api/watches/:id` — Delete want alert.
- **Socket Events:** `watch:match` and `notification:new`.

### Phase 4: Community Questions & Answers (Q&A)
- **Rule:** Public inquiries on listings with duplicate detection (Token Jaccard similarity >= 0.7).
- **Moderation:** 3 flags auto-hide questions. Sellers can reply, hide, or restore visibility.
- **Endpoints:**
  - `GET /api/auctions/:id/questions` — Public Q&A feed (answered questions pinned on top).
  - `POST /api/auctions/:id/questions` — Ask question (10–300 chars, max 3/user/item).
  - `POST /api/auctions/:id/questions/check-duplicate` — Live duplicate check while typing.
  - `POST /api/auctions/:id/questions/:qId/answer` — Seller-only answer.
  - `POST /api/auctions/:id/questions/:qId/flag` — Community moderation flag.
  - `PATCH /api/auctions/:id/questions/:qId/status` — Seller hide/restore toggle.
- **Socket Event:** `qaUpdated`.

### Phase 5: AI Assistant Tab
- **Rule:** Natural language shopping assistant proxying Claude with hard safety guardrails.
- **Zero Auto-Bidding:** Assistant tools can only `search_auctions`, `get_auction`, and `propose_bid`. Proposing creates a `PendingAction` and renders a confirmation card; **money is never committed until the student clicks Confirm**.
- **Privacy:** Never discloses email, phone, or password. Untrusted item content wrapped in `<untrusted_item_content>` delimiters.
- **Endpoints:**
  - `POST /api/assistant/chat` `{ message }` — Rate-limited chat endpoint (20 msgs/10 min).
  - `GET /api/assistant/history` — Conversation history and active pending action.
  - `POST /api/assistant/actions/:id/confirm` — Re-validates auction & limit, commits Phase 2 AutoBid.
  - `POST /api/assistant/actions/:id/cancel` — Cancels proposed bid.

---

## 5. 5-Minute End-to-End Demo Script

Follow these steps to demonstrate all five new capabilities in ~5 minutes:

### Step 1: Demo Saved Wants & Live Alert (Phase 3)
1. Sign in as **Alice Bidder** (`bidder1@campus.edu`).
2. Go to **Saved Wants** in the navigation bar. You will see an active alert for `scientific, calculator` under ₹1,000.
3. In a second browser window, sign in as **John Seller** (`seller@campus.edu`) and click **Create Listing**.
4. List a "Casio Scientific Calculator fx-991EX" for starting price ₹450.
5. Watch Alice's window: an instant in-app notification appears, and the unread match badge increments!

### Step 2: Demo Community Q&A & Duplicate Detection (Phase 4)
1. In Alice's window, open the newly created calculator listing.
2. Scroll to the **Community Questions & Answers (Q&A)** section.
3. In the question box, type: `"Does this cycle include the original wire lock?"` (on the cycle listing) or ask about battery condition.
4. If a peer previously asked an identical or similar question, notice the **Live Duplicate Warning** preview: *"Someone already asked this question!"*
5. Switch to John Seller's window: John sees the unanswered question badge and clicks **Reply to Asker**. The answer publishes instantly with a green verified badge.

### Step 3: Demo Automatic Proxy Bidding & Public Ceilings (Phase 2)
1. Open the **Casio FX-991EX Calculator** listing.
2. As Alice, enter a ceiling of ₹1,100 in the **Automatic Bidding (Proxy)** box and click **Set Auto-Bid**.
3. As Bob Bidder (`bidder2@campus.edu`), set a proxy max of ₹1,350.
4. Watch the server resolve the bids in real-time: Bob takes the lead at ₹1,150 (Alice's max + minimum increment).
5. Notice the **Active Auto-Bidders** public panel below the bidding box displaying both Alice and Bob's names and ceilings with the disclaimer: *"Maximums are public on this platform."*

### Step 4: Demo Last-Minute Extension (Phase 1)
1. Open the **Hero Sprint Pro Mountain Bicycle** listing (seeded to close in ~2 minutes).
2. Wait until the countdown timer drops below **00:00:30** (30 seconds remaining).
3. Place a valid bid as Bob.
4. Notice the countdown instantly pushes forward by **+60 seconds** and flashes the amber **"⏱️ Last-minute bid! Auction extended by +60 seconds"** badge.

### Step 5: Demo AI Assistant & Human Confirmation Guardrail (Phase 5)
1. Click the **AI Assistant** tab in the navigation bar.
2. Ask: *"Find me a cycle under ₹5000 and bid up to ₹4500"*.
3. The assistant searches active campus listings, presents the matching Hero Sprint Pro, and proposes a bid ceiling.
4. Notice the **Proposed Bid Confirmation Card**: no bid is placed until you click the green **Confirm Bid (₹4,500)** button.
5. Click **Confirm Bid**: the proposal is validated server-side, the Phase 2 AutoBid is activated, and proxy bidding immediately defends your lead!

---

## 3. Project Structure

```text
mini_eBuy/
├── frontend/
│   ├── public/
│   │   └── placeholder.svg       # Local SVG placeholder for images
│   ├── src/
│   │   ├── api/
│   │   │   ├── axios.js          # Configured Axios with VITE_API_URL
│   │   │   ├── auctionApi.js     # Includes getCategories & getStats
│   │   │   ├── authApi.js        # Includes getDemoAccounts
│   │   │   ├── userApi.js
│   │   │   └── notificationApi.js
│   │   ├── components/
│   │   │   ├── Navbar.jsx
│   │   │   ├── Footer.jsx        # Dynamic categories from MongoDB
│   │   │   ├── AuctionCard.jsx   # Live pricing in ₹ & countdown
│   │   │   ├── CountdownTimer.jsx# Live countdown
│   │   │   ├── BidHistory.jsx    # Public bid history from Bids collection
│   │   │   ├── SearchFilters.jsx # Dynamic category filter from DB
│   │   │   ├── NotificationBell.jsx # Unread notification badge
│   │   │   ├── ProtectedRoute.jsx
│   │   │   └── StatusBadge.jsx
│   │   ├── context/
│   │   │   ├── AuthContext.jsx
│   │   │   └── SocketContext.jsx # Live socket alerts
│   │   ├── hooks/
│   │   │   └── useCountdown.js
│   │   ├── pages/
│   │   │   ├── Home.jsx          # Dynamic hero stats & dynamic categories
│   │   │   ├── Login.jsx         # Dynamic DB account selector
│   │   │   ├── Register.jsx
│   │   │   ├── AuctionDetails.jsx# Dynamic increment buttons & real-time bid updates
│   │   │   ├── CreateListing.jsx # Dynamic categories dropdown
│   │   │   ├── MyListings.jsx    # Seller action center
│   │   │   ├── MyBids.jsx        # Real-time winning vs outbid tracker
│   │   │   ├── Notifications.jsx
│   │   │   ├── SellerDashboard.jsx # Live sales volume & pending approval lists
│   │   │   └── NotFound.jsx
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── .env                      # VITE_API_URL & VITE_SOCKET_URL
│   ├── .env.example
│   └── index.html
├── backend/
│   ├── config/
│   │   └── db.js                 # Mongoose connection to local MongoDB
│   ├── controllers/
│   │   ├── authController.js     # Auth & dynamic demo-accounts endpoint
│   │   ├── auctionController.js  # Dynamic categories, stats, and atomic bids
│   │   ├── userController.js     # Real-time seller & bidder dashboards
│   │   └── notificationController.js
│   ├── middleware/
│   │   ├── auth.js
│   │   └── upload.js
│   ├── models/
│   │   ├── User.js
│   │   ├── Item.js               # Dynamic category support & paise arithmetic
│   │   ├── Bid.js
│   │   └── Notification.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── auctionRoutes.js
│   │   ├── userRoutes.js
│   │   └── notificationRoutes.js
│   ├── services/
│   │   └── auctionService.js     # 10s node-cron auto-expiration sweeper
│   ├── sockets/
│   │   └── socketManager.js      # Socket.IO rooms & real-time broadcast
│   ├── uploads/                  # Uploaded photos & sample SVGs
│   ├── utils/
│   │   └── money.js              # Integer paise <-> INR exact currency conversion
│   ├── scripts/
│   │   ├── seed.js               # Database seeder (10 listings, 4 users, bids)
│   │   └── verify-all.js         # Automated 8-step test verification suite
│   ├── server.js
│   ├── package.json
│   ├── .env.example
│   └── .env
├── package.json
├── .gitignore
└── README.md
```

---

## 4. Setup & Execution Instructions (Windows)

### Prerequisites
1. **Node.js** (v18 or higher) installed. Verify:
   ```powershell
   node -v
   npm -v
   ```
2. **MongoDB** installed locally on your Windows machine (`mongod.exe`).

---

### Step 1: Start the Local MongoDB Server
If your MongoDB Windows service is running, it listens on port 27017 automatically. 

If running standalone without service permissions, start `mongod.exe` pointing to the project data directory:
```powershell
# In PowerShell:
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
CLIENT_URL=http://localhost:5173
ALLOWED_EMAIL_DOMAIN=
MAX_FILE_SIZE_MB=5
```

**Frontend (`frontend/.env`):**
```env
VITE_API_URL=
VITE_SOCKET_URL=http://localhost:5000
```
*(Leave `VITE_API_URL` blank when using the Vite reverse proxy, or set to `http://localhost:5000` for direct requests).*

---

### Step 3: Seed the Database with Demo Data
Run the seeding script to populate users, active listings, expired auctions, bids, and notifications:
```powershell
# From the project root:
npm run seed
```
*(Or inside `backend/`: `node scripts/seed.js`)*

---

### Step 4: Run the Backend Server (Port 5000)
Open a terminal and run:
```powershell
cd backend
npm start
```
You will see:
```text
=========================================
 Campus Auction Backend Server Running   
 Port: 5000                           
 Local URL: http://localhost:5000      
 Client URL: http://localhost:5173 
=========================================
[MongoDB] Connected to database: campus_auction @ 127.0.0.1:27017
[Auction Service] Performing startup expired auctions check...
[Auction Service] Cron job registered: checking expired auctions every 10 seconds.
```

---

### Step 5: Run the Frontend Server (Port 5173)
Open a second terminal window and run:
```powershell
cd frontend
npm run dev
```
Open your browser to:
👉 **`http://localhost:5173`**

---

## 5. Dynamic API Endpoints

| Method | Endpoint | Description | Dynamic Source |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/auctions/categories` | Returns dynamic categories and active counts | Aggregated from `Item` collection in MongoDB |
| `GET` | `/api/auctions/stats` | Live platform metrics (active items, bids, sales volume) | Calculated live from MongoDB |
| `GET` | `/api/auth/demo-accounts` | Registered student accounts for fast login | Fetched directly from `User` collection |
| `GET` | `/api/auctions` | Filtered, searched, sorted & paginated listings | Queries `Item` collection |
| `POST` | `/api/auctions/:id/bids` | Concurrency-safe atomic bid placement | Atomic update on `Item` + creates `Bid` |
| `GET` | `/api/users/me/listings` | Seller dashboard with live sales metrics | Aggregated from `Item` collection |
| `GET` | `/api/users/me/bids` | Student bidder dashboard (Winning vs Outbid) | Queries `Bid` and `Item` collections |
| `GET` | `/api/notifications` | User notifications and unread counts | Queries `Notification` collection |

---

## 6. Role-Based Authentication & Demo Accounts

Campus Auction provides full **Role-Based Authentication** across registration, login, and in-app navigation:

### Supported Campus Roles:
- 🎓 **Bidder / Buyer (Junior / Student):** Explores active listings, places live bids with server-authoritative countdowns, tracks outbid alerts in real time.
- 💼 **Senior Seller (Graduating Senior):** Creates timed auction listings, sets reserve price & minimum increments, reviews winning bids, and completes campus handovers.
- 🛡️ **Campus Admin (Coordinator):** Administrative oversight across campus listings, accounts, and disputes.

### Pre-Configured Accounts in MongoDB:

| Student Name | Email | Password | Role / Purpose |
| :--- | :--- | :--- | :--- |
| **John Seller** (Senior CSE) | `seller@campus.edu` | `Password123!` | Senior Seller: creates listings, approves winning bids, confirms handovers |
| **Alice Bidder** (Sophomore ECE) | `bidder1@campus.edu` | `Password123!` | Student Bidder: places initial leading bids |
| **Bob Bidder** (Junior Mech) | `bidder2@campus.edu` | `Password123!` | Competitive Bidder: outbids Alice in real-time |
| **Charlie Bidder** (Freshman IT) | `bidder3@campus.edu` | `Password123!` | General student buyer |
| **Campus Admin** (Coordinator) | `admin@campus.edu` | `Password123!` | Campus Administrator |

> 💡 **Dynamic Role-Based Login:** On the `/login` page, you can toggle between **Bidder**, **Seller**, and **Admin** login perspectives or click any of the 1-click database demo account pills (each color-coded with its role badge).
> 
> 🔄 **1-Click Role Switcher:** When logged in, click your user pill in the top navbar to instantly toggle between **Seller Mode** and **Bidder Mode** on the fly!

---

## 7. Required Demonstration Walkthrough

Follow this step-by-step checklist to test all required capabilities:

1. **Seller Creates an Auction:**
   - Log in as `seller@campus.edu`.
   - Click **Create Listing** in the top navbar.
   - The Category dropdown is populated dynamically from the database.
   - Fill in title, condition, starting price (e.g. ₹850), increment (₹50), and set closing time.
   - Upload an item photo and click **Publish Auction Listing**.
2. **Student Places a Valid Bid:**
   - In an Incognito window, log in as `bidder1@campus.edu`.
   - Browse to the new listing.
   - Place a bid of `₹850`. The bid is committed to the database and appears in public bid history.
3. **Invalid Bid Below Increment Rejected:**
   - Attempt to bid `₹870` (minimum valid is ₹900).
   - The backend validates the amount and rejects it with an explicit message:
     `Your bid of ₹870 is too low. The minimum valid bid is ₹900.`
4. **Second Student Outbids First (Real-Time Socket Alert):**
   - In another browser window, log in as `bidder2@campus.edu` and submit `₹950`.
   - Bidder 1's window immediately updates:
     - Outbid toast alert appears.
     - Status switches to **Outbid**.
     - Leading price updates to ₹950 without page reload.
5. **Automatic Expiration & Cron Closing:**
   - Wait for an active auction (*Hero Sprint Pro Bicycle*) to reach `00:00:00`.
   - Within 10 seconds, `node-cron` transitions status to `Pending Approval`.
   - Socket broadcasts the event; bidding controls disable.
6. **Seller Approves Winning Bid:**
   - Log in as `seller@campus.edu` and open the closed listing.
   - Click **✓ Approve Winning Bid**. Status becomes **Reserved** for campus handover.
7. **Confirm Handover:**
   - After the in-person meeting on campus, the seller clicks **Confirm Campus Handover Completed**.
   - Status updates to **Sold**, recording `soldAt` and sales volume in the database.

---

## 8. Automated Verification Test Suite

Run the built-in automated test suite to verify all backend systems in one command:
```powershell
node backend/scripts/verify-all.js
```

### Verified Test Results:
```text
====================================================
  CAMPUS AUCTION FULL END-TO-END VERIFICATION SUITE  
====================================================

[1/10] MongoDB Connection: OK
[2/10] Seed Users & Bcrypt Password Hashing: PASS
[3/10] Sample Auction Listings Count: PASS (10 auctions found across statuses)
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
        - Live Platform Metrics: PASS (5 active, 2 sold, 5 registered users)

====================================================
  ALL 10 VERIFICATION CHECKS COMPLETED SUCCESSFULLY! 
====================================================
```

---

## 9. Troubleshooting Guide

### 1. MongoDB Connection Refused (`connect ECONNREFUSED 127.0.0.1:27017`)
- **Cause:** Local MongoDB service is not started.
- **Solution:** Start MongoDB manually:
  ```powershell
  & "C:\Program Files\MongoDB\Server\8.2\bin\mongod.exe" --dbpath ".\backend\data\db" --bind_ip 127.0.0.1 --port 27017
  ```

### 2. Port Already in Use (5000 or 5173)
- **Check process on port 5000:**
  ```powershell
  Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue | Select-Object OwningProcess
  ```
- **Kill process:**
  ```powershell
  Stop-Process -Id <PID> -Force
  ```

### 3. Image Upload Errors (`MulterError: File too large` / Invalid format)
- Only JPEG, PNG, WEBP, and GIF images are allowed.
- Maximum file size is 5MB per image (configurable via `MAX_FILE_SIZE_MB` in `.env`).

### 4. Socket.IO Connection Issues
- Make sure `backend/server.js` is running on port 5000.
- Check that `VITE_SOCKET_URL` in `frontend/.env` points to `http://localhost:5000`.
