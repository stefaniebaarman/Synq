import { Text as DefaultText, View as DefaultView, TextInput as DefaultTextInput, TextProps, ViewProps, TouchableOpacity, TouchableOpacityProps, TextInputProps } from 'react-native';
import Colors from '../constants/Colors';
// import useColorScheme from '../hooks/useColorScheme';

export function useThemeColor(
  colorName: keyof typeof Colors.light & keyof typeof Colors.dark
) {
  // TODO: Remove; testing dark theme first
  // const theme = useColorScheme();
  const theme = "dark"
  return Colors[theme][colorName];
}

export function Text(props: TextProps) {
  const { style, ...otherProps } = props;
  const textColor = useThemeColor('text');

  return <DefaultText style={[{ color: textColor }, { fontFamily: 'JosefinSans_400Regular' }, style]} {...otherProps} />;
}

export function View(props: ViewProps) {
  const { style, ...otherProps } = props;
  const backgroundColor = useThemeColor('background');

  return <DefaultView style={[{ backgroundColor }, style]} {...otherProps} />;
}

export function ScreenView(props: ViewProps) {
  const { style, ...otherProps } = props;

  return <View style={[style]} className={"p-12 flex-1 items-center justify-center"} {...otherProps} />;
}

interface ButtonProps extends TouchableOpacityProps {
  text: string;
}

export function Button(props: ButtonProps) {
  const { style, ...otherProps } = props;
  const buttonBackgroundColor = useThemeColor('text');
  const textColor = useThemeColor('background');

  return (
    <View className="items-center mb-8">
      <TouchableOpacity className="rounded-md py-2 px-12" style={[{ backgroundColor: buttonBackgroundColor }, style]} {...otherProps}>
        <Text className='text-lg' style={[{ color: textColor }]}>{props.text}</Text>
      </TouchableOpacity>
    </View >);

}

export function TextInput(props: TextInputProps) {
  const textColor = useThemeColor('text');

  const { style, ...otherProps } = props;
  return (
    <DefaultTextInput className="w-3/4 border-b-4 border-synq-accent-light m-4" style={[{ color: textColor }]} placeholderTextColor="gray" {...otherProps} />
  );
}
