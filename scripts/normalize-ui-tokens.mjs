import fs from "fs";
import path from "path";

const SKIP = new Set(["node_modules", ".git", "dist", "build"]);
const EXT = new Set([".tsx", ".ts"]);
const SKIP_FILES = new Set([
  "constants/Variables.ts",
  "constants/modalStyles.ts",
  "constants/formScreenStyles.ts",
  "constants/sheetStyles.ts",
  "constants/buttonStyles.ts",
]);

const REPLACEMENTS = [
  [/fontSize:\s*TYPE_SECTION\s*\+\s*2\b/g, "fontSize: TYPE_MODAL_TITLE"],
  [/fontSize:\s*TYPE_BODY\s*\+\s*4\b/g, "fontSize: TYPE_SECTION"],
  [/fontSize:\s*TYPE_BODY\s*\+\s*2\b/g, "fontSize: TYPE_CTA"],
  [/fontSize:\s*TYPE_BODY\s*\+\s*1\b/g, "fontSize: TYPE_SUBHEAD"],
  [/fontSize:\s*TYPE_BODY\s*-\s*1\b/g, "fontSize: TYPE_BUTTON"],
  [/fontSize:\s*TYPE_CAPTION\s*\+\s*2\b/g, "fontSize: TYPE_BUTTON"],
  [/fontSize:\s*TYPE_CAPTION\s*\+\s*1\b/g, "fontSize: TYPE_LEAD"],
  [/fontSize:\s*TYPE_CAPTION\s*-\s*1\b/g, "fontSize: TYPE_FINE"],
  [/fontSize:\s*TYPE_CAPTION\s*-\s*2\b/g, "fontSize: TYPE_MICRO"],
  [/fontSize:\s*15\b/g, "fontSize: TYPE_BUTTON"],
  [/fontSize:\s*18\b/g, "fontSize: TYPE_CTA"],
  [/fontSize:\s*22\b/g, "fontSize: TYPE_MODAL_TITLE"],
  [/fontSize:\s*11\b/g, "fontSize: TYPE_MICRO"],
  [/fontSize:\s*9\b/g, "fontSize: TYPE_NANO"],
  [/fontSize:\s*10\b/g, "fontSize: TYPE_FINE"],
  [/fontSize:\s*13\b/g, "fontSize: TYPE_CAPTION"],
  [/fontSize:\s*14\b/g, "fontSize: TYPE_LEAD"],
  [/fontSize:\s*16\b/g, "fontSize: TYPE_BODY"],
  [/fontSize:\s*17\b/g, "fontSize: TYPE_SUBHEAD"],
  [/fontSize:\s*26\b/g, "fontSize: TYPE_TITLE"],
  [/fontSize:\s*28\b/g, "fontSize: TYPE_TAB_HEADER"],
  [/fontSize:\s*34\b/g, "fontSize: TYPE_DISPLAY"],
  [/fontSize:\s*12\b/g, "fontSize: TYPE_FINE"],
  [/fontSize:\s*20\b/g, "fontSize: TYPE_SECTION"],
  [/fontSize:\s*24\b/g, "fontSize: TYPE_MODAL_TITLE"],
  [/fontSize:\s*30\b/g, "fontSize: TYPE_TITLE"],
  [/fontSize:\s*32\b/g, "fontSize: TYPE_DISPLAY"],
  [/color:\s*["']white["']/g, "color: TEXT"],
  [/color:\s*["']#fff["']/gi, "color: TEXT"],
  [/color:\s*["']black["']/g, "color: ON_ACCENT_TEXT"],
  [/color:\s*["']#061006["']/g, "color: ON_ACCENT_TEXT"],
  [/color:\s*["']#aaa["']/gi, "color: TEXT_MUTED_HEX"],
  [/color:\s*["']#A8A8A8["']/gi, "color: TEXT_MUTED_HEX"],
  [/color:\s*["']#666["']/gi, "color: TEXT_MUTED_DARK"],
  [/color:\s*["']#777["']/gi, "color: TEXT_MUTED_DARKER"],
  [/color:\s*["']#888["']/gi, "color: TEXT_MUTED_LIGHT"],
  [/color:\s*["']#444["']/gi, "color: TEXT_MUTED_FAINT"],
  [/color:\s*["']#ff6b6b["']/gi, "color: DESTRUCTIVE"],
  [/color:\s*["']#FF5A5F["']/gi, "color: DESTRUCTIVE"],
  [/color:\s*["']#FF8A84["']/gi, "color: DESTRUCTIVE"],
  [/backgroundColor:\s*["']#1C1C1E["']/gi, "backgroundColor: SURFACE_ELEVATED"],
  [/backgroundColor:\s*["']#1a1c1e["']/gi, "backgroundColor: SURFACE_ELEVATED"],
  [/backgroundColor:\s*["']#1a1a1a["']/gi, "backgroundColor: SURFACE_LIFTED"],
  [/backgroundColor:\s*["']#0E1012["']/gi, "backgroundColor: SURFACE_RAISED"],
  [/backgroundColor:\s*["']#0A0B0D["']/gi, "backgroundColor: SURFACE_INPUT"],
  [/backgroundColor:\s*["']#0A0A0A["']/gi, "backgroundColor: SURFACE_INPUT"],
  [/backgroundColor:\s*["']#0E0E0E["']/gi, "backgroundColor: SURFACE_INPUT"],
  [/backgroundColor:\s*["']#0E0F11["']/gi, "backgroundColor: SURFACE_PANEL"],
  [/backgroundColor:\s*["']#0c0c0c["']/gi, "backgroundColor: SURFACE_DEEP"],
  [/backgroundColor:\s*["']#050505["']/gi, "backgroundColor: SURFACE_DEEPER"],
  [/backgroundColor:\s*["']#141414["']/gi, "backgroundColor: SHEET_SURFACE"],
  [/backgroundColor:\s*["']#141516["']/gi, "backgroundColor: SHEET_SURFACE"],
  [/backgroundColor:\s*["']#161616["']/gi, "backgroundColor: SURFACE_SHEET_ALT"],
  [/backgroundColor:\s*["']#101214["']/gi, "backgroundColor: SURFACE_INSET"],
  [/backgroundColor:\s*["']#111["']/gi, "backgroundColor: SURFACE_WELL"],
  [/backgroundColor:\s*["']#222["']/gi, "backgroundColor: BORDER_STRONG"],
  [/backgroundColor:\s*["']#333["']/gi, "backgroundColor: BORDER_MUTED"],
  [/backgroundColor:\s*["']#8E8E93["']/gi, "backgroundColor: DISABLED_CTA"],
  [/backgroundColor:\s*["']#34D399["']/gi, "backgroundColor: STATUS_AVAILABLE"],
  [/backgroundColor:\s*["']#eee["']/gi, "backgroundColor: BORDER_MUTED"],
  [/borderColor:\s*["']#1C1C1E["']/gi, "borderColor: SURFACE_ELEVATED"],
  [/borderColor:\s*["']#111["']/gi, "borderColor: SURFACE_WELL"],
  [/borderBottomColor:\s*["']#111["']/gi, "borderBottomColor: SURFACE_WELL"],
  [/shadowColor:\s*["']#34D399["']/gi, "shadowColor: STATUS_AVAILABLE"],
  [/backgroundColor:\s*["']rgba\(0,0,0,0\.75\)["']/g, "backgroundColor: MODAL_OVERLAY"],
  [/backgroundColor:\s*["']rgba\(0,0,0,0\.55\)["']/g, "backgroundColor: SHEET_OVERLAY"],
  [/backgroundColor:\s*["']rgba\(255,255,255,0\.06\)["']/g, "backgroundColor: SURFACE"],
  [/backgroundColor:\s*["']rgba\(255,255,255,0\.08\)["']/g, "backgroundColor: BORDER"],
  [/backgroundColor:\s*["']rgba\(120,255,120,0\.08\)["']/g, "backgroundColor: ACCENT_SELECTED_BG"],
  [/borderColor:\s*["']rgba\(255,255,255,0\.08\)["']/g, "borderColor: BORDER"],
  [/borderColor:\s*["']rgba\(255,255,255,0\.06\)["']/g, "borderColor: GROUP_BORDER"],
  [/borderColor:\s*["']rgba\(255,255,255,0\.22\)["']/g, "borderColor: MUTED3"],
  [/borderColor:\s*["']rgba\(255,255,255,0\.2\)["']/g, "borderColor: MUTED3"],
  [/borderColor:\s*["']rgba\(255,255,255,0\.18\)["']/g, "borderColor: MUTED3"],
  [/borderColor:\s*["']rgba\(255,255,255,0\.12\)["']/g, "borderColor: MUTED3"],
  [/borderColor:\s*["']rgba\(255,255,255,0\.07\)["']/g, "borderColor: GROUP_BORDER"],
  [/borderColor:\s*["']rgba\(255,255,255,0\.05\)["']/g, "borderColor: GROUP_BORDER"],
  [/color:\s*["']rgba\(255,255,255,0\.55\)["']/g, "color: MUTED"],
  [/color:\s*["']rgba\(255,255,255,0\.65\)["']/g, "color: MUTED2"],
  [/color:\s*["']rgba\(255,255,255,0\.62\)["']/g, "color: MUTED2"],
  [/color:\s*["']rgba\(255,255,255,0\.6\)["']/g, "color: MUTED2"],
  [/color:\s*["']rgba\(255,255,255,0\.72\)["']/g, "color: MUTED"],
  [/color:\s*["']rgba\(255,255,255,0\.7\)["']/g, "color: MUTED"],
  [/color:\s*["']rgba\(255,255,255,0\.85\)["']/g, "color: TEXT"],
  [/color:\s*["']rgba\(255,255,255,0\.75\)["']/g, "color: MUTED"],
  [/color:\s*["']rgba\(255,255,255,0\.42\)["']/g, "color: MUTED2"],
  [/color:\s*["']rgba\(255,255,255,0\.40\)["']/g, "color: MUTED3"],
  [/color:\s*["']rgba\(255,255,255,0\.35\)["']/g, "color: MUTED3"],
  [/placeholderTextColor=\{?["']rgba\(255,255,255,0\.35\)["']\}?/g, "placeholderTextColor={MUTED3}"],
  [/placeholderTextColor=\{?["']rgba\(255,255,255,0\.4\)["']\}?/g, "placeholderTextColor={MUTED3}"],
  [/placeholderTextColor=["']rgba\(255,255,255,0\.35\)["']/g, 'placeholderTextColor={MUTED3}'],
  [/placeholderTextColor=["']rgba\(255,255,255,0\.4\)["']/g, 'placeholderTextColor={MUTED3}'],
  [/backgroundColor:\s*["']rgba\(255,255,255,0\.03\)["']/g, "backgroundColor: SURFACE_FAINT"],
  [/backgroundColor:\s*["']rgba\(255,255,255,0\.04\)["']/g, "backgroundColor: SURFACE_SUBTLE"],
  [/backgroundColor:\s*["']rgba\(255,255,255,0\.05\)["']/g, "backgroundColor: SURFACE_MUTED"],
  [/backgroundColor:\s*["']rgba\(255,255,255,0\.07\)["']/g, "backgroundColor: SURFACE_SOFT"],
  [/backgroundColor:\s*["']rgba\(255,255,255,0\.1\)["']/g, "backgroundColor: BORDER_SOFT"],
  [/backgroundColor:\s*["']rgba\(255,255,255,0\.12\)["']/g, "backgroundColor: BORDER_LIGHT"],
  [/backgroundColor:\s*["']rgba\(255,255,255,0\.14\)["']/g, "backgroundColor: BORDER_HAIRLINE"],
  [/backgroundColor:\s*["']rgba\(255,255,255,0\.16\)["']/g, "backgroundColor: DIVIDER"],
  [/backgroundColor:\s*["']rgba\(255,255,255,0\.18\)["']/g, "backgroundColor: DIVIDER"],
  [/backgroundColor:\s*["']rgba\(255,255,255,0\.22\)["']/g, "backgroundColor: DIVIDER_STRONG"],
  [/borderColor:\s*["']rgba\(255,255,255,0\.1\)["']/g, "borderColor: BORDER_SOFT"],
  [/borderColor:\s*["']rgba\(255,255,255,0\.14\)["']/g, "borderColor: BORDER_HAIRLINE"],
  [/borderColor:\s*["']rgba\(255,255,255,0\.15\)["']/g, "borderColor: BORDER_HAIRLINE"],
  [/borderColor:\s*["']rgba\(255,255,255,0\.035\)["']/g, "borderColor: FRIENDS_BORDER"],
  [/borderTopColor:\s*["']rgba\(255,255,255,0\.06\)["']/g, "borderTopColor: GROUP_BORDER"],
  [/borderBottomColor:\s*["']rgba\(255,255,255,0\.06\)["']/g, "borderBottomColor: GROUP_BORDER"],
  [/borderTopColor:\s*["']rgba\(255,255,255,0\.12\)["']/g, "borderTopColor: BORDER_LIGHT"],
  [/borderBottomColor:\s*["']rgba\(255,255,255,0\.12\)["']/g, "borderBottomColor: BORDER_LIGHT"],
  [/color:\s*["']rgba\(255,255,255,0\.45\)["']/g, "color: MUTED2"],
  [/color:\s*["']rgba\(255,255,255,0\.48\)["']/g, "color: MUTED2"],
  [/color:\s*["']rgba\(255,255,255,0\.4\)["']/g, "color: MUTED3"],
  [/color:\s*["']rgba\(255,255,255,0\.52\)["']/g, "color: MUTED"],
  [/color:\s*["']rgba\(255,255,255,0\.5\)["']/g, "color: MUTED"],
  [/color:\s*["']rgba\(255,255,255,0\.88\)["']/g, "color: TEXT"],
  [/placeholderTextColor=["']rgba\(255,255,255,0\.38\)["']/g, 'placeholderTextColor={MUTED3}'],
  [/placeholderTextColor=["']rgba\(255,255,255,0\.32\)["']/g, 'placeholderTextColor={MUTED3}'],
  [/placeholderTextColor=["']#555["']/g, "placeholderTextColor={PLACEHOLDER_DARK}"],
  [/color:\s*["']#888["']/gi, "color: TEXT_MUTED_LIGHT"],
  [/color:\s*["']#999["']/gi, "color: TEXT_MUTED_HEX"],
  [/color:\s*["']#fff["']/gi, "color: TEXT"],
  [/color=["']#fff["']/gi, "color={TEXT}"],
  [/color:\s*["']#FF8A84["']/gi, "color: DESTRUCTIVE"],
  [/color:\s*["']#FF2D55["']/gi, "color: HEART_LIKE"],
  [/color:\s*["']#8B0000["']/g, "color: CHAT_FAILED_SELF"],
  [/color:\s*["']#FFB4B4["']/g, "color: CHAT_FAILED_OTHER"],
  [/color:\s*["']#061006["']/g, "color: ON_ACCENT_TEXT"],
  [/color:\s*["']rgba\(255,138,132,0\.75\)["']/g, "color: DESTRUCTIVE"],
  [/backgroundColor:\s*["']rgba\(0,0,0,0\.72\)["']/g, "backgroundColor: OVERLAY_DARK"],
  [/backgroundColor:\s*["']rgba\(0,0,0,0\.78\)["']/g, "backgroundColor: OVERLAY_HEAVY"],
  [/backgroundColor:\s*["']rgba\(0,0,0,0\.88\)["']/g, "backgroundColor: OVERLAY_SCRIM"],
  [/backgroundColor:\s*["']rgba\(0,0,0,0\.95\)["']/g, "backgroundColor: OVERLAY_FULL"],
  [/backgroundColor:\s*["']rgba\(18,18,18,0\.96\)["']/g, "backgroundColor: OVERLAY_PANEL"],
  [/backgroundColor:\s*["']rgba\(0,255,133,0\.12\)["']/g, "backgroundColor: ACCENT_FILL"],
  [/backgroundColor:\s*["']rgba\(0,255,133,0\.08\)["']/g, "backgroundColor: ACCENT_FILL_SUBTLE"],
  [/backgroundColor:\s*["']rgba\(0,255,133,0\.06\)["']/g, "backgroundColor: ACCENT_FILL_MUTED"],
  [/backgroundColor:\s*["']rgba\(0,255,133,0\.05\)["']/g, "backgroundColor: ACCENT_FILL_MUTED"],
  [/backgroundColor:\s*["']rgba\(0,255,133,0\.04\)["']/g, "backgroundColor: ACCENT_FILL_FAINT"],
  [/backgroundColor:\s*["']rgba\(0,255,133,0\.03\)["']/g, "backgroundColor: ACCENT_FILL_FAINT"],
  [/backgroundColor:\s*["']rgba\(0,255,133,0\.02\)["']/g, "backgroundColor: ACCENT_FILL_WHISPER"],
  [/backgroundColor:\s*["']rgba\(0,255,133,0\.1\)["']/g, "backgroundColor: ACCENT_FILL"],
  [/backgroundColor:\s*["']rgba\(0,255,133,0\.18\)["']/g, "backgroundColor: ACCENT_FILL"],
  [/backgroundColor:\s*["']rgba\(125,255,166,0\.18\)["']/g, "backgroundColor: ACCENT_FILL"],
  [/backgroundColor:\s*["']rgba\(43,255,136,0\.08\)["']/g, "backgroundColor: ACCENT_FILL_SUBTLE"],
  [/backgroundColor:\s*["']rgba\(43,255,136,0\.10\)["']/g, "backgroundColor: ACCENT_FILL_SUBTLE"],
  [/backgroundColor:\s*["']rgba\(52, 211, 153, 0\.12\)["']/g, "backgroundColor: STATUS_AVAILABLE_FILL"],
  [/backgroundColor:\s*["']rgba\(255,69,58,0\.12\)["']/g, "backgroundColor: DESTRUCTIVE_FILL"],
  [/backgroundColor:\s*["']rgba\(255,69,58,0\.06\)["']/g, "backgroundColor: DESTRUCTIVE_FILL_SUBTLE"],
  [/borderColor:\s*["']rgba\(0,255,133,0\.45\)["']/g, "borderColor: ACCENT_BORDER"],
  [/borderColor:\s*["']rgba\(0,255,133,0\.55\)["']/g, "borderColor: ACCENT_BORDER"],
  [/borderColor:\s*["']rgba\(0,255,133,0\.32\)["']/g, "borderColor: ACCENT_SUBTLE"],
  [/borderColor:\s*["']rgba\(0,255,133,0\.28\)["']/g, "borderColor: ACCENT_SUBTLE"],
  [/borderColor:\s*["']rgba\(0,255,133,0\.22\)["']/g, "borderColor: ACCENT_BORDER_SUBTLE"],
  [/borderColor:\s*["']rgba\(0,255,133,0\.2\)["']/g, "borderColor: ACCENT_BORDER_MUTED"],
  [/borderColor:\s*["']rgba\(0,255,133,0\.16\)["']/g, "borderColor: ACCENT_BORDER_MUTED"],
  [/borderColor:\s*["']rgba\(0,255,133,0\.1\)["']/g, "borderColor: ACCENT_BORDER_MUTED"],
  [/borderColor:\s*["']rgba\(125,255,166,0\.6\)["']/g, "borderColor: ACCENT_BORDER"],
  [/borderColor:\s*["']rgba\(43,255,136,0\.35\)["']/g, "borderColor: ACCENT_BORDER"],
  [/borderColor:\s*["']rgba\(43,255,136,0\.22\)["']/g, "borderColor: ACCENT_BORDER_SUBTLE"],
  [/borderColor:\s*["']rgba\(43,255,136,0\.18\)["']/g, "borderColor: ACCENT_BORDER_SUBTLE"],
  [/borderColor:\s*["']rgba\(52, 211, 153, 0\.28\)["']/g, "borderColor: STATUS_AVAILABLE_BORDER"],
  [/borderColor:\s*["']rgba\(255,69,58,0\.45\)["']/g, "borderColor: DESTRUCTIVE_BORDER_STRONG"],
  [/borderColor:\s*["']rgba\(255,69,58,0\.35\)["']/g, "borderColor: DESTRUCTIVE_BORDER"],
  [/borderLeftColor:\s*["']rgba\(0,255,133,0\.45\)["']/g, "borderLeftColor: ACCENT_BORDER"],
  [/borderBottomColor:\s*["']#252525["']/g, "borderBottomColor: BORDER_SUBTLE_HEX"],
  [/borderColor:\s*["']#252525["']/g, "borderColor: BORDER_SUBTLE_HEX"],
  [/borderColor:\s*["']#1B1D20["']/g, "borderColor: BORDER_PANEL"],
  [/borderColor:\s*["']#101214["']/g, "borderColor: SURFACE_INSET"],
  [/backgroundColor:\s*["']#0E1012["']/gi, "backgroundColor: SURFACE_RAISED"],
  [/backgroundColor:\s*["']#0A0B0D["']/gi, "backgroundColor: SURFACE_INPUT"],
  [/color:\s*["']rgba\(0,255,133,0\.88\)["']/g, "color: ACCENT_ICON"],
  [/const PROFILE_SURFACE = "#0A0B0D"/g, "const PROFILE_SURFACE = SURFACE_INPUT"],
  [/const PROFILE_SURFACE_RAISED = "#0E1012"/g, "const PROFILE_SURFACE_RAISED = SURFACE_RAISED"],
  [/const PROFILE_BORDER = "rgba\(255,255,255,0\.035\)"/g, "const PROFILE_BORDER = FRIENDS_BORDER"],
  [/const FIELD_SURFACE = "#0E1012"/g, "const FIELD_SURFACE = SURFACE_RAISED"],
  [/const FIELD_BORDER = "rgba\(255,255,255,0\.18\)"/g, "const FIELD_BORDER = MUTED3"],
  [/const SORT_SURFACE = "#0A0B0D"/g, "const SORT_SURFACE = SURFACE_INPUT"],
  [/const SORT_BORDER = "rgba\(255,255,255,0\.12\)"/g, "const SORT_BORDER = FRIENDS_SEARCH_BORDER"],
  [/const GROUP_SURFACE = "#0E1012"/g, "const GROUP_SURFACE = SURFACE_RAISED"],
  [/const WHEEL_BG = "#050505"/g, "const WHEEL_BG = SURFACE_DEEPER"],
  [/placeholderTextColor="rgba\(255,255,255,0\.25\)"/g, "placeholderTextColor={MUTED3}"],
  [/placeholderTextColor="rgba\(255,255,255,0\.20\)"/g, "placeholderTextColor={MUTED3}"],
  [/<ActivityIndicator color="#061006"/g, "<ActivityIndicator color={ON_ACCENT_TEXT}"],
  [/color="#061006"/g, "color={ON_ACCENT_TEXT}"],
  [/color="#FF2D55"/g, "color={HEART_LIKE}"],
  [/color="#FF8A84"/g, "color={DESTRUCTIVE}"],
  [/color="#999"/g, "color={TEXT_MUTED_HEX}"],
  [/color="#888"/g, "color={TEXT_MUTED_LIGHT}"],
  [/color="#fff"/g, "color={TEXT}"],
  [/color="#333"/g, "color={BORDER_MUTED}"],
  [/borderColor: "#333"/g, "borderColor: BORDER_MUTED"],
  [/borderColor: '#333'/g, "borderColor: BORDER_MUTED"],
  [/borderColor: '#222'/g, "borderColor: BORDER_STRONG"],
  [/color="rgba\(0,255,133,0\.88\)"/g, "color={ACCENT_ICON}"],
  [/borderColor: "rgba\(0,255,133,0\.42\)"/g, "borderColor: ACCENT_BORDER"],
  [/backgroundColor: "rgba\(0,255,133,0\.32\)"/g, "backgroundColor: ACCENT_FILL_STRONG"],
  [/color: "rgba\(255,255,255,0\.2\)"/g, "color: MUTED3"],
  [/color: "rgba\(255,255,255,0\.32\)"/g, "color: MUTED3"],
  [/color: "rgba\(255,255,255,0\.78\)"/g, "color: TEXT_ON_BRIGHT"],
  [/color: "rgba\(255,255,255,0\.82\)"/g, "color: TEXT_ON_BRIGHT"],
  [/color: "rgba\(255,255,255,0\.9\)"/g, "color: TEXT"],
  [/color: "rgba\(255,255,255,0\.3\)"/g, "color: MUTED3"],
  [/color: "rgba\(255,255,255,0\.5\)"/g, "color: MUTED"],
  [/color: "rgba\(255,255,255,0\.48\)"/g, "color: MUTED2"],
  [/backgroundColor: "rgba\(255,255,255,0\.10\)"/g, "backgroundColor: BORDER_SOFT"],
  [/borderColor: "rgba\(255,255,255,0\.10\)"/g, "borderColor: BORDER_SOFT"],
  [/borderColor: "rgba\(255,255,255,0\.35\)"/g, "borderColor: BORDER_LIGHT"],
  [/borderColor: "rgba\(255,255,255,0\.85\)"/g, "borderColor: TEXT_ON_BRIGHT"],
  [/tabBarInactiveTintColor: "rgba\(255,255,255,0\.4\)"/g, "tabBarInactiveTintColor: MUTED3"],
  [/color=\{activePicker === "date" \? ACCENT : "#888"\}/g, 'color={activePicker === "date" ? ACCENT : TEXT_MUTED_LIGHT}'],
  [/color=\{activePicker === "time" \? ACCENT : "#888"\}/g, 'color={activePicker === "time" ? ACCENT : TEXT_MUTED_LIGHT}'],
  [/color=\{timePickerOpen \? ACCENT : "#888"\}/g, "color={timePickerOpen ? ACCENT : TEXT_MUTED_LIGHT}"],
  [/color=\{canGoPrev \? "#fff" : "#333"\}/g, "color={canGoPrev ? TEXT : BORDER_MUTED}"],
  [/sendStatus === "failed" && \{ color: isMe \? "#8B0000" : "#FFB4B4" \}/g, 'sendStatus === "failed" && { color: isMe ? CHAT_FAILED_SELF : CHAT_FAILED_OTHER }'],
  [/colors=\{\["transparent", "rgba\(255,255,255,0\.035\)", "transparent"\]\}/g, 'colors={["transparent", FRIENDS_BORDER, "transparent"]}'],
  [/backgroundColor: "rgba\(125,\s*255,\s*166,\s*0\.30\)"/g, "backgroundColor: DISABLED_ACCENT"],
  [/backgroundColor: "rgba\(125,255,166,0\.30\)"/g, "backgroundColor: DISABLED_ACCENT"],
  [/backgroundColor: "rgba\(125, 255, 166, 0\.06\)"/g, "backgroundColor: DISABLED_ACCENT_SUBTLE"],
  [/backgroundColor: 'rgba\(0,0,0,0\.9\)'/g, "backgroundColor: OVERLAY_NEAR_FULL"],
  [/backgroundColor: "rgba\(0,0,0,0\.45\)"/g, "backgroundColor: OVERLAY_DIM"],
  [/backgroundColor: "rgba\(0,0,0,0\.18\)"/g, "backgroundColor: OVERLAY_DARK"],
  [/shadowColor: "#000"/g, "shadowColor: SHADOW"],
  [/color="rgba\(255,255,255,0\.55\)"/g, "color={MUTED}"],
  [/color: joined \? "rgba\(255,255,255,0\.48\)" : ACCENT/g, "color: joined ? MUTED2 : ACCENT"],
  [/colors=\{\["rgba\(9,10,11,0\)", "rgba\(9,10,11,0\.5\)", BG\]\}/g, 'colors={["rgba(9,10,11,0)", BG_FADE_MID, BG]}'],
  [/"rgba\(9,10,11,0\.88\)"/g, "BG_FADE_HEAVY"],
  [/colors=\{\["rgba\(0,255,133,0\.14\)", "rgba\(0,255,133,0\.03\)", "transparent"\]\}/g, 'colors={[ACCENT_GRADIENT_START, ACCENT_GRADIENT_END, "transparent"]}'],
  [/color: "rgba\(255,255,255,0\.22\)"/g, "color: MUTED3"],
];

const TOKEN_IMPORTS = [
  "TYPE_BUTTON",
  "TYPE_CTA",
  "TYPE_MODAL_TITLE",
  "TYPE_MICRO",
  "TYPE_NANO",
  "TYPE_FINE",
  "TYPE_CAPTION",
  "TYPE_LEAD",
  "TYPE_BODY",
  "TYPE_SUBHEAD",
  "TYPE_TITLE",
  "TYPE_TAB_HEADER",
  "TYPE_DISPLAY",
  "TYPE_SECTION",
  "TEXT",
  "ON_ACCENT_TEXT",
  "DESTRUCTIVE",
  "MUTED",
  "MUTED2",
  "MUTED3",
  "SURFACE",
  "BORDER",
  "GROUP_BORDER",
  "SURFACE_ELEVATED",
  "SURFACE_RAISED",
  "SURFACE_INPUT",
  "SURFACE_DEEP",
  "SURFACE_DEEPER",
  "SURFACE_LIFTED",
  "SURFACE_PANEL",
  "SURFACE_WELL",
  "SURFACE_INSET",
  "SHEET_SURFACE",
  "SURFACE_SHEET_ALT",
  "BORDER_STRONG",
  "BORDER_MUTED",
  "TEXT_MUTED_HEX",
  "TEXT_MUTED_DARK",
  "TEXT_MUTED_DARKER",
  "TEXT_MUTED_LIGHT",
  "TEXT_MUTED_FAINT",
  "MODAL_OVERLAY",
  "SHEET_OVERLAY",
  "DISABLED_CTA",
  "STATUS_AVAILABLE",
  "ACCENT_SELECTED_BG",
  "SURFACE_FAINT",
  "SURFACE_SUBTLE",
  "SURFACE_MUTED",
  "SURFACE_SOFT",
  "BORDER_SOFT",
  "BORDER_LIGHT",
  "BORDER_HAIRLINE",
  "DIVIDER",
  "DIVIDER_STRONG",
  "FRIENDS_BORDER",
  "FRIENDS_SEARCH_BORDER",
  "ACCENT",
  "ACCENT_BORDER",
  "ACCENT_BORDER_SUBTLE",
  "ACCENT_BORDER_MUTED",
  "ACCENT_SUBTLE",
  "ACCENT_FILL",
  "ACCENT_FILL_SUBTLE",
  "ACCENT_FILL_MUTED",
  "ACCENT_FILL_FAINT",
  "ACCENT_FILL_WHISPER",
  "ACCENT_ICON",
  "ACCENT_FILL_STRONG",
  "DESTRUCTIVE_BORDER",
  "DESTRUCTIVE_BORDER_STRONG",
  "DESTRUCTIVE_FILL",
  "DESTRUCTIVE_FILL_SUBTLE",
  "OVERLAY_DARK",
  "OVERLAY_HEAVY",
  "OVERLAY_SCRIM",
  "OVERLAY_FULL",
  "OVERLAY_PANEL",
  "STATUS_AVAILABLE_FILL",
  "STATUS_AVAILABLE_BORDER",
  "BORDER_SUBTLE_HEX",
  "BORDER_PANEL",
  "PLACEHOLDER_DARK",
  "HEART_LIKE",
  "TEXT_ON_BRIGHT",
  "CHAT_FAILED_SELF",
  "CHAT_FAILED_OTHER",
  "DISABLED_ACCENT",
  "DISABLED_ACCENT_SUBTLE",
  "SHADOW",
  "OVERLAY_DIM",
  "OVERLAY_NEAR_FULL",
  "BG_FADE_MID",
  "BG_FADE_HEAVY",
  "ACCENT_GRADIENT_START",
  "ACCENT_GRADIENT_END",
];

function walk(dir, files = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(ent.name)) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, files);
    else if (EXT.has(path.extname(ent.name))) files.push(p);
  }
  return files;
}

function addImports(content, needed) {
  if (!needed.size) return content;
  const importRe = /import\s*\{([^}]+)\}\s*from\s*["']@\/constants\/Variables["'];?/;
  const match = content.match(importRe);
  if (match) {
    const existing = match[1]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const set = new Set([...existing, ...needed]);
    const sorted = [...set].sort();
    const newImport = `import {\n  ${sorted.join(",\n  ")},\n} from "@/constants/Variables";`;
    return content.replace(importRe, newImport);
  }

  const relImportRe = /import\s*\{([^}]+)\}\s*from\s*["'](?:\.\.\/)+constants\/Variables["'];?/;
  const relMatch = content.match(relImportRe);
  if (relMatch) {
    const existing = relMatch[1]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const set = new Set([...existing, ...needed]);
    const sorted = [...set].sort();
    const fromPart = relMatch[0].slice(relMatch[0].indexOf("from"));
    const fromPath = fromPart.match(/from\s*(["'][^"']+["'])/)[1];
    const newImport = `import {\n  ${sorted.join(",\n  ")},\n} from ${fromPath};`;
    return content.replace(relImportRe, newImport);
  }

  const sorted = [...needed].sort();
  const imp = `import {\n  ${sorted.join(",\n  ")},\n} from "@/constants/Variables";\n`;
  const firstImport = content.search(/^import /m);
  if (firstImport >= 0) return content.slice(0, firstImport) + imp + content.slice(firstImport);
  return imp + content;
}

let changed = 0;
for (const file of walk(".")) {
  const rel = file.replace(/\\/g, "/").replace(/^\.\//, "");
  if (SKIP_FILES.has(rel)) continue;

  let content = fs.readFileSync(file, "utf8");
  const orig = content;
  for (const [re, rep] of REPLACEMENTS) {
    content = content.replace(re, rep);
  }
  if (content === orig) continue;

  const needed = new Set();
  for (const t of TOKEN_IMPORTS) {
    if (new RegExp(`\\b${t}\\b`).test(content) && !new RegExp(`\\b${t}\\b`).test(orig)) {
      needed.add(t);
    }
  }
  if (needed.size) content = addImports(content, needed);
  fs.writeFileSync(file, content);
  changed++;
  console.log(rel);
}
console.log(`Updated ${changed} files`);
