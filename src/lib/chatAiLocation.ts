import {
  buildLocationPrompt,
  CHAT_AI_MAX_DISTANCE_KM,
  CHAT_AI_MAX_DISTANCE_MILES,
  formatUserLocationLabel,
  maxPairwiseDistanceKm,
  participantsWithinAiRange,
  uniqueLocationLabels,
} from "./chatAiLocationCore";

export {
  buildLocationPrompt,
  CHAT_AI_MAX_DISTANCE_KM,
  CHAT_AI_MAX_DISTANCE_MILES,
  formatUserLocationLabel,
  maxPairwiseDistanceKm,
  participantsWithinAiRange,
  uniqueLocationLabels,
};

export type ChatAiLocationStatus =
  | "loading"
  | "available"
  | "missing_location"
  | "too_far";
