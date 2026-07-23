/**
 * Safely extracts a human-readable message from an unknown catch value.
 * Avoids `any` in catch blocks while still logging useful error info.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return String(error);
}
