# Luna Daily - Firebase Sync Setup

The app now has optional Firebase sync scaffolding. Until `firebase-config.js` is filled in with a real Firebase web app config, Luna Daily stays local-only.

## What Firebase Will Store

Firebase will store the user's habit data, custom trackers, profile, entries, and timestamps in Cloud Firestore.

Photos are not synced yet. Uploaded photos stay local because Firestore documents have size limits. Future photo sync should use Firebase Storage.

## Firebase Project Checklist

1. Create a Firebase project.
2. Add a web app to the Firebase project.
3. Copy the Firebase web app config into `firebase-config.js`.
4. Enable Authentication -> Sign-in method -> Google.
5. Enable Cloud Firestore.
6. Add the GitHub Pages domain as an authorized domain for Authentication:
   `rob-gonzales-dev.github.io`
7. Set Firestore rules so each signed-in user can only read/write their own data.

## Firestore Data Path

The app writes one document per signed-in user:

`users/{uid}/lunaDaily/state`

## Suggested Firestore Rules

```text
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/lunaDaily/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Current Config File

`firebase-config.js` currently contains empty strings. That is intentional until the Firebase project exists.

The Firebase config is not a password. It identifies the Firebase project. Security comes from Authentication and Firestore rules.
