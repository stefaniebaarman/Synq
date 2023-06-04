import { Text, View } from '../components/Themed';
import { Image } from 'react-native';
import { mockMonaUser } from '../constants/Mocks';
import { SafeAreaView } from 'react-native-safe-area-context';

export function ProfileScreen() {
  const user = mockMonaUser;

  return (
    <SafeAreaView className="flex items-center">
      <Text className="p-4 self-end">Settings</Text>
      <View className='w-3/4 py-12 items-center'>
        <Image className='flex w-28 h-28 rounded-full' source={user.photoUrl} />
        <View className="flex items-center gap-y-2">
          <Text>{user.firstName} {user.lastName}</Text>
          <Text className='text-gray-500'>{user.id}</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
