import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as React from 'react';
import { ChatScreen } from '../screens/Chat';
import { AllChatsScreen } from '../screens/AllChats';
import { User } from '../components/UserRow';

const Stack = createNativeStackNavigator();
export function ChatStackNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="All Chats" component={AllChatsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Chat" component={ChatScreen} />
    </Stack.Navigator>
  );
}