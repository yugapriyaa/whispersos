import React, { createContext, useState, useContext, useEffect } from 'react';
import { auth } from './firebaseConfig';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AuthContext = createContext({});

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    let unsubscribe;
    
    try {
      unsubscribe = onAuthStateChanged(auth, async (user) => {
        setUser(user);
        if (user) {
          // Check if user has completed onboarding
          try {
            const onboardingStatus = await AsyncStorage.getItem(`onboarding_${user.uid}`);
            setHasCompletedOnboarding(onboardingStatus === 'completed');
          } catch (error) {
            console.log('Error checking onboarding status:', error);
            setHasCompletedOnboarding(false);
          }
        }
        setLoading(false);
        setAuthError(null);
      }, (error) => {
        console.log('Auth state change error:', error);
        setAuthError(error);
        setLoading(false);
      });
    } catch (error) {
      console.log('Error setting up auth listener:', error);
      setAuthError(error);
      setLoading(false);
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  const signup = async (email, password) => {
    try {
      setAuthError(null);
      console.log('Attempting to create user with email:', email);
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      console.log('User created successfully:', userCredential.user.uid);
      return userCredential.user;
    } catch (error) {
      console.log('Signup error in AuthContext:', error);
      console.log('Error code:', error.code);
      console.log('Error message:', error.message);
      setAuthError(error);
      throw error;
    }
  };

  const login = async (email, password) => {
    try {
      setAuthError(null);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return userCredential.user;
    } catch (error) {
      setAuthError(error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      setAuthError(null);
      await signOut(auth);
    } catch (error) {
      setAuthError(error);
      throw error;
    }
  };

  const completeOnboarding = async () => {
    if (user) {
      try {
        await AsyncStorage.setItem(`onboarding_${user.uid}`, 'completed');
        setHasCompletedOnboarding(true);
      } catch (error) {
        console.log('Error saving onboarding status:', error);
      }
    }
  };

  const value = {
    user,
    loading,
    hasCompletedOnboarding,
    authError,
    signup,
    login,
    logout,
    completeOnboarding
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 