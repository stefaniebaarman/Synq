export type SynqSuggestion = {
  name: string;
  rating?: string;
  imageUrl?: string | null;
  location?: string;
  address?: string;
  lat?: number;
  lng?: number;
  why?: string;
  featured?: boolean;
};
