# Vendor Portal

Separate React application for energy marketplace vendors to manage bids and transactions.

## Features

- Vendor registration and authentication (JWT-based)
- Create, edit, and delete bids
- View transactions and revenue
- Real-time marketplace updates

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure API URL in `.env`:
```
VITE_API_URL=http://localhost:3000
```

3. Run development server:
```bash
npm run dev
```

The vendor portal will run on a different port (typically http://localhost:5174)

## Usage

1. Register a new vendor account at `/register`
2. Sign in at `/login`
3. Access marketplace at `/marketplace` to:
   - Create bids for energy services
   - View your bids and their status
   - Track transactions and revenue
   - Edit or delete pending bids

## API Integration

The vendor portal connects to the same backend API (`backend_express`) but uses separate JWT-based authentication routes:
- `/api/vendor-auth/register` - Vendor registration
- `/api/vendor-auth/login` - Vendor login
- `/api/marketplace/bids` - CRUD operations for bids
- `/api/marketplace/transactions` - View transactions
