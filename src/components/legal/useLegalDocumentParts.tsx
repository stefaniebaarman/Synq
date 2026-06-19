import React from "react";
import { Text, View } from "react-native";
import { legalDocumentStyles as styles } from "./legalDocumentStyles";

export function useLegalDocumentParts() {
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

  const P = ({ children }: { children: React.ReactNode }) => (
    <Text style={styles.text}>{children}</Text>
  );

  const Bullet = ({ children }: { children: React.ReactNode }) => (
    <View style={styles.bulletRow}>
      <Text style={styles.bulletDot}>•</Text>
      <Text style={styles.bulletText}>{children}</Text>
    </View>
  );

  return { Section, P, Bullet, styles };
}
