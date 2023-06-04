import { TouchableOpacity, Image } from 'react-native';
import { Text, View } from '../../components/Themed';
import { NodeGraphWithButton } from '../../components/NodeGraphWithButton';

export default function IntroToAddingConnections({ navigation }: any) {
  return (
    <NodeGraphWithButton text="To SYNQ with people in your network, let's add connections..." button={<View className="items-center mb-8"><TouchableOpacity className="bg-white rounded-md p-4">
      <Text className=" text-black text-base text-center">Add Connections</Text>
    </TouchableOpacity></View>} />
  );
}
