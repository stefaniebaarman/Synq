
import { TextInput, Text, View, Button } from '../../components/Themed';
import * as React from "react";

export function StepTwoScreen({ navigation }: any) {
  const [username, setUsername] = React.useState<string>();
  const [password, setPassword] = React.useState<string>();
  const [confirmPassword, setConfirmPassword] = React.useState<string>();

  return (
    <View className="flex-1 justify-center">
      <View className='h-2/3 justify-between'>
        <View className='w-full items-center'>
          <Text className='text-lg my-8'>Just a couple more steps...</Text>
          <View className='w-full items-center'>
            <TextInput placeholder="Username" value={username} onChangeText={setUsername} />
            <TextInput placeholder="Password" value={password} onChangeText={setPassword} />
            <TextInput placeholder="Confirm password" value={confirmPassword} onChangeText={setConfirmPassword} />
          </View>
        </View>
        <Button text="Get Started" onPress={() => { navigation.replace("Returning") }} />
      </View>
    </View>
  );
}
