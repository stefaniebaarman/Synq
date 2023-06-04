import { Text, View } from '../components/Themed';
import { FlatList, ListRenderItemInfo, TouchableOpacity } from 'react-native';
import { ChatPreviewRow, ChatPreviewRowProps } from '../components/ChatPreviewRow';
import { mockChats } from '../constants/Mocks';

export function AllChatsScreen({ navigation }: any) {
  const handleChatPress = (item: ChatPreviewRowProps) => {
    navigation.navigate('Chat', { messages: item.messages, users: item.users });
  };

  return (
    <View className='h-full px-4'>
      <Text className='text-center text-white text-xl mt-16 mb-8'>Chats</Text>
      <FlatList
        data={mockChats}
        renderItem={({ item }: ListRenderItemInfo<ChatPreviewRowProps>) => {
          return <TouchableOpacity
            className="p-2"
            onPress={() => { handleChatPress(item) }}>
            <ChatPreviewRow users={item.users} messages={item.messages} />
            <View className="border-b border-solid border-gray-500 w-5/6 self-end" />
          </TouchableOpacity>
        }}
      />
    </View>
  );
}
