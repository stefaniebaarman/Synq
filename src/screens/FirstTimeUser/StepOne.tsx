
import { TextInput, Text, View, Button } from '../../components/Themed';
import * as React from "react";
import clsx from 'clsx';

export function StepOneScreen({ navigation }: any) {
  const [firstName, setFirstName] = React.useState<string>();
  const [lastName, setLastName] = React.useState<string>();
  const [phoneNumber, setPhoneNumber] = React.useState<string>();
  const [disabled, setDisabled] = React.useState<boolean>();

  // TODO: uncomment this to enable the button
  // React.useEffect(() => {
  //   setDisabled(!firstName || !lastName || !phoneNumber)
  // }, [firstName, lastName, phoneNumber])

  return (
    <View className="flex-1 justify-center">
      <View className='h-2/3 justify-between'>
        <View className='w-full items-center'>
          <Text className='text-lg my-8'>Let's create an account</Text>
          <View className='w-full items-center'>
            <TextInput placeholder="First name" value={firstName} onChangeText={setFirstName} />
            <TextInput placeholder="Last name" value={lastName} onChangeText={setLastName} />
            <TextInput placeholder="Phone number" value={phoneNumber} onChangeText={setPhoneNumber} />
          </View>
        </View>
        <Button text="Continue" disabled={disabled} className={clsx(disabled && 'bg-gray-600')} onPress={() => { navigation.navigate("StepTwo") }} />
      </View>
    </View>
  );
}
