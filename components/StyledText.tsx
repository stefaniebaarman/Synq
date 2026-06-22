import { Text, TextProps } from './Themed';
import { fonts } from '@/constants/Variables';

export function MonoText(props: TextProps) {
  return <Text {...props} style={[props.style, { fontFamily: fonts.medium }]} />;
}
