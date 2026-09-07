import { DEFAULT_MODEL, DEFAULT_SYSTEM_PROMPT } from "@archefict/ai";
import { AiSettings } from "@archefict/schema";
import { type Accessor, createSignal } from "solid-js";

const SETTINGS_KEY = "archefict:settings:v1";

export const DEFAULT_SETTINGS: AiSettings = {
  apiKey: "",
  model: DEFAULT_MODEL,
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
};

export type SettingsStore = {
  settings: Accessor<AiSettings>;
  save: (next: AiSettings) => void;
};

/**
 * Device-owned settings. The API key lives in this browser's localStorage and nowhere
 * else. It is not encrypted at rest yet; the OS keychain arrives with the desktop shell,
 * and a passphrase-wrapped key is the web fallback (ROADMAP Slice 7).
 */
export function createSettingsStore(): SettingsStore {
  const [settings, setSettings] = createSignal<AiSettings>(load());
  return {
    settings,
    save(next) {
      setSettings(next);
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      } catch {
        // Storage blocked: settings last for this session only.
      }
    },
  };
}

function load(): AiSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = AiSettings.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}
