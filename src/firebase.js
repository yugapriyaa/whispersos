// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDKZfeYYUyivmconbzA63Ouai3XdTfCa4Q",
  authDomain: "whispersoscursor.firebaseapp.com",
  projectId: "whispersoscursor",
  storageBucket: "whispersoscursor.firebasestorage.app",
  messagingSenderId: "460052648261",
  appId: "1:460052648261:web:f9975892cc672a13ddee2c",
  measurementId: "G-5K4WX7G27W"
};

// Log Firebase configuration (without sensitive data)
console.log('Firebase Configuration Status:');
console.log('API Key loaded:', !!firebaseConfig.apiKey);
console.log('Auth Domain loaded:', !!firebaseConfig.authDomain);
console.log('Project ID loaded:', !!firebaseConfig.projectId);
console.log('Storage Bucket loaded:', !!firebaseConfig.storageBucket);
console.log('Messaging Sender ID loaded:', !!firebaseConfig.messagingSenderId);
console.log('App ID loaded:', !!firebaseConfig.appId);
console.log('Measurement ID loaded:', !!firebaseConfig.measurementId);

// Check if all required configuration values are present
const requiredConfigVars = [
  'apiKey',
  'authDomain',
  'projectId',
  'storageBucket',
  'messagingSenderId',
  'appId'
];

const missingConfigVars = requiredConfigVars.filter(varName => !firebaseConfig[varName]);

if (missingConfigVars.length > 0) {
  console.error('❌ Missing Firebase configuration values:', missingConfigVars);
  console.error('Please check your Firebase configuration.');
} else {
  console.log('✅ All Firebase configuration values are present');
}

// Initialize Firebase
let app, analytics;
try {
  console.log('🚀 Initializing Firebase...');
  app = initializeApp(firebaseConfig);
  console.log('✅ Firebase app initialized successfully');
  
  console.log('📊 Initializing Firebase Analytics...');
  analytics = getAnalytics(app);
  console.log('✅ Firebase Analytics initialized successfully');
  
  console.log('🎉 Firebase setup completed successfully!');
} catch (error) {
  console.error('❌ Firebase initialization failed:', error);
  console.error('Please check your Firebase configuration and environment variables.');
}

export { app, analytics };