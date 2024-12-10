import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as React from 'react';
import WelcomeScreen from '../screens/FirstTimeUser/Welcome';
import { StepOneScreen } from '../screens/FirstTimeUser/StepOne';
import { StepTwoScreen } from '../screens/FirstTimeUser/StepTwo';
import { CreatePhoneScreen } from '../screens/FirstTimeUser/CreatePhoneScreen';
import { SignInWithEmail } from '../screens/FirstTimeUser/SignInWithEmail';

const FirstTimeUserStack = createNativeStackNavigator();
export function FirstTimeUserNavigator() {
  return (
    <FirstTimeUserStack.Navigator
      screenOptions={{
        headerShown: false,
      }}>
      <FirstTimeUserStack.Screen name="Welcome" component={WelcomeScreen} options={{ headerTitle: "" }} />
      <FirstTimeUserStack.Screen name="StepOne" component={StepOneScreen} options={{ headerTitle: "" }} />
      <FirstTimeUserStack.Screen name="StepTwo" component={StepTwoScreen} options={{ headerTitle: "" }} />
      <FirstTimeUserStack.Screen name="CreatePhoneScreen" component={CreatePhoneScreen} options={{ headerTitle: "" }} />
      <FirstTimeUserStack.Screen name="SignInWithEmail" component={SignInWithEmail} options={{ headerTitle: "" }} />
    </FirstTimeUserStack.Navigator>
  );
}