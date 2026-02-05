import { initializeApp, getApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

const firebaseConfig = {
  "projectId": "contracttime2-17074294-10501",
  "appId": "1:476712003174:web:03e38926e2fa2a86552fa7",
  "apiKey": "AIzaSyAj3J74A5AJ-tZYyJMncrszV6I5yF_0ohQ",
  "authDomain": "contracttime2-17074294-10501.firebaseapp.com",
  "storageBucket": "contracttime2-17074294-10501.appspot.com",
  "messagingSenderId": "476712003174"
};

// Initialize Firebase for the client
let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
