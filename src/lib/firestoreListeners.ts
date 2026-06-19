/** Ignore expected permission errors after sign-out (listeners tear down asynchronously). */
export function ignoreSnapshotPermissionDenied(error: unknown): void {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : "";
  if (code === "permission-denied") return;
  console.error(error);
}
