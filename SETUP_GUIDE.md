# Setup Guide - Trading System & Vendor Portal

## Backend Setup

1. **Install dependencies:**
```bash
cd backend_express
npm install
```

2. **Add bcryptjs** (if not already installed):
```bash
npm install bcryptjs
```

3. **Start backend server:**
```bash
npm run dev
```

Backend runs on `http://localhost:3000`

## Main Dashboard Setup

1. **Navigate to web dashboard:**
```bash
cd web_dashboard
npm install
npm run dev
```

2. **Access Trading page:**
- Navigate to `/trading` in the main dashboard
- View RL agent strategies and marketplace activity

## Vendor Portal Setup

1. **Navigate to vendor portal:**
```bash
cd vendor_portal
npm install
npm run dev
```

2. **Access vendor portal:**
- Runs on different port (typically `http://localhost:5174`)
- Register vendor account at `/register`
- Login at `/login`
- Access marketplace at `/marketplace`

## Testing the System

### 1. Test RL Trading Agent (Main Dashboard)
- Go to `/trading` page
- Click "Execute Trading Strategy"
- View strategies for day-ahead, intraday, and balancing markets
- Check performance metrics and trading history

### 2. Test Vendor Portal
- Register a vendor account
- Create bids for different market types
- View your bids and transactions
- Edit/delete pending bids

### 3. Test Data Center Operator
- Actions automatically use placeholder email: `amansharma12607@gmail.com`
- No authentication required
- All dispatch logs include operator identification

## API Endpoints

### Trading & Marketplace
- `GET /api/marketplace/trading-strategy` - Get current RL strategy
- `POST /api/marketplace/trading-strategy` - Execute RL strategy
- `GET /api/marketplace/bids` - List all bids
- `POST /api/marketplace/bids` - Create bid (vendor auth)
- `GET /api/marketplace/transactions` - List transactions

### Vendor Auth
- `POST /api/vendor-auth/register` - Register vendor
- `POST /api/vendor-auth/login` - Vendor login
- `GET /api/vendor-auth/me` - Get vendor info

## Environment Variables

### Backend (.env)
```
JWT_SECRET=your-secret-key
MONGODB_URI=mongodb://localhost:27017/vpp
REDIS_URL=redis://localhost:6379
```

### Vendor Portal (.env)
```
VITE_API_URL=http://localhost:3000
```

## Features Implemented

✅ RL-based trading agent (mock implementation)
✅ Q-learning algorithm with Q-table
✅ Three market types (day-ahead, intraday, balancing)
✅ Vendor authentication (JWT-based)
✅ Marketplace CRUD operations
✅ Transaction tracking with completion times
✅ Separate vendor portal frontend
✅ Data center operator placeholder email
✅ Real-time bid and transaction updates
✅ Performance metrics and trading history

