import { TouchableOpacity, Image } from 'react-native';
import { Text, View } from '../../components/Themed';
import { NodeGraphWithButton } from '../../components/NodeGraphWithButton';

export default function EnableNotifications({ navigation }: any) {
  return (
    <NodeGraphWithButton text="Having your notifications enabled helps avoid missing out on potential connections!" button={<View className="items-center gap-4"><TouchableOpacity className="bg-white rounded-md p-4">
      <Text className=" text-black text-base text-center">Enable Notifications</Text>
    </TouchableOpacity><Text>Skip for now</Text></View>} />
  );
}
