export function normalizeFolderPath(input: string): string {
  return input.trim().replace(/^\/+|\/+$/g, '').replace(/\/{2,}/g, '/');
}
