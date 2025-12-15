# Google Calendar Setup Guide

This guide walks you through setting up Google Calendar integration for the Kitchen Display app.

## Overview

The Google Calendar widget uses OAuth 2.0 to securely access your Google Calendar data. This requires creating a project in Google Cloud Console.

**Time required:** ~10 minutes

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click the project dropdown at the top of the page
3. Click **"New Project"**
4. Enter a project name (e.g., "Kitchen Display")
5. Click **"Create"**

![Create Project](https://developers.google.com/static/workspace/images/create-project.png)

## Step 2: Enable the Google Calendar API

1. In your new project, go to **"APIs & Services"** → **"Library"**
2. Search for **"Google Calendar API"**
3. Click on it, then click **"Enable"**

## Step 3: Configure the OAuth Consent Screen

1. Go to **"APIs & Services"** → **"OAuth consent screen"**
2. Select **"External"** user type (unless you have a Google Workspace account)
3. Click **"Create"**

### Fill in the consent screen:

| Field | Value |
|-------|-------|
| App name | Kitchen Display |
| User support email | Your email |
| Developer contact email | Your email |

4. Click **"Save and Continue"**

### Add Scopes:

1. Click **"Add or Remove Scopes"**
2. Search for and add: `https://www.googleapis.com/auth/calendar.readonly`
3. Click **"Update"**, then **"Save and Continue"**

### Add Test Users (Important!):

While your app is in "Testing" mode, only specified users can authenticate.

1. Click **"Add Users"**
2. Add your Gmail address (and any family members who will use the display)
3. Click **"Save and Continue"**

## Step 4: Create OAuth Credentials

1. Go to **"APIs & Services"** → **"Credentials"**
2. Click **"+ Create Credentials"** → **"OAuth client ID"**
3. Select **"Web application"**

### Configure the OAuth client:

| Field | Value |
|-------|-------|
| Name | Kitchen Display Web Client |
| Authorized JavaScript origins | `http://localhost:5173` (for development) |
| | `http://localhost:5174` |
| | `http://localhost:5175` |
| | `http://localhost:5176` |
| | Your production URL (e.g., `https://yourdomain.com`) |

> **Note:** Add all ports you might use during development. Vite may use different ports if some are in use.

4. Click **"Create"**

5. **Copy the Client ID** - You'll need this for the Kitchen Display app

The Client ID looks like: `123456789-abcdefg.apps.googleusercontent.com`

## Step 5: Configure Kitchen Display

1. Add a **Google Calendar** widget to your dashboard
2. Open the widget settings (gear icon)
3. Paste your **Client ID** into the "Google Client ID" field
4. Click **"Sign in with Google"**
5. Authorize the app to access your calendar
6. Select which calendars to display

## Production Deployment

When deploying to production:

1. Add your production domain to the **Authorized JavaScript origins** in Google Cloud Console
2. Consider publishing your OAuth app (removes the "Testing" restriction)

### Publishing the App (Optional)

If you want anyone to use your hosted version:

1. Go to **OAuth consent screen**
2. Click **"Publish App"**
3. Your app may need verification for sensitive scopes

For personal/family use, keeping the app in "Testing" mode and adding family members as test users is sufficient.

## Troubleshooting

### "Error 403: access_denied"
- Make sure your email is added as a test user in the OAuth consent screen
- Clear your browser cache and try again

### "Error 400: redirect_uri_mismatch"
- Check that your current URL (including port) is in the Authorized JavaScript origins
- Make sure there are no trailing slashes

### "Sign in popup doesn't appear"
- Check that popups aren't blocked in your browser
- Try a different browser

### Token expires after 1 hour
- This is normal for OAuth tokens
- Click "Sign in with Google" again to refresh

## Security Notes

- The app only requests **read-only** access to your calendars
- Your credentials are never sent to any server except Google
- Tokens are stored in browser memory only (not persisted)
- You can revoke access anytime at [Google Security Settings](https://myaccount.google.com/permissions)

## Alternative: iCal URL (Simpler Setup)

If OAuth setup is too complex, use the regular **Calendar** widget instead, which works with Google Calendar's iCal URL:

1. Go to [Google Calendar](https://calendar.google.com)
2. Click ⋮ next to your calendar → Settings
3. Scroll to "Secret address in iCal format"
4. Copy the URL and use it in the Calendar widget

This method doesn't require any Google Cloud setup but only shows one calendar at a time.

