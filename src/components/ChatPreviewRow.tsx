import { Image } from 'react-native';
import { User } from './UserRow';
import { Text, View } from './Themed';
import { Message } from './MessageRow';

export interface ChatPreviewRowProps {
  id?: string;
  users: User[];
  messages: Message[];
}

export const ChatPreviewRow = (props: ChatPreviewRowProps): JSX.Element => {
  return (
    <View className='flex-row gap-x-2'>
      <Image className="w-14 h-14 rounded-full" source={props.users?.[0].photoUrl} />
      <View className='basis-4/5'>
        <Text>{props.users.map((user: User) => user.firstName).join(', ')}</Text>
        <Text className='py-3 text-gray-500 text-xs'>{props.messages?.[0].text}</Text>
      </View>
    </View >
  );
}
