import { Image, ImageSourcePropType } from 'react-native';
import { Text, View } from './Themed';
import clsx from 'clsx'
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';

export interface Location {
  latitude: number;
  longitude: number;
}

export enum UserStatus {
  Available,
  Unavailable
}

export interface User {
  id: string;
  firstName: string; // TODO: ask Chris to add
  lastName: string; // TODO: ask Chris to add
  photoUrl: ImageSourcePropType | undefined; // TODO: ask Chris to add
  availability: {
    status: UserStatus;
    location: Location;
    memo: string;
  }
}

export interface UserRowProps {
  user: User;
  selected: boolean;
  invited: boolean;
}

export const UserRow = (props: UserRowProps) => {
  return (
    <View className="flex-row gap-4 items-center">
      <View className={clsx("w-5 h-5 rounded-full bg-white", { 'bg-transparent': props.invited, 'bg-synq-accent-light': props.selected, })} />
      <View className="w-16 h-16 rounded-full">
        <Image className="w-16 h-16 rounded-full" source={props.user?.photoUrl} />
        {props.invited &&
          <>
            <View className="w-16 h-16 rounded-full absolute top-0 bg-gray-300 opacity-50" />
            <View className="w-16 h-16 rounded-full absolute top-0 justify-center items-center bg-transparent">
              <FontAwesome5 name="check" size={40} color="white" />
            </View>
          </>}
      </View>
      <View>
        <Text className="text-lg">{`${props.user.firstName} ${props.user.lastName}`}</Text>
        <Text className="text-xs">{props.invited ? "Invite sent" : props.user.id}</Text>
      </View>
    </View>
  )
}