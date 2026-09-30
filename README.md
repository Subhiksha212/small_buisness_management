# Smart Small Business Management System

A full-stack MERN (MongoDB, Express.js, React.js, Node.js) web application designed specifically for small shop and business owners. It features an extremely simple, beginner-friendly, multilingual (English & Tamil), mobile-responsive interface with text-to-speech voice assistance and voice commands.

---

## 🌟 Key Features

1. **Dashboard & Financial Summary**:
   - **Total Sales**, **Total Expenses**, and **Net Profit/Loss** displayed clearly.
   - Profit is highlighted in **Green**, Loss is highlighted in **Red**.
   - Today's Summary (Sales, Expenses, Profit/Loss).
   - Payment Method breakdown (Cash, UPI, Card).
   - Recent transactions feed.
   - **Zero NaN/Undefined**: Handles empty database gracefully with ₹0 values.

2. **Add Sale**:
   - Asks *"How much was the sale?"* with large ₹ amount input.
   - Large touch-friendly payment method buttons: 💵 Cash, 📱 UPI, 💳 Card.
   - Optional description field & automatic date/time recording.

3. **Add Expense**:
   - Asks *"How much did you spend?"* with large ₹ amount input.
   - Large category selection buttons: 📦 Stock, 🏠 Rent, 💡 Electricity, 👥 Staff Salary, ••• Other.
   - Optional description field & automatic date/time recording.

4. **Transaction History**:
   - Simple list displaying Date, Type (Sale/Expense), Category/Method, and Amount.
   - Type Filters: **All**, **Sales**, **Expenses**.
   - Time Filters: **Today**, **This Month**, **All Time**.
   - Delete transaction capability.

5. **Multilingual Interface (English | தமிழ்)**:
   - One-click language switching between **English** and **Tamil**.
   - Extensible dictionary architecture in `frontend/src/translations/index.js` for adding languages like Hindi, Telugu, and Malayalam later.
   - Does not duplicate financial data.

6. **🔊 Voice Assistance (Read Page)**:
   - Uses Web SpeechSynthesis API to read current page summary aloud in English or Tamil.

7. **🎤 Voice Commands & Advanced Entry**:
   - Navigates automatically via voice ("Add sale", "Add expense", "Go home", "Show history").
   - Smart voice entry detection (e.g. *"I sold something for 500 rupees"* or *"I spent 1000 rupees on stock"*).
   - Confirmation popup before saving voice transactions (**YES** / **NO**).

---

## 📂 Project Structure

```text
Shop management/
├── backend/
│   ├── config/
│   │   └── db.js            # MongoDB Mongoose Connection
│   ├── controllers/
│   │   ├── salesController.js
│   │   ├── expensesController.js
│   │   └── dashboardController.js
│   ├── models/
│   │   ├── Sale.js          # Sale Mongoose Model
│   │   └── Expense.js       # Expense Mongoose Model
│   ├── routes/
│   │   ├── sales.js         # REST endpoints for sales
│   │   ├── expenses.js      # REST endpoints for expenses
│   │   └── dashboard.js     # REST endpoint for aggregated data
│   ├── .env                 # Environment variables (Port & MongoDB URI)
│   ├── .env.example         # Example environment file
│   ├── server.js            # Express application entry point
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Header.jsx   # Top Header with Title, Language Selector & Voice buttons
│   │   │   ├── Navbar.jsx   # Simple Bottom/Top Navigation (Home, Add Sale, Add Expense, History, Help)
│   │   │   ├── VoiceAssistant.jsx # Voice Help & Voice Command Parser
│   │   │   └── VoiceConfirmationModal.jsx # Voice transaction confirmation popup
│   │   ├── context/
│   │   │   └── LanguageContext.jsx # Global Language & Speech Context
│   │   ├── pages/
│   │   │   ├── Home.jsx       # Dashboard Page
│   │   │   ├── AddSale.jsx    # Add Sale Form
│   │   │   ├── AddExpense.jsx # Add Expense Form
│   │   │   ├── History.jsx    # Transaction History Page
│   │   │   └── Help.jsx       # Voice & App Usage Help
│   │   ├── services/
│   │   │   └── api.js         # Axios HTTP Service
│   │   ├── translations/
│   │   │   └── index.js       # English & Tamil dictionaries
│   │   ├── App.jsx            # Main App Routing
│   │   ├── main.jsx           # React Entry Point
│   │   └── index.css          # Styling & Accessibility System
│   ├── package.json
│   └── vite.config.js
│
└── README.md
```

