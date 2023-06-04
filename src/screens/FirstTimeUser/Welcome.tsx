import { Button, Text, View } from '../../components/Themed';

export default function WelcomeScreen({ navigation }: any) {
  return (
    <View className="flex-1 justify-center">
      <View className='h-2/3 justify-between items-center'>
        <Text className='text-6xl'>SYNQ</Text>
        <View className="gap-12 w-11/12">
          <Text className='flex text-center'>Welcome to SYNQ, a social tool that connects you with available friends for spontaneous time together.</Text>
          <Text className='flex text-center'>When you're free, tap the button to activate, see which friends are available, and make it happen!</Text>
        </View>
        <Button text="Continue" onPress={() => navigation.navigate('StepOne')} />
      </View>
    </View>
  );
}
