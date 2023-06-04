import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as React from 'react';
import WelcomeScreen from '../screens/FirstTimeUser/Welcome';
import { StepOneScreen } from '../screens/FirstTimeUser/StepOne';
import { StepTwoScreen } from '../screens/FirstTimeUser/StepTwo';
import { ProfileScreen } from '../screens/Profile';

const ProfileStack = createNativeStackNavigator();
export function ProfileNavigator() {
  return (
    <ProfileStack.Navigator
      screenOptions={{
        headerShown: false,
      }}>
      <ProfileStack.Screen name="All Chats" component={ProfileScreen} options={{ headerShown: false }} />
      <ProfileStack.Screen name="Preferences"
        component={PreferencesScreen} options={{ headerShown: false }} />

    </ProfileStack.Navigator>

  )
}