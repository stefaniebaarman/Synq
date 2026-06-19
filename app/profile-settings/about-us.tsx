import StackScreenHeader from "@/src/components/StackScreenHeader";
import React from "react";
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  ACCENT,
  BG,
  BORDER,
  MUTED,
  RADIUS_MD,
  SPACE_3,
  SPACE_4,
  SPACE_5,
  SPACE_6,
  SURFACE,
  TEXT,
  TYPE_BODY,
  TYPE_CAPTION,
  TYPE_CTA,
  TYPE_SECTION,
  fonts,
} from "../../constants/Variables";

export default function AboutUsScreen() {
  const Section = ({
    title,
    children,
  }: {
    title: string;
    children: React.ReactNode;
  }) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <StackScreenHeader title="About us" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Synq</Text>
          <Text style={styles.heroSubtitle}>
            A social tool for spontaneous moments of genuine connection with friends.
          </Text>
        </View>

        <Section title="Our mission">
          <Text style={styles.copyText}>
            Synq is built around one idea: connection over engagement.
          </Text>
          <Text style={styles.copyText}>
            In a fast-paced world with unpredictable schedules, we're overwhelmed by content we
            don't care about, and no one wants to add yet another commitment to their calendar.
          </Text>
          <Text style={styles.copyText}>
            What if technology didn't only connect us, but helped us feel connected? Synq isn't
            just another social app. It's a tool for presence, spontaneity, and real-world
            connection.
          </Text>
          <Text style={styles.copyText}>
            Synq reimagines how people come together—enabling serendipitous moments of authentic
            social fulfillment. Let's Synq.
          </Text>
        </Section>

        <Section title="How Synq works">
          <View style={styles.bullets}>
            <View style={styles.bulletRow}>
              <Text style={styles.bulletDot}>•</Text>
              <Text style={styles.bulletText}>
                Add friends you actually want to see
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <Text style={styles.bulletDot}>•</Text>
              <Text style={styles.bulletText}>
                Share an optional mood, choose who can see you&apos;re free, and
                tap to go Synq active
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <Text style={styles.bulletDot}>•</Text>
              <Text style={styles.bulletText}>
                When friends are active too, select them and tap{" "}
                <Text style={styles.bold}>Start plan</Text> to open a chat and
                coordinate
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <Text style={styles.bulletDot}>•</Text>
              <Text style={styles.bulletText}>
                Post <Text style={styles.bold}>Open plans</Text> on your profile
                for upcoming hangouts friends can join
              </Text>
            </View>
          </View>
        </Section>

        <View style={styles.footerSpace} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  scrollContent: {
    paddingBottom: SPACE_6 + SPACE_3,
    paddingTop: SPACE_3,
  },

  hero: {
    marginHorizontal: SPACE_4 + SPACE_3,
    marginBottom: SPACE_3,
    backgroundColor: SURFACE,
    borderRadius: RADIUS_MD,
    padding: SPACE_4 + 2,
    borderWidth: 1,
    borderColor: BORDER,
  },
  heroTitle: {
    fontSize: TYPE_SECTION,
    fontFamily: fonts.black,
    color: TEXT,
    marginBottom: SPACE_3 - 4,
  },
  heroSubtitle: {
    fontSize: TYPE_BODY - 1,
    fontFamily: fonts.medium,
    color: MUTED,
    lineHeight: 22,
  },

  section: { marginTop: 2 },
  sectionTitle: {
    color: MUTED,
    fontSize: TYPE_CAPTION + 1,
    fontFamily: fonts.medium,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginLeft: SPACE_5 + 1,
    marginBottom: SPACE_3 - 2,
    marginTop: SPACE_3 - 2,
  },
  card: {
    backgroundColor: SURFACE,
    marginHorizontal: SPACE_4 + SPACE_3,
    borderRadius: RADIUS_MD,
    padding: SPACE_4 + 2,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: BORDER,
  },

  copyText: {
    color: TEXT,
    fontFamily: fonts.medium,
    fontSize: TYPE_BODY,
    lineHeight: 24,
    marginBottom: 10,
  },
  bold: { fontFamily: fonts.heavy, color: TEXT },

  bullets: { marginTop: 2 },
  bulletRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 10 },
  bulletDot: { color: ACCENT, marginRight: 10, fontSize: TYPE_CTA, lineHeight: 22 },
  bulletText: {
    color: TEXT,
    fontFamily: fonts.medium,
    fontSize: TYPE_BODY,
    lineHeight: 24,
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },

  footerSpace: { height: SPACE_5 },
});
