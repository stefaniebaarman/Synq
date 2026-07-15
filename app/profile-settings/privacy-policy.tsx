import StackScreenHeader from "@/src/components/StackScreenHeader";
import PrivacyPolicyContent from "@/src/components/legal/PrivacyPolicyContent";
import { legalDocumentStyles } from "@/src/components/legal/legalDocumentStyles";
import React from "react";
import {
  ScrollView,
  StatusBar,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BG } from "../../constants/Variables";

export default function PrivacyPolicyScreen() {
  return (
    <SafeAreaView style={styles.container} edges={["bottom", "left", "right"]}>
      <StatusBar barStyle="light-content" />
      <StackScreenHeader title="Privacy policy" />
      <ScrollView contentContainerStyle={legalDocumentStyles.scrollContent}>
        <PrivacyPolicyContent />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
});
