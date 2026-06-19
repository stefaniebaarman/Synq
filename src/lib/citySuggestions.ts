import { arlingtonVaSuggestions } from "../data/citySuggestions/arlington-va";
import { austinTxSuggestions } from "../data/citySuggestions/austin-tx";
import { bostonMaSuggestions } from "../data/citySuggestions/boston-ma";
import { chicagoIlSuggestions } from "../data/citySuggestions/chicago-il";
import { deweyBeachDeSuggestions } from "../data/citySuggestions/dewey-beach-de";
import { newYorkNySuggestions } from "../data/citySuggestions/new-york-ny";
import { potomacMdSuggestions } from "../data/citySuggestions/potomac-md";
import { sanDiegoCaSuggestions } from "../data/citySuggestions/san-diego-ca";
import { seattleWaSuggestions } from "../data/citySuggestions/seattle-wa";
import { washingtonDcSuggestions } from "../data/citySuggestions/washington-dc";
import type { SynqSuggestion } from "./synqSuggestions";

import { formatUserLocationLabel } from "./chatAiLocation";

import {
  allParticipantsHaveCachedCitySuggestions as allParticipantsHaveCachedCitySuggestionsCore,
  getCachedCitySuggestions as getCachedCitySuggestionsCore,
  matchesArlingtonVa,
  matchesAustinTx,
  matchesBostonMa,
  matchesChicagoIl,
  matchesDeweyBeachDe,
  matchesNewYorkCity,
  matchesPotomacMd,
  matchesSanDiegoCa,
  matchesSeattleWa,
  matchesWashingtonDcMetro,
  resolveCityId,
} from "./citySuggestionsCore";

const cityRegistry = [
  {
    cityId: arlingtonVaSuggestions.cityId,
    match: matchesArlingtonVa,
  },
  {
    cityId: austinTxSuggestions.cityId,
    match: matchesAustinTx,
  },
  {
    cityId: bostonMaSuggestions.cityId,
    match: matchesBostonMa,
  },
  {
    cityId: chicagoIlSuggestions.cityId,
    match: matchesChicagoIl,
  },
  {
    cityId: deweyBeachDeSuggestions.cityId,
    match: matchesDeweyBeachDe,
  },
  {
    cityId: newYorkNySuggestions.cityId,
    match: matchesNewYorkCity,
  },
  {
    cityId: potomacMdSuggestions.cityId,
    match: matchesPotomacMd,
  },
  {
    cityId: sanDiegoCaSuggestions.cityId,
    match: matchesSanDiegoCa,
  },
  {
    cityId: seattleWaSuggestions.cityId,
    match: matchesSeattleWa,
  },
  {
    cityId: washingtonDcSuggestions.cityId,
    match: matchesWashingtonDcMetro,
  },
];

const cityDataById = {
  [arlingtonVaSuggestions.cityId]: arlingtonVaSuggestions,
  [austinTxSuggestions.cityId]: austinTxSuggestions,
  [bostonMaSuggestions.cityId]: bostonMaSuggestions,
  [chicagoIlSuggestions.cityId]: chicagoIlSuggestions,
  [deweyBeachDeSuggestions.cityId]: deweyBeachDeSuggestions,
  [newYorkNySuggestions.cityId]: newYorkNySuggestions,
  [potomacMdSuggestions.cityId]: potomacMdSuggestions,
  [sanDiegoCaSuggestions.cityId]: sanDiegoCaSuggestions,
  [seattleWaSuggestions.cityId]: seattleWaSuggestions,
  [washingtonDcSuggestions.cityId]: washingtonDcSuggestions,
};

export function getCachedCitySuggestions(
  senderLocationLabel: string,
  category: string,
  excludeNames: string[] = []
): SynqSuggestion[] | null {
  return getCachedCitySuggestionsCore(
    senderLocationLabel,
    category,
    cityDataById,
    cityRegistry,
    excludeNames
  );
}

export function hasCachedCitySuggestions(senderLocationLabel: string): boolean {
  return resolveCityId(senderLocationLabel, cityRegistry) !== null;
}

export function allParticipantsHaveCachedCitySuggestions(
  participantData: Record<string, unknown>[]
): boolean {
  const labels = participantData.map((data) => formatUserLocationLabel(data));
  return allParticipantsHaveCachedCitySuggestionsCore(labels, cityRegistry);
}
