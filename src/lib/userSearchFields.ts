/** Denormalized search fields for Firestore prefix queries (friend discovery). */
export function buildUserSearchFields(input: {
  displayName?: string;
  firstName?: string;
  lastName?: string;
  email?: string | null;
}): {
  displayNameLower: string;
  searchNameLower: string;
  emailLower: string;
} {
  const displayName = String(input.displayName ?? "").trim();
  const firstName = String(input.firstName ?? "").trim();
  const lastName = String(input.lastName ?? "").trim();
  const email = String(input.email ?? "").trim().toLowerCase();

  const fullName = `${firstName} ${lastName}`.trim();
  const displayNameLower = (displayName || fullName).toLowerCase().replace(/\s+/g, " ");
  const searchNameLower = (fullName || displayName).toLowerCase().replace(/\s+/g, " ");

  return {
    displayNameLower,
    searchNameLower,
    emailLower: email,
  };
}
