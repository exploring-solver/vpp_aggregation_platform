# Testing Auth0 Token Flow

## Changes Made to Fix Token Timing Issues

### 1. Enhanced AuthService (`web_dashboard/src/services/auth.js`)
- **Token Promise Management**: Added `tokenPromise` to handle concurrent token requests
- **ensureValidToken()**: New method that waits for token to be available before API calls
- **Improved makeApiCall()**: Always ensures valid token before making requests
- **Better Error Handling**: Handles token refresh and fallback scenarios

### 2. Improved Login Component (`web_dashboard/src/pages/Login.jsx`)
- **Retry Logic**: Added retry mechanism for token requests (up to 3 attempts)
- **Token Verification**: Verifies token is stored before navigation
- **Better Error Messages**: More detailed error reporting
- **Race Condition Fix**: Checks for existing token before re-requesting

### 3. Enhanced ProtectedRoute (`web_dashboard/src/components/ProtectedRoute.jsx`)
- **Token Readiness Check**: Ensures token is available before rendering protected content
- **Loading States**: Better UX with proper loading indicators
- **Error Handling**: Shows errors if token preparation fails

## How to Test the Fixed Flow

### 1. Clear Browser Storage First
```javascript
// Open browser console and run:
localStorage.clear()
sessionStorage.clear()
```

### 2. Start Both Servers
```bash
# Terminal 1: Backend
cd backend_express
npm start

# Terminal 2: Frontend
cd web_dashboard
npm run dev
```

### 3. Test Authentication Flow

#### Step 1: Navigate to App
- Go to `http://localhost:5173`
- Should redirect to `/login`

#### Step 2: Login Process
- Click "Sign In with Auth0"
- Complete Auth0 authentication
- **Watch Console Logs** for:
  ```
  User authenticated, getting access token...
  Attempting to get token (attempt 1/3)...
  Successfully got access token: {...}
  Token stored successfully in localStorage
  Token verification successful, navigating to dashboard...
  ```

#### Step 3: Dashboard Loading
- Should see "Preparing your session..." briefly
- Then load Dashboard with data
- **Watch Console Logs** for:
  ```
  ProtectedRoute: Ensuring valid token...
  ProtectedRoute: Token ready
  Dashboard: Component mounted/re-rendered
  Dashboard: Starting API call...
  Dashboard: Token available: true
  Dashboard: Token preview: eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiI...
  Making API call with token: eyJ0eXAiOiJKV1QiLCJhbGci...
  API response status: 200
  ```

### 4. Verify Token is Working

#### Check localStorage
```javascript
// In browser console:
console.log('Access Token:', localStorage.getItem('access_token'))
console.log('User:', localStorage.getItem('user'))
```

#### Check API Call
```javascript
// In browser console:
fetch('http://localhost:3000/api/aggregate', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
    'Content-Type': 'application/json'
  }
})
.then(res => res.json())
.then(data => console.log('API Response:', data))
.catch(err => console.error('API Error:', err))
```

### 5. Test Token Refresh
1. Wait for token to expire (or manually delete it)
2. Make an API call through the UI
3. Should automatically refresh token and retry

## Expected Console Log Flow

### Successful Login:
```
User authenticated, getting access token...
Attempting to get token (attempt 1/3)...
Successfully got access token: {tokenLength: 1234, tokenStart: "eyJ0eXAi..."}
Token stored successfully in localStorage
Token verification successful, navigating to dashboard...
ProtectedRoute: Ensuring valid token...
Using valid stored token
ProtectedRoute: Token ready
Dashboard: Component mounted/re-rendered
Dashboard: Starting API call...
Dashboard: Token available: true
Dashboard: Token preview: eyJ0eXAi...
Making API call with token: eyJ0eXAi...
API response status: 200
```

### Token Refresh Scenario:
```
Dashboard: Starting API call...
Requesting new token from Auth0...
Got new token, storing... eyJ0eXAi...
Making API call with token: eyJ0eXAi...
API response status: 200
```

### Error Scenarios to Test:

#### 1. Invalid Token
- Manually corrupt token in localStorage
- Should attempt refresh and re-authenticate

#### 2. Network Issues
- Disconnect network during token request
- Should show appropriate error message

#### 3. Auth0 Configuration Issues
- Use wrong audience/domain
- Should show clear error message

## Troubleshooting Common Issues

### 1. Token Not Available
- **Symptoms**: "No valid token available" errors
- **Solution**: Check Auth0 configuration, ensure token is being stored
- **Debug**: Check browser console for token request logs

### 2. 401 Unauthorized
- **Symptoms**: API calls fail with 401
- **Solution**: Verify token format and backend Auth0 configuration
- **Debug**: Check token payload and backend logs

### 3. Infinite Loading
- **Symptoms**: Dashboard never loads
- **Solution**: Check ProtectedRoute token preparation
- **Debug**: Look for token preparation errors in console

### 4. Token Request Fails
- **Symptoms**: Login hangs on "Getting your access token..."
- **Solution**: Check Auth0 audience/scope configuration
- **Debug**: Look for Auth0 SDK errors in console

## Key Improvements Made

1. **Race Condition Fix**: Token requests now properly wait for completion
2. **Retry Logic**: Handles transient Auth0 API issues
3. **Token Verification**: Ensures token is stored before proceeding
4. **Better Error Handling**: More informative error messages
5. **Console Logging**: Detailed logging for debugging
6. **Promise Management**: Prevents multiple concurrent token requests

The authentication flow now properly waits for the Auth0 token to be received and stored before allowing API calls or navigation! 🔐✅