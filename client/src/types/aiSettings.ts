export type AiTone = "friendly" | "professional" | "concise" | "empathetic";

export interface AiSettings {
  enabled: boolean;
  assistantName: string;
  tone: AiTone;
  greeting: string;
  answerFromFaqsOnly: boolean;
  confidenceThreshold: number;
  escalateAfterFailures: number;
  fallbackMessage: string;
  customInstructions: string;
}

export interface AiSettingsResult {
  settings: AiSettings;
  defaults: AiSettings;
  configured: boolean;
  updatedAt: string | null;
}

export interface AiSettingsFieldError {
  field: string;
  message: string;
}

export const AI_TONES: readonly { value: AiTone; label: string }[] = [
  { value: "friendly", label: "Friendly" },
  { value: "professional", label: "Professional" },
  { value: "concise", label: "Concise" },
  { value: "empathetic", label: "Empathetic" },
];

// Mirrors server/src/constants/aiSettingsConstants.js
export const AI_LIMITS = {
  assistantNameMax: 40,
  greetingMax: 300,
  fallbackMax: 300,
  instructionsMax: 1000,
  confidenceMin: 0,
  confidenceMax: 100,
  escalateMin: 1,
  escalateMax: 10,
} as const;
