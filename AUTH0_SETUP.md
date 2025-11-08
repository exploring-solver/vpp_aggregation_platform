# Auth0 Authentication Setup Guide

## Current Implementation Status ✅

Your VPP platform is **already using Auth0** with the correct token flow:

```
Frontend (React) → Auth0 Login → JWT Token → Backend (Express) → JWT Validation
```

## Environment Configuration

### 1. Frontend (.env)
Create `web_dashboard/.env` with:

```env
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3001
VITE_AUTH0_DOMAIN=your-tenant.auth0.com
VITE_AUTH0_CLIENT_ID=your-client-id
VITE_AUTH0_AUDIENCE=https://your-api-identifier
```

### 2. Backend (.env)
Create `backend_express/.env` with:

```env
PORT=3000
WS_PORT=3001
NODE_ENV=development

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/vpp_aggregator

# Redis Configuration
REDIS_URL=redis://localhost:6379

# Auth0 Configuration
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_AUDIENCE=https://your-api-identifier
AUTH0_ISSUER=https://your-tenant.auth0.com/
```

## Auth0 Dashboard Configuration

### 1. Create Auth0 Application (SPA)
1. Go to Auth0 Dashboard → Applications
2. Create Application → Single Page Application
3. Configure settings:
   - **Name**: VPP Platform
   - **Application Type**: Single Page Application
   - **Allowed Callback URLs**: `http://localhost:5173`
   - **Allowed Logout URLs**: `http://localhost:5173`
   - **Allowed Web Origins**: `http://localhost:5173`

### 2. Create Auth0 API
1. Go to Auth0 Dashboard → APIs
2. Create API:
   - **Name**: VPP Platform API
   - **Identifier**: `https://your-api-identifier` (use this for VITE_AUTH0_AUDIENCE)
   - **Signing Algorithm**: RS256

### 3. Configure Scopes
Add these scopes to your API:
- `read:vpp` - Read VPP data
- `write:vpp` - Write/control VPP operations
- `admin:vpp` - Administrative operations

### 4. User Roles (Optional)
Create roles in Auth0 Dashboard → User Management → Roles:
- `VPP Admin` - Full access
- `VPP Operator` - Control operations
- `VPP Viewer` - Read-only access

## Current Token Flow Architecture

### Frontend Authentication:
1. **Login.jsx** - Handles Auth0 authentication
2. **AuthService** - Manages token storage and API calls
3. **ProtectedRoute** - Guards protected pages

### Backend Verification:
1. **auth.js middleware** - Validates JWT using Auth0 JWKS
2. **Flexible auth** - Supports both JWT (users) and API keys (M2M)
3. **Protected routes** - All user-facing APIs require JWT

## API Usage Examples

### Frontend API Calls:
```javascript
import { useAuthToken } from '../services/auth'

const { makeApiCall } = useAuthToken()

// Authenticated API call
const response = await makeApiCall('/api/aggregate')
```

### Backend Route Protection:
```javascript
// User authentication (JWT)
app.use('/api/aggregate', authenticateToken, aggregateRoutes)

// Flexible auth (JWT or API key)
app.use('/api/telemetry', authenticateFlexible, telemetryRoutes)
```

## Security Features

### ✅ Implemented:
- JWT token validation with Auth0 JWKS
- Automatic token refresh
- Secure token storage
- Role-based access control ready
- M2M authentication for edge nodes
- Protected route components

### 🔧 Improvements Made:
1. Fixed environment variable inconsistencies
2. Created centralized AuthService
3. Enhanced error handling
4. Added automatic token refresh
5. Improved API URL configuration

## Testing Authentication

1. **Start the servers**:
   ```bash
   # Backend
   cd backend_express && npm start

   # Frontend  
   cd web_dashboard && npm run dev
   ```

2. **Access the application**:
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3000

3. **Login flow**:
   - Navigate to `/` → Redirects to `/login`
   - Click "Sign In with Auth0" → Auth0 Universal Login
   - After authentication → Redirects to Dashboard
   - Token stored in localStorage for API calls

## Troubleshooting

### Common Issues:

1. **"Missing Auth0 configuration"**
   - Ensure all VITE_AUTH0_* variables are set in frontend .env

2. **"Invalid audience"**
   - Verify AUTH0_AUDIENCE matches between frontend and backend
   - Check API identifier in Auth0 dashboard

3. **Token validation errors**
   - Ensure AUTH0_DOMAIN is correct in backend .env
   - Check JWKS endpoint accessibility

4. **CORS issues**
   - Add your frontend URL to Auth0 application settings
   - Verify backend CORS configuration

## Production Deployment

1. Update Auth0 application URLs for production domains
2. Use secure environment variable storage
3. Enable Auth0 brute force protection  
4. Configure proper CORS settings
5. Set up Auth0 logs monitoring

Your authentication system is production-ready with Auth0 integration! 🔐