import { TouchableOpacity, Image } from 'react-native';
import { Text, View } from './Themed';
import NodeGraph from "../assets/images/NodeGraph.png";

export const NodeGraphWithButton = (props: { text: string, button: JSX.Element }): JSX.Element => {
  return (
    <View className="flex-1 items-center justify-end">
      <View className="justify-between flex-1 p-6 pt-60 pb-8">
        <Text className="text-center text-base">
          {props.text}
        </Text>
        {props.button}
      </View>
      <View className="absolute bottom-36 w-full h-3/4 bg-transparent">
        <Image source={NodeGraph} style={{ width: undefined, height: undefined, flex: 1, resizeMode: 'stretch' }} />
      </View>
    </View >
  );
}
