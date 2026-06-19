import React, { Component, ErrorInfo, ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  ACCENT,
  BG,
  TEXT,
  TYPE_BODY,
  TYPE_TITLE,
  fonts,
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
            <Text style={styles.btnText}>Try again</Text>
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
    color: TEXT,
    fontFamily: fonts.heavy,
    fontSize: TYPE_TITLE,
    marginBottom: 12,
    textAlign: "center",
  },
  body: {
    color: "rgba(255,255,255,0.65)",
    fontFamily: fonts.medium,
    fontSize: TYPE_BODY,
    textAlign: "center",
    marginBottom: 28,
  },
  btn: {
    backgroundColor: ACCENT,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
  },
  btnText: {
    color: "#090A0B",
    fontFamily: fonts.heavy,
    fontSize: TYPE_BODY,
  },
});
