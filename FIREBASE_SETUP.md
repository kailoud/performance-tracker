# 🔥 Firebase Setup Guide

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project"
3. Name it "Production Tracker"
4. Enable Google Analytics (optional)
5. Click "Create project"

## Step 2: Add Web App

1. Click the web icon (</>) 
2. Register app with name "Production Tracker"
3. **Copy the Firebase config object** - you'll need this!

## Step 3: Enable Firestore Database

1. Go to "Firestore Database" in left sidebar
2. Click "Create database"
3. Choose "Start in test mode" (we'll secure it later)
4. Select a location close to you

## Step 4: Enable Authentication

1. Go to "Authentication" in left sidebar
2. Click "Get started"
3. Go to "Sign-in method" tab
4. Enable "Email/Password"

## Step 5: Update Firebase Config

1. Open `src/firebase.js`
2. Replace the placeholder config with your actual Firebase config:

```javascript
const firebaseConfig = {
  apiKey: "your-actual-api-key",
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "your-messaging-sender-id",
  appId: "your-app-id"
};
```

## Step 6: Test the App

1. Run `npm start`
2. Create a new account or sign in
3. Your data will now be stored in Firebase!

## 🔒 Security Rules (Optional)

Later, you can add security rules to Firestore:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## 📱 Features Now Available

- ✅ **User Authentication**: Secure login with email/password
- ✅ **Cloud Storage**: Data persists across devices
- ✅ **Real-time Sync**: Updates instantly
- ✅ **Offline Support**: Works without internet
- ✅ **Data Backup**: Never lose your production data

## 🚀 Next Steps

1. Replace the Firebase config in `src/firebase.js`
2. Test the app with `npm start`
3. Create your first account
4. Start tracking your production!

Your data is now securely stored in the cloud! 🌟 