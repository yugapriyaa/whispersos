import { initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: "AIzaSyDKZfeYYUyivmconbzA63Ouai3XdTfCa4Q",
  authDomain: "whispersoscursor.firebaseapp.com",
  projectId: "whispersoscursor",
  storageBucket: "whispersoscursor.firebasestorage.app",
  messagingSenderId: "460052648261",
  appId: "1:460052648261:web:b9cba14670d9e974ddee2c",
  measurementId: "G-YQ5N38HW49"
};

console.log('Initializing Firebase with config:', firebaseConfig);

// Initialize Firebase
const app = initializeApp(firebaseConfig);
console.log('Firebase app initialized successfully');

// Initialize Firebase Auth with proper React Native handling
let auth;
if (Platform.OS === 'web') {
  console.log('Using web auth initialization');
  auth = getAuth(app);
} else {
  console.log('Using React Native auth initialization');
  try {
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage)
    });
    console.log('React Native auth initialized successfully');
  } catch (error) {
    console.log('Error initializing React Native auth:', error);
    // If auth is already initialized, get the existing instance
    if (error.code === 'auth/duplicate-instance') {
      console.log('Auth already initialized, getting existing instance');
      auth = getAuth(app);
    } else {
      throw error;
    }
  }
}

console.log('Auth instance created:', auth);

// Initialize Firebase Storage
const storage = getStorage(app);
console.log('Storage instance created:', storage);

export { auth, storage };
export default app; 