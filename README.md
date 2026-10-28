# Campus Auction — Full-Stack College Marketplace & Timed Auction Web App

> A complete, production-grade mini eBay platform designed specifically for college campuses. Graduating seniors can list used items (bicycles, calculators, textbooks, lab equipment, laptops, and hostel gear) through timed auctions. Junior students can browse listings, place bids, receive real-time outbid alerts via Socket.IO, and win items fairly with safe on-campus in-person handovers.

---

## 1. Project Overview & Architecture

Campus Auction solves the common college problem of passing down valuable academic and hostel supplies from departing seniors to incoming juniors. 

### Key Highlights:
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
- **API Client:** Axios with credentials (`withCredentials: true`) and auth interceptors
- **Real-Time Client:** Socket.IO Client v4
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
- **CORS & Rate Limiting:** `cors` configured for `http://localhost:5173`, plus `express-rate-limit` for auth and bidding abuse prevention

---

## 3. Project Structure

```text
mini_eBuy/
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── api/
│   │   │   ├── axios.js
│   │   │   ├── auctionApi.js
│   │   │   ├── authApi.js
│   │   │   ├── userApi.js
│   │   │   └── notificationApi.js
│   │   ├── components/
│   │   │   ├── Navbar.jsx
│   │   │   ├── Footer.jsx
│   │   │   ├── AuctionCard.jsx
│   │   │   ├── CountdownTimer.jsx
│   │   │   ├── BidHistory.jsx
│   │   │   ├── SearchFilters.jsx
│   │   │   ├── NotificationBell.jsx
│   │   │   ├── ProtectedRoute.jsx
│   │   │   └── StatusBadge.jsx
│   │   ├── context/
│   │   │   ├── AuthContext.jsx
│   │   │   └── SocketContext.jsx
│   │   ├── hooks/
│   │   │   └── useCountdown.js
│   │   ├── pages/
│   │   │   ├── Home.jsx
│   │   │   ├── Login.jsx
│   │   │   ├── Register.jsx
│   │   │   ├── AuctionDetails.jsx
│   │   │   ├── CreateListing.jsx
│   │   │   ├── MyListings.jsx
│   │   │   ├── MyBids.jsx
│   │   │   ├── Notifications.jsx
│   │   │   ├── SellerDashboard.jsx
│   │   │   └── NotFound.jsx
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── index.html
├── backend/
│   ├── config/
│   │   └── db.js
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── auctionController.js
│   │   ├── userController.js
│   │   └── notificationController.js
│   ├── middleware/
│   │   ├── auth.js
│   │   └── upload.js
│   ├── models/
│   │   ├── User.js
│   │   ├── Item.js
│   │   ├── Bid.js
│   │   └── Notification.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── auctionRoutes.js
│   │   ├── userRoutes.js
│   │   └── notificationRoutes.js
│   ├── services/
│   │   └── auctionService.js
│   ├── sockets/
│   │   └── socketManager.js
│   ├── uploads/            # Uploaded photos & sample SVG items
│   ├── utils/
│   │   └── money.js
│   ├── scripts/
│   │   ├── seed.js         # Comprehensive database seed script
│   │   └── verify-all.js   # Automated test verification suite
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
The repository includes a ready-to-use `.env` file inside `backend/`. You can also verify or modify `backend/.env`:
```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/campus_auction
JWT_SECRET=campus_auction_jwt_secret_dev_key_2026
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173
ALLOWED_EMAIL_DOMAIN=
MAX_FILE_SIZE_MB=5
```
*(Leave `ALLOWED_EMAIL_DOMAIN` blank to permit any college email, or set it to `@campus.edu` to restrict registration).*

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

## 5. Demo Accounts & Credentials

The seed script creates the following pre-configured student accounts:

| Role | Name | Email | Password | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Seller** | John Seller (Senior CSE) | `seller@campus.edu` | `Password123!` | Lists items, approves/rejects bids, confirms handovers |
| **Bidder 1** | Alice Bidder (Sophomore ECE) | `bidder1@campus.edu` | `Password123!` | Places competitive bids, tests outbid alerts |
| **Bidder 2** | Bob Bidder (Junior Mech) | `bidder2@campus.edu` | `Password123!` | Outbids Alice, wins auctions |
| **Bidder 3** | Charlie Bidder (Freshman IT) | `bidder3@campus.edu` | `Password123!` | General student buyer |

> 💡 **Tip:** On the `/login` page, you can simply click any of the **Quick Demo Login** buttons to fill credentials with a single click!

---

## 6. Required Demonstration Walkthrough

Follow this step-by-step checklist to test all required capabilities:

### 1. Seller Creates an Auction
1. Log in as `seller@campus.edu`.
2. Click **Create Listing** in the top navbar.
3. Fill in title (e.g., *"Casio Scientific Calculator FX-991EX"*), select Category (*Electronics & Gadgets*), Condition (*Like New*), Starting Price (*₹850*), Minimum Increment (*₹50*), and select a closing time 5 minutes in the future.
4. Upload an item image and click **Publish Auction Listing**.
5. You are redirected to the live auction page. Notice: as the seller, you see the notice: *"You are the seller of this listing. You cannot bid on your own item."*

### 2. Student Places a Valid Bid
1. Log out or open an Incognito window, and log in as `bidder1@campus.edu`.
2. Browse to the newly created listing.
3. The minimum valid bid is ₹850. Enter `₹850` and click **Place Verified Bid Now**.
4. The bid is accepted instantly. The public bid history updates, and the badge says *"Leading Bidder"*.

### 3. Bid Below Required Minimum (Validation Error)
1. Try placing a bid of `₹870` (minimum increment is ₹50, so valid minimum is ₹900).
2. The UI and server immediately reject the submission with an explicit message:
   `Your bid of ₹870 is too low. The minimum valid bid is ₹900.`

### 4. Second Student Outbids First Student (Real-Time Socket Alert)
1. In another browser tab/window, log in as `bidder2@campus.edu`.
2. Enter `₹950` and click **Place Verified Bid Now**.
3. **Watch Bidder 1's tab in real time:**
   - The leading price instantly updates to ₹950 without page refresh.
   - Bidder 1's status badge switches from *"Winning Bidder"* to *"Outbid"*.
   - A floating in-app notification toast pops up: *"Outbid Alert! You were outbid on..."*.
   - The red notification bell counter increments to `1`.

### 5. Automatic Auction Expiration & Cron Closing
1. The seed script creates two active auctions ending 2 minutes from seed creation:
   - *"Hero Sprint Pro 21-Speed Mountain Bicycle"*
2. Wait for the countdown to reach `00:00:00`.
3. Within 10 seconds, `node-cron` detects expiration and atomically transitions the status from `Active` to `Pending Approval`.
4. Socket.IO broadcasts the status change: bidding controls disable, and the message appears: *"Auction Closed — Awaiting Seller Approval"*.

### 6. Seller Approves Winning Bid
1. Log in as `seller@campus.edu` and open the expired bicycle listing.
2. In the **Seller Control Panel**, click **✓ Approve Winning Bid (Reserve Item)**.
3. The auction transitions to **Reserved**.
4. Both buyer and seller receive the campus handover instructions.

### 7. Confirm Handover
1. Once the in-person exchange takes place at the library/student center, the seller clicks **🤝 Confirm Campus Handover Completed**.
2. Status updates to **Sold**, recording `soldAt` and the final winning amount.

### 8. Alternative Scenarios
- **Seller Rejection:** If the reserve price was not met, seller clicks *✕ Reject Winning Bid*, recording the rejection reason.
- **Unsold Auction:** If an auction closes with 0 bids, the cron job marks it `Unsold`.
- **Cancellation:** If an auction is active with no bids or before close, the seller clicks *Cancel Listing*.
- **Failed Pickup:** If the reserved buyer does not arrive for the scheduled campus handover, the seller records *Failed Pickup* with an audit note.

---

## 7. Bidding Rules & Concurrency Safety

### Concurrency Protection Mechanism
In a high-traffic campus auction, two students might submit bids simultaneously for the same item. Campus Auction prevents race conditions through **MongoDB Atomic Conditional Updates**:

```javascript
const updatedAuction = await Item.findOneAndUpdate(
  {
    _id: auctionId,
    status: 'Active',
    closingAt: { $gt: new Date() },
    seller: { $ne: req.user._id },
    $or: [
      // Case 1: First bid ever placed
      { currentLeadingBid: null, startingPrice: { $lte: bidAmountPaise } },
      // Case 2: Subsequent higher bid meeting increment
      {
        currentLeadingBid: { $ne: null, $lt: bidAmountPaise },
        $expr: {
          $gte: [
            bidAmountPaise,
            { $add: ['$currentLeadingBid', '$minimumIncrement'] },
          ],
        },
      },
    ],
  },
  {
    $set: {
      currentLeadingBid: bidAmountPaise,
      currentLeadingBidder: req.user._id,
    },
    $inc: { bidCount: 1 },
  },
  { new: true }
);
```

### Why this is concurrency-safe:
1. **Single-Document Atomicity:** MongoDB guarantees atomic execution of `findOneAndUpdate` on a single document.
2. **Lock-Free Conflict Detection:** If Bidder A and Bidder B both read a price of ₹1,000 and submit ₹1,100 simultaneously, whichever query hits MongoDB first modifies the document. The second query fails the `{ currentLeadingBid: { $lt: 1100 } }` condition and returns `null`.
3. The server catches the `null` result and returns HTTP 409 Conflict: *"Another higher bid was placed right before yours."*
4. No duplicate entries or price inconsistencies can ever be recorded.

---

## 8. Verification & Automated Test Suite

Run the built-in automated test suite to verify all backend systems in one command:
```powershell
node backend/scripts/verify-all.js
```

### Verified Test Results:
```text
====================================================
  CAMPUS AUCTION END-TO-END VERIFICATION SUITE       
