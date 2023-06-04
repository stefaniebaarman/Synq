import {
  View,
  KeyboardAvoidingView,
  TextInput,
  ListRenderItemInfo,
  Platform,
  FlatList
} from 'react-native';
import { User } from '../components/UserRow';
import { Message, MessageRow } from '../components/MessageRow';
import * as React from "react";
import { useHeaderHeight } from '@react-navigation/elements'
import { mockMonaUser } from '../constants/Mocks';

const renderRow = ({ item }: ListRenderItemInfo<Message>) => (
  <MessageRow key={item.id} message={item} />
)

export function ChatScreen({ navigation, route }: any) {
  const { messages, users } = route.params;
  const height = useHeaderHeight()

  const [myMessages, setMyMessages] = React.useState<Message[]>(messages);

  React.useLayoutEffect(() => {
    navigation.setOptions({
      title: users.map((user: User) => user.firstName).join(', ')
    })
  }, [navigation, messages])

  const [message, setMessage] = React.useState<string>('');

  return (
    <View className='flex-1'>
      <View className={"flex-1 mt-6"} style={{ paddingBottom: height }}>
        <FlatList
          data={myMessages}
          keyExtractor={(message: Message) => message.id}
          renderItem={renderRow}
        />
      </View >
      <KeyboardAvoidingView style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={height}>
        <TextInput
          className='w-full h-12 bg-gray-600 p-3'
          multiline
          blurOnSubmit
          value={message}
          onChangeText={setMessage}
          onSubmitEditing={() => {
            setMyMessages([...myMessages, { sender: mockMonaUser, text: message, id: message }])
            setMessage("")
          }}
          placeholderTextColor='gray'
          placeholder='Send a message'
          underlineColorAndroid='transparent'
        />
      </KeyboardAvoidingView>
    </View>
  );
}