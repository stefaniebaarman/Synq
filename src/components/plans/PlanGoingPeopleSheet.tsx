import {
  BG,
  BORDER,
  BORDER_STRONG,
  DEFAULT_AVATAR,
  TEXT,
  TYPE_BUTTON,
  TYPE_SUBHEAD,
  fonts
} from "@/constants/Variables";
import CloseButton from "@/src/components/CloseButton";
import { Image as ExpoImage } from "expo-image";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

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
  const title = String(planTitle || "").trim() || "this plan";

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
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
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  sheet: {
    backgroundColor: BG,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    borderBottomWidth: 0,
    paddingTop: 16,
    paddingBottom: 28,
    maxHeight: "70%",
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
    paddingHorizontal: 12,
  },
  rowPressable: {
    borderRadius: 12,
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
    borderRadius: 20,
    backgroundColor: BORDER_STRONG,
    overflow: "hidden",
    marginRight: 12,
  },
  avatarImg: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  rowName: {
    flex: 1,
    color: TEXT,
    fontFamily: fonts.medium,
    fontSize: TYPE_BUTTON,
  },
});
