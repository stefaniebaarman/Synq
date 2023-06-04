import { Image } from 'react-native';
import { User } from './UserRow';
import { Text, View } from './Themed';
import clsx from 'clsx';

export interface Message {
  sender: User;
  text: string;
  id: string;
}

export interface MessageRowProps {
  message: Message;
}

export const MessageRow = (props: MessageRowProps): JSX.Element => {
  const myUsername = "msinclair"; // TODO: fetch from api

  return (
    <View className={clsx("items-center my-2 gap-x-4 flex-row px-6", props.message.sender.id === myUsername && "flex-row-reverse self-end")}>
      <Image className="w-12 h-12 rounded-full" source={props.message.sender.photoUrl} />
      <View className={clsx("bg-white p-2 rounded-lg flex-shrink", props.message.sender.id === myUsername && "border-synq-accent-light border-solid border-2")}>
        <Text className='text-black text-xs'>{props.message.text}</Text>
      </View>
    </View >
  );
}
