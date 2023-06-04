import { Text, ScreenView, View } from '../components/Themed';
import GreenArrow from "../assets/images/GreenArrow.png";
import { Image } from 'react-native';
import { FeedScreen } from './Feed';

export function HomeScreen() {
  const SynqActive: boolean = true;

  return (
    SynqActive ?
      <FeedScreen />
      :
      <ScreenView className="justify-end ">
        <View className='items-center'>
          <Text className='flex text-center'>Home is where a list of your currently active connections will appear...</Text>
          <Text className='flex text-center py-14'>Tap the SYNQ button if you're available now</Text>
          <Image source={GreenArrow} />
        </View>
      </ScreenView>

  );
}
