import StackScreenHeader from "@/src/components/StackScreenHeader";
import PrivacyPolicyContent from "@/src/components/legal/PrivacyPolicyContent";
import { legalDocumentStyles } from "@/src/components/legal/legalDocumentStyles";
import React from "react";
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
} from "react-native";
import { BG } from "../../constants/Variables";

export default function PrivacyPolicyScreen() {
  return (
    <SafeAreaView style={styles.container}>
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
