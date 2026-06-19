import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Tabs } from "expo-router";
import React from "react";
import { DeviceEventEmitter, Platform, Pressable, StyleSheet, View } from "react-native";
import { FRIENDS_TAB_PRESS } from "../../src/lib/friendsTabEvents";
import { SYNQ_TAB_LONG_PRESS } from "../../src/lib/synqTabEvents";
import {
    ACCENT,
    SPACE_2,
    SPACE_3,
    SPACE_4,
    SPACE_5,
    TAB_BAR_BG,
    TAB_BAR_FADE_GRADIENT,
    TYPE_CAPTION,
    fonts,
} from "../../constants/Variables";

const TAB_BAR_HEIGHT = Platform.OS === "ios" ? 92 : 74;
/** Gradient extends above the tab bar so content fades smoothly. */
const TAB_BAR_FADE_EXTENSION = Platform.OS === "ios" ? 36 : 30;
const TAB_BAR_ICON_NUDGE = Platform.OS === "ios" ? 4 : 3;

function TabBarBackground() {
  return (
    <LinearGradient
      colors={[...TAB_BAR_FADE_GRADIENT]}
      locations={[0, 0.24, 0.44]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.tabBarGradient}
    />
  );
}

const SYNQ_ICON = require("../../assets/SYNQ-2.png");

export default function TabsLayout() {
  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        headerShown: false,
        tabBarBackground: () => <TabBarBackground />,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: ACCENT,
        tabBarInactiveTintColor: "rgba(255,255,255,0.4)",
        tabBarShowLabel: true,
        tabBarIconStyle: { marginTop: TAB_BAR_ICON_NUDGE },
        tabBarLabelStyle: { fontSize: TYPE_CAPTION, marginBottom: -SPACE_2, fontFamily: fonts.medium, letterSpacing: 0.2 },
      }}
    >
      <Tabs.Screen
        name="friends"
        listeners={{
          tabPress: () => {
            DeviceEventEmitter.emit(FRIENDS_TAB_PRESS);
          },
        }}
        options={{
          title: "Friends",
          tabBarAccessibilityLabel: "Friends",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="index"
        options={{
          title: "",
          lazy: false,
          tabBarShowLabel: true,
          tabBarAccessibilityLabel: "Synq home",
          tabBarButton: (props) => (
            <Pressable
              {...(props as React.ComponentProps<typeof Pressable>)}
              onLongPress={() => DeviceEventEmitter.emit(SYNQ_TAB_LONG_PRESS)}
              delayLongPress={400}
            />
          ),
          tabBarIcon: ({ focused }) => (
            <View style={[styles.synqButton, focused && styles.synqButtonActive]}>
              <View style={[styles.synqButtonInner, focused && styles.synqButtonInnerActive]}>
                <ExpoImage
                  source={SYNQ_ICON}
                  style={[styles.synqIcon, focused && styles.synqIconActive]}
                  contentFit="cover"
                  transition={0}
                  cachePolicy="memory-disk"
                />
              </View>
            </View>
          ),
        }}
      />

      <Tabs.Screen
        name="me"
        options={{
          title: "Me",
          lazy: false,
          tabBarAccessibilityLabel: "Me, profile and settings",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-circle-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: TAB_BAR_HEIGHT + TAB_BAR_FADE_EXTENSION,
  },
  tabBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "transparent",
    borderTopWidth: 0,
    elevation: 0,
    overflow: "visible",
    height: TAB_BAR_HEIGHT,
    paddingBottom: Platform.OS === "ios" ? SPACE_5 : SPACE_3,
    paddingHorizontal: SPACE_4,
  },
  synqButton: {
    width: 66,
    height: 66,
    borderRadius: 33,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Platform.OS === "ios" ? 24 : 14,
    marginTop: TAB_BAR_ICON_NUDGE,
    borderWidth: 0,
    elevation: 6,
  },
  synqButtonInner: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: TAB_BAR_BG,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  synqButtonInnerActive: {
    width: 68,
    height: 68,
    borderRadius: 34,
  },

  synqButtonActive: {
    transform: [{ scale: 1 }],
    borderWidth: 0,
    shadowColor: ACCENT,
    shadowOpacity: 0.36,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },

  synqIcon: {
    width: 100,
    height: 100,
  },
  synqIconActive: {
    width: 104,
    height: 104,
  },
});