---

## 🚀 Complete Step-by-Step Build & Setup Guide (Steps 1 to 20)

### STEP 1 — Check Node.js and npm
```bash
node -v
npm -v
```

### STEP 2 — Project Folders Initialization
Inside `Shop management/`:
- Create `backend` directory: `mkdir backend`
- Create `frontend` directory: `mkdir frontend`
- Initialize backend: `cd backend && npm init -y`

### STEP 3 — Create React Frontend (Vite)
Inside `Shop management/`:
```bash
npx create-vite@latest frontend --template react
cd frontend
npm install
npm install axios react-router-dom lucide-react
```

### STEP 4 — Create Express Backend
Inside `backend/`:
```bash
npm install express mongoose cors dotenv
```

### STEP 5 & 6 — Connect MongoDB Atlas
1. Create a free cluster on [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Get your connection string (e.g., `mongodb+srv://<username>:<password>@cluster0.mongodb.net/smart_business_db?retryWrites=true&w=majority`).
3. Update `backend/.env`:
   ```env
   PORT=5000
   MONGODB_URI=YOUR_MONGODB_ATLAS_CONNECTION_STRING
   ```

### STEP 7 — Create Mongoose Models
- `Sale.js`: `amount` (Number), `paymentMethod` ('Cash' | 'UPI' | 'Card'), `description` (String), timestamps.
- `Expense.js`: `amount` (Number), `category` ('Stock' | 'Rent' | 'Electricity' | 'Salary' | 'Other'), `description` (String), timestamps.

### STEP 8 — Create Backend REST APIs
- `POST /api/sales` & `GET /api/sales`
- `POST /api/expenses` & `GET /api/expenses`
- `GET /api/dashboard`

### STEP 9 — Test APIs
Start backend:
```bash
cd backend
npm run dev
```
Backend runs on `http://localhost:5000`. Test endpoints using Postman or browser.

### STEP 10 — Build React UI
Components and pages designed with high contrast, simple wording, large touch buttons, and Indian Rupees (`₹`).

### STEP 11 — Connect React to Backend
Axios configured in `frontend/src/services/api.js` pointing to `http://localhost:5000/api`.

### STEP 12 — Dashboard Calculations
Automatic MongoDB aggregations for total sales, total expenses, net profit/loss, cash/upi/card sales, and today's summary.

### STEP 13 — Multilingual Support (English & Tamil)
Language state managed via `LanguageContext`. Toggle button on Header switches interface language instantly.

### STEP 14 & 15 — Text-to-Speech & Voice Commands
- **🔊 Voice Help**: Reads current page aloud.
- **🎤 Voice Commands**: Detects navigation and voice transactions.

### STEP 16 — Transaction History
Filtered list by Type (**All**, **Sales**, **Expenses**) and Time (**Today**, **This Month**, **All Time**).

### STEP 17 — Mobile Responsive Design
Optimized layouts for mobile devices and desktop screens.

### STEP 18 — Error Handling & Input Validation
User-friendly notification banners for missing amounts, unselected payment methods, or network errors.

### STEP 19 & 20 — Running the Full Application

#### 1. Start Backend:
```bash
cd backend
npm run dev
```

#### 2. Start Frontend:
Open a new terminal window:
```bash
cd frontend
npm run dev
```
Open your browser at `http://localhost:5173`.
