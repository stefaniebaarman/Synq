import React, { Component, ErrorInfo, ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  ACCENT,
  BG,
  MUTED2,
  TEXT,
  TYPE_BODY,
  fonts,
  modalBodyText,
  profileNameText,
  primaryButtonText,
} from "../constants/Variables";
import { captureClientError } from "../src/lib/sentryInit";

type Props = { children: ReactNode };

type State = { hasError: boolean; error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (__DEV__) {
      console.error("ErrorBoundary:", error, info.componentStack);
    }
    captureClientError(error, { componentStack: info.componentStack });
  }

  private reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const msg = this.state.error?.message ?? "Something went wrong.";
      return (
        <View style={styles.wrap} accessibilityRole="alert">
          <Text style={styles.title}>Synq hit a snag</Text>
          <Text style={styles.body}>{msg}</Text>
          <Pressable
            onPress={this.reset}
            style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]}
            accessibilityRole="button"
            accessibilityLabel="Try again"
          >
            <Text style={primaryButtonText}>Try again</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: BG,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  title: {
    ...profileNameText,
    textAlign: "center",
    marginBottom: 12,
  },
  body: {
    ...modalBodyText,
    fontFamily: fonts.medium,
    textAlign: "center",
    marginBottom: 28,
  },
  btn: {
    backgroundColor: ACCENT,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
  },
});
