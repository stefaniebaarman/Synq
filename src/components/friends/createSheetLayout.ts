import { useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Cap for create circle / create community sheets. */
export const CREATE_SHEET_HEIGHT_RATIO = 0.94;

/**
 * Scroll body height for the create-community form (fields + cover photo).
 * Kept in sync with CreateCommunityModal field sizes.
 */
const CREATE_COMMUNITY_FORM_BODY_HEIGHT = 544;

/** Header, CTA, and top padding outside the community scroll area. */
const CREATE_SHEET_CHROME_HEIGHT = 16 + 50 + 12 + 48;

export function useCreateSheetLayout() {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const sheetMaxHeight = windowHeight * CREATE_SHEET_HEIGHT_RATIO;
  const paddingBottom = Math.max(24, insets.bottom);
  const matchedSheetHeight = Math.min(
    sheetMaxHeight,
    CREATE_SHEET_CHROME_HEIGHT + paddingBottom + CREATE_COMMUNITY_FORM_BODY_HEIGHT
  );

  return {
    sheetMaxHeight,
    matchedSheetHeight,
    paddingBottom,
    keyboardAvoidStyle: {
      width: "100%" as const,
      maxHeight: "96%" as const,
    },
    /** Content-sized sheet (create community). */
    sheetStyle: {
      paddingBottom,
      maxHeight: sheetMaxHeight,
    },
    /** Same visual height as create community (create circle). */
    matchedSheetStyle: {
      paddingBottom,
      maxHeight: sheetMaxHeight,
      height: matchedSheetHeight,
    },
  };
}