====================================================

[1/7] MongoDB Connection: OK
[2/7] User Retrieval & Bcrypt Password Hashing: PASS
[3/7] Sample Auction Listings Count: PASS (10 auctions found across statuses)
[4/7] Testing Concurrency-Safe Bidding Logic...
      - Low bid rejection check: PASS
      - Valid bid placement with atomic update: PASS
      - Concurrency race conflict prevented atomically: PASS (returned null for outdated price)
      - Seller self-bid guard: PASS (prevented on backend)
[5/7] Testing Automatic Auction Closing Workflow...
      - Expired active auction transitioned: PASS (Status: Pending Approval, Winner: Bidder 1)
[6/7] Testing Seller Workflow (Pending Approval -> Reserved -> Sold)...
      - Seller Approved: Status -> Reserved (Campus Handover arranged): PASS
      - Seller Confirmed Handover: Status -> Sold: PASS
[7/7] Verifying Notification System & Deduplication...
      - In-App Notifications logged: PASS (4 notifications in database)

====================================================
  ALL VERIFICATION TESTS COMPLETED SUCCESSFULLY!  
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
- Check that `VITE_SOCKET_URL` in `frontend` points to `http://localhost:5000` (defaults to port 5000).

---

## 10. License & Campus Integrity
Built for academic campus marketplaces. Promotes sustainability and affordability by recycling textbooks, bicycles, calculators, and electronics among student cohorts.

