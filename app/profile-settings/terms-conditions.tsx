import StackScreenHeader from "@/src/components/StackScreenHeader";
import TermsContent from "@/src/components/legal/TermsContent";
import { legalDocumentStyles } from "@/src/components/legal/legalDocumentStyles";
import React from "react";
import {
  ScrollView,
  StatusBar,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BG } from "../../constants/Variables";

export default function TermsScreen() {
  return (
    <SafeAreaView style={styles.container} edges={["bottom", "left", "right"]}>
      <StatusBar barStyle="light-content" />
      <StackScreenHeader title="Terms & conditions" />
      <ScrollView contentContainerStyle={legalDocumentStyles.scrollContent}>
        <TermsContent />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
});
