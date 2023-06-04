import { View, Text } from "./Themed";
import { TouchableOpacity } from "react-native";
import * as React from "react";
import clsx from "clsx";

export interface RadioButtonProps {
  isChecked: boolean;
  onPress: () => void;
  value: number;

}

export const RadioButton = (props: RadioButtonProps) => {
  return (
    <View style={{ display: "flex", flexDirection: "row", alignItems: "center" }}>
      <TouchableOpacity
        className={clsx("w-6 h-6 mx-3 rounded-full", props.isChecked ? "bg-green-400" : "bg-white")} onPress={props.onPress} />
      <Text>{props.value}</Text>
    </View>
  )
}