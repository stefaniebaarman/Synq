import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as React from 'react';
import { ColorSchemeName } from 'react-native';
import { FirstTimeUserNavigator } from './FirstTimeUserNavigator';
import { ReturningUserStackNavigator } from './ReturningUserStackNavigator';

export interface NavigationProps {
  colorScheme: ColorSchemeName;
  isFirstTimeUser: boolean;
}

const Stack = createNativeStackNavigator();
export default function Navigation(props: NavigationProps) {
  return (
    <NavigationContainer
      theme={props.colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack.Navigator initialRouteName={props.isFirstTimeUser ? "First" : "Returning"}>
        <Stack.Screen name="First" component={FirstTimeUserNavigator} options={{ headerShown: false }} />
        <Stack.Screen name="Returning" component={ReturningUserStackNavigator} options={{ headerShown: false }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}




