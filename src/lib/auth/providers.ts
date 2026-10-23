/**
 * Direct Google sign-in for company staff only.
 */
export type GrokProvider = {
  providerId: string;
  label: string;
};

export const GROK_PROVIDERS: readonly GrokProvider[] = [
  { providerId: "google", label: "Google" },
];
