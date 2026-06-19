import {
  geocodePlace,
  haversineKm,
  resolveOriginCoords,
  userOriginFromProfile,
} from "./friendDistance";
import { userHasLocation } from "./userProfile";

import {
  buildLocationPrompt,
  CHAT_AI_MAX_DISTANCE_MILES,
  maxPairwiseDistanceKm,
  participantsWithinAiRange,
  uniqueLocationLabels,
} from "./chatAiLocationCore";

export {
  buildLocationPrompt,
  CHAT_AI_MAX_DISTANCE_MILES,
  maxPairwiseDistanceKm,
  participantsWithinAiRange,
  uniqueLocationLabels,
};
export { formatUserLocationLabel } from "./chatAiLocationCore";

export type ChatAiLocationStatus =
  | "loading"
  | "available"
  | "missing_location"
  | "too_far";

export type ChatAiLocationAssessment = {
  status: Exclude<ChatAiLocationStatus, "loading">;
  locationPrompt: string;
};

async function resolveParticipantCoords(
  data: Record<string, unknown>
): Promise<{ lat: number; lng: number } | null> {
  const { myCoords, myCityLabel } = userOriginFromProfile(data);
  if (myCoords) return myCoords;
  if (!myCityLabel.trim()) return null;
  return geocodePlace(myCityLabel);
}

export async function assessChatParticipantsForAi(
  participantData: Record<string, unknown>[]
): Promise<ChatAiLocationAssessment> {
  if (
    participantData.length === 0 ||
    !participantData.every((data) => userHasLocation(data))
  ) {
    return { status: "missing_location", locationPrompt: "" };
  }

  const coordsList = await Promise.all(
    participantData.map((data) => resolveParticipantCoords(data))
  );

  if (coordsList.some((coords) => !coords)) {
    return { status: "missing_location", locationPrompt: "" };
  }

  const resolved = coordsList as Array<{ lat: number; lng: number }>;
  const maxKm = maxPairwiseDistanceKm(resolved, haversineKm);

  if (!participantsWithinAiRange(maxKm)) {
    return { status: "too_far", locationPrompt: "" };
  }

  const locationPrompt = buildLocationPrompt(
    uniqueLocationLabels(participantData)
  );
  if (!locationPrompt) {
    return { status: "missing_location", locationPrompt: "" };
  }

  return { status: "available", locationPrompt };
}
