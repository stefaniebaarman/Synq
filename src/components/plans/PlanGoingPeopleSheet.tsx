import {
  BG,
  BORDER,
  BORDER_STRONG,
  DEFAULT_AVATAR,
  MODAL_RADIUS,
  TEXT,
  TYPE_BUTTON,
  TYPE_SUBHEAD,
  fonts,
  RADIUS_LG,
  RADIUS_SM,
} from "@/constants/Variables";
import CloseButton from "@/src/components/CloseButton";
import SpringBottomSheet from "@/src/components/sheets/SpringBottomSheet";
import { Image as ExpoImage } from "expo-image";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type PlanGoingPerson = {
  userId: string | null;
  displayName: string;
  imageUrl?: string | null;
};

type Props = {
  visible: boolean;
  planTitle?: string | null;
  people: PlanGoingPerson[];
  onClose: () => void;
  onPressPerson?: (person: PlanGoingPerson) => void;
};

export default function PlanGoingPeopleSheet({
  visible,
  planTitle,
  people,
  onClose,
  onPressPerson,
}: Props) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const sheetHeight = Math.round(windowHeight * 0.7);
  const title = String(planTitle || "").trim() || "this plan";

  return (
    <SpringBottomSheet
      visible={visible}
      onClose={onClose}
      cardStyle={[
        styles.sheet,
        { height: sheetHeight, paddingBottom: Math.max(28, insets.bottom + 12) },
      ]}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Going to {title}</Text>
        <CloseButton onPress={onClose} />
      </View>
      <FlatList
        data={people}
        keyExtractor={(item, index) => item.userId || `person-${index}`}
        style={styles.list}
        renderItem={({ item }) => {
          const avatarUri = item.imageUrl || DEFAULT_AVATAR;
          const row = (
            <View style={styles.row}>
              <View style={styles.avatar}>
                <ExpoImage
                  source={{ uri: avatarUri }}
                  style={styles.avatarImg}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
              </View>
              <Text style={styles.rowName} numberOfLines={1}>
                {item.displayName}
              </Text>
            </View>
          );

          if (!onPressPerson) return row;

          return (
            <Pressable onPress={() => onPressPerson(item)} style={styles.rowPressable}>
              {row}
            </Pressable>
          );
        }}
      />
    </SpringBottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: BG,
    borderRadius: MODAL_RADIUS,
    borderWidth: 1,
    borderColor: BORDER,
    paddingTop: 8,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  title: {
    flex: 1,
    color: TEXT,
    fontFamily: fonts.heavy,
    fontSize: TYPE_SUBHEAD,
    marginRight: 12,
  },
  list: {
    flex: 1,
    paddingHorizontal: 12,
  },
  rowPressable: {
    borderRadius: RADIUS_SM,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: RADIUS_LG,
    backgroundColor: BORDER_STRONG,
    overflow: "hidden",
    marginRight: 12,
  },
  avatarImg: {
    width: 40,
    height: 40,
    borderRadius: RADIUS_LG,
  },
  rowName: {
    flex: 1,
    color: TEXT,
    fontFamily: fonts.medium,
    fontSize: TYPE_BUTTON,
  },
});
