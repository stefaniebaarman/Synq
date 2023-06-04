import { Text, View } from '../components/Themed';

export function PreferencesScreen() {
  return (
    <View className="flex-1 justify-center items-center">
      <View className='w-3/4 gap-8 items-center'>
        <Text className='flex text-center mb-12'>Network</Text>
      </View>
    </View>
  );
}
