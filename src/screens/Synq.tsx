import { Text, View, ScreenView } from '../components/Themed';
import { TextInput } from 'react-native';
import { RadioButton } from '../components/ButtonGroup';
import * as React from 'react';

const availableTimes = [15, 30, 60];

export function SynqScreen() {
  const [checkedTime, setCheckedTime] = React.useState<number>(availableTimes[0]);
  return (
    <ScreenView className='px-0'>
      <View className='w-3/4 gap-8 items-center'>
        <Text className='flex text-center text-lg py-8'>Welcome, Name</Text>
        <Text className=' text-gray-500 py-20'>tap to Synq</Text>
        <View className='flex flex-row items-center'>
          <Text className='mr-2'>Memo:</Text>
          <TextInput multiline numberOfLines={4} blurOnSubmit editable className=' rounded-lg text-xs px-4 py-4 h-32 bg-white text-black w-full border-2' placeholderTextColor={'gray'} placeholder='Description of what you might wanna do... e.g. Walk? Errands? Grab a drink somewhere?' />
        </View>
        <View className='flex flex-row items-center'>
          <Text>Time available:</Text>
          {availableTimes.map((time) => <RadioButton key={time} value={time} isChecked={checkedTime == time} onPress={() => setCheckedTime(time)} />)}
        </View>
      </View>
    </ScreenView>
  );
}
