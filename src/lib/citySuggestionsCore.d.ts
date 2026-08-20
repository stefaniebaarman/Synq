export function getCachedCitySuggestions(
  senderLocationLabel: string,
  category: string,
  cityDataById: Record<string, { categories?: Record<string, unknown[]> }>,
  registry: Array<{ cityId: string; match: (labels: string[]) => boolean }>,
  excludeOrOptions?:
    | string[]
    | {
        avoidNames?: string[];
        excludeNames?: string[];
        recentBatchKeys?: string[];
        count?: number;
      }
): Array<{
  name: string;
  address?: string;
  location?: string;
  imageUrl?: string | null;
  why?: string;
}> | null;

export function suggestionBatchKey(names: string[]): string;

export function resolveCityId(
  senderLocationLabel: string,
  registry: Array<{ cityId: string; match: (labels: string[]) => boolean }>
): string | null;

export function allParticipantsHaveCachedCitySuggestions(
  participantLocationLabels: string[],
  registry: Array<{ cityId: string; match: (labels: string[]) => boolean }>
): boolean;

export function matchesArlingtonVa(labels: string[]): boolean;
export function matchesAustinTx(labels: string[]): boolean;
export function matchesBostonMa(labels: string[]): boolean;
export function matchesChicagoIl(labels: string[]): boolean;
export function matchesDeweyBeachDe(labels: string[]): boolean;
export function matchesNewYorkCity(labels: string[]): boolean;
export function matchesPotomacMd(labels: string[]): boolean;
export function matchesSanDiegoCa(labels: string[]): boolean;
export function matchesSeattleWa(labels: string[]): boolean;
export function matchesWashingtonDcMetro(labels: string[]): boolean;
