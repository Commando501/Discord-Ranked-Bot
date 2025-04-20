
### 2025-07-01 12:30:00 UTC
**Type**: Bug Fix
**Files Modified**: 
- `client/src/hooks/use-mobile.tsx`

**Changes**:
- Added `useMobile` export as an alias to the existing `useIsMobile` function
- Fixed import error in layout components using this hook
- Resolved "No matching export in 'client/src/hooks/use-mobile.tsx' for import 'useMobile'" error

**Purpose**: Fix module import error that was preventing the application from starting

**Testing**: Verified that the application starts correctly after adding the missing export

**Dependencies Affected**: None


### 2025-07-01 00:00:00 UTC
**Type**: Bug Fix
**Files Modified**: 
- `client/src/components/ui/theme-provider.tsx` (New file)

**Changes**:
- Created missing `theme-provider.tsx` file in the UI components directory
- Implemented ThemeProvider component using next-themes library
- Installed next-themes package as a dependency
- Fixed "Failed to resolve import './components/ui/theme-provider'" error

**Purpose**: Resolve application startup error caused by missing theme-provider component that was being imported in App.tsx

**Testing**: Verified application starts correctly after adding the missing component and required dependency

**Dependencies Affected**: Added next-themes package



### 2024-05-19 12:00:00 UTC
**Type**: Enhancement
**Files Modified**: 
- `server/auth.ts` (new)
- `server/session.ts` (new) 
- `server/index.ts`
- `server/routes.ts`
- `client/src/components/login-page.tsx` (new)
- `client/src/App.tsx`
- `client/src/components/layout/navigation-header.tsx`
- `client/src/components/layout/app-layout.tsx`

**Changes**:
- Added Discord OAuth2 authentication for admin access to the dashboard
- Created authentication middleware to protect admin routes
- Implemented session management for user authentication
- Added login page with Discord authentication
- Added authentication state management to the client
- Added user profile display and logout functionality to the navigation header
- Protected all admin routes with authentication checks

**Purpose**: Restrict dashboard access to only Discord users with admin permissions

**Dependencies Added**:
- `express-session` - For session management
- `connect-pg-simple` - For storing sessions in PostgreSQL

**How to test**:
1. Set the following environment variables:
   - `DISCORD_CLIENT_ID`: Your Discord application client ID
   - `DISCORD_CLIENT_SECRET`: Your Discord application client secret
   - `REDIRECT_URI`: OAuth callback URL (http://localhost:5000/api/auth/callback for local testing)
   - `SESSION_SECRET`: Random string for session encryption

2. Configure admin user IDs in the bot configuration's `general.adminUsers` array
3. Try accessing the dashboard - you should be redirected to login
4. Login with Discord - only users in the admin list should gain access


# Project Patch Log Index

This file serves as an index to all patch logs, organized by time period.


## Patch Log Archives
- [2025 Q2 (Apr-Jun)](./patch_logs/2025-Q2.md) - Latest: Fixed /list command join button not refreshing the embed (2025-07-06)
- [2025 Q1 (Jan-Mar)](./patch_logs/2025-Q1.md)
- [2024 Q4 (Oct-Dec)](./patch_logs/2024-Q4.md)
- [2024 Q3 (Jul-Sep)](./patch_logs/2024-Q3.md)
- [2024 Q2 (Apr-Jun)](./patch_logs/2024-Q2.md)
- [2024 Q1 (Jan-Mar)](./patch_logs/2024-Q1.md)

## How to Use This Log
- Each quarterly file contains detailed patch notes for that time period
- Most recent changes appear at the top of each file
- For specific changes, use the search functionality within the appropriate quarterly file