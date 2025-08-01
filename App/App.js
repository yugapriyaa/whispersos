import * as React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { AuthProvider, useAuth } from './AuthContext';
import AuthScreen from './AuthScreen';
import LoadingScreen from './LoadingScreen';
import OnboardingScreen from './OnboardingScreen';
import VoiceprintSetupScreen from './VoiceprintSetupScreen';
import HomeScreen from './HomeScreen';

const Stack = createStackNavigator();

function NavigationContent() {
  const { user, loading, hasCompletedOnboarding, authError } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  // If there's an auth error, show auth screen
  if (authError && !user) {
    return (
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Auth" component={AuthScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          // User is not authenticated
          <Stack.Screen name="Auth" component={AuthScreen} />
        ) : !hasCompletedOnboarding ? (
          // User is authenticated but hasn't completed onboarding
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        ) : (
          // User is authenticated and has completed onboarding
          <>
            <Stack.Screen name="VoiceprintSetup" component={VoiceprintSetupScreen} />
            <Stack.Screen name="Home" component={HomeScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NavigationContent />
    </AuthProvider>
  );
}
