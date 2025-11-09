# Algorithmic Trading System Implementation

## Overview

A complete RL-based algorithmic trading system for energy markets with vendor marketplace integration.

## Backend Implementation

### 1. RL Trading Agent (`backend_express/src/services/market/rlTradingAgent.js`)

**Features:**
- Mock reinforcement learning implementation using Q-learning
- Analyzes price patterns, renewable forecasts, and grid conditions
- Optimizes bidding strategies for three market types:
  - **Day-Ahead Market**: 24-hour horizon, base pricing
  - **Intraday Market**: 1-hour horizon, 10% premium
  - **Balancing Market**: 15-minute horizon, 50% premium

**Key Methods:**
- `generateBidStrategy()` - Creates optimal bid for each market type
- `executeTradingStrategy()` - Executes strategies and places bids
- `getPerformanceMetrics()` - Tracks RL agent performance
- `getTradingHistory()` - Retrieves trading session history

**RL Components:**
- Q-table for state-action value storage
- Epsilon-greedy policy (10% exploration, 90% exploitation)
- State representation: reserve, SOC, grid stress, price trends, time patterns
- Reward calculation based on buy/sell actions and market conditions

### 2. Marketplace Routes (`backend_express/src/routes/marketplace.js`)

**Endpoints:**
- `GET /api/marketplace/bids` - List all bids (vendors see their own)
- `POST /api/marketplace/bids` - Create bid (vendor auth required)
- `PUT /api/marketplace/bids/:bidId` - Update bid (vendor auth, own bids only)
- `DELETE /api/marketplace/bids/:bidId` - Delete bid (vendor auth, own bids only)
- `GET /api/marketplace/transactions` - List transactions
- `POST /api/marketplace/transactions` - Create transaction (when bid accepted)
- `PUT /api/marketplace/transactions/:transactionId` - Update transaction status
- `GET /api/marketplace/vendors` - List active vendors
- `GET /api/marketplace/trading-strategy` - Get RL strategy (read-only)
- `POST /api/marketplace/trading-strategy` - Execute RL strategy
- `GET /api/marketplace/trading-history` - Get trading history
- `GET /api/marketplace/performance` - Get RL performance metrics

### 3. Vendor Authentication (`backend_express/src/routes/vendorAuth.js`)

**Endpoints:**
- `POST /api/vendor-auth/register` - Register new vendor (JWT-based)
- `POST /api/vendor-auth/login` - Vendor login
- `GET /api/vendor-auth/me` - Get current vendor info

**Security:**
- Password hashing with bcryptjs
- JWT token generation and validation
- Separate from Auth0 (data center operator uses Auth0)

### 4. Data Center Operator Placeholder

All dispatch actions from data center operators use placeholder email:
- Email: `amansharma12607@gmail.com`
- Stored in `operator_email` field in dispatch logs
- No authentication required for operator routes

## Frontend Implementation

### 1. Main Dashboard - Trading Page (`web_dashboard/src/pages/Trading.jsx`)

**Features:**
- RL Agent Performance Metrics
- Current Trading Strategies (Day-Ahead, Intraday, Balancing)
- Active Bids Table (shows RL agent and vendor bids)
- Recent Transactions Table
- Active Vendors List
- Execute Trading Strategy button

**Displays:**
- Q-table size (learned states)
- Success rate and total rewards
- Market-specific strategies with expected rewards
- Bid status and transaction completion times

### 2. Vendor Portal (`vendor_portal/`)

**Separate Vite React Project**

**Pages:**
- `Login.jsx` - Vendor sign in
- `Register.jsx` - Vendor registration
- `Marketplace.jsx` - Main marketplace interface

**Features:**
- Vendor authentication (JWT)
- Create/Edit/Delete bids
- View transactions and revenue
- Real-time bid status updates
- CRUD operations for marketplace

**Setup:**
```bash
cd vendor_portal
npm install
npm run dev
```

## Data Flow

### RL Trading Agent Flow:
1. Agent analyzes current system state (reserve, SOC, grid stress)
2. Gets price trends and market conditions
3. Uses Q-learning to select optimal action (buy/sell/hold)
4. Calculates bid parameters (capacity, price, duration)
5. Places bids in appropriate markets
6. Updates Q-table based on rewards
7. Stores trading session in database

### Vendor Marketplace Flow:
1. Vendor registers/logs in via vendor portal
2. Vendor creates bid with capacity, price, service type
3. Bid stored with vendor_id
4. When bid accepted, transaction created
5. Transaction tracks completion time and status
6. Vendor can view all their bids and transactions

### Data Center Operator Flow:
1. Operator actions use placeholder email: `amansharma12607@gmail.com`
2. No authentication required for operator routes
3. All dispatch logs include `operator_email` field
4. Actions tracked in database with operator identification

## Database Collections

- `market_bids` - All bids (RL agent and vendors)
- `transactions` - Completed energy transactions
- `trading_sessions` - RL agent trading history
- `vendors` - Vendor accounts (separate from users)

## Market Types

1. **Day-Ahead Market**
   - Duration: 24 hours
   - Service: SRAS
   - Pricing: Base market price

2. **Intraday Market**
   - Duration: 1 hour
   - Service: TRAS
   - Pricing: 10% premium

3. **Balancing Market**
   - Duration: 15 minutes
   - Service: DR (Demand Response)
   - Pricing: 50% premium

## RL Learning Process

1. **State Representation**: Discretized features (reserve, SOC, stress, price)
2. **Action Selection**: Epsilon-greedy (explore vs exploit)
3. **Reward Calculation**: Based on action type and market conditions
4. **Q-Table Update**: Q-learning algorithm with learning rate 0.01, discount 0.95
5. **Persistence**: Q-values cached in Redis

## Integration Points

- **Main Dashboard**: `/trading` route shows RL agent activity
- **Vendor Portal**: Separate app at different port for vendor management
- **Backend API**: Shared routes in `backend_express`
- **Authentication**: JWT for vendors, Auth0 for main dashboard, placeholder for operators

