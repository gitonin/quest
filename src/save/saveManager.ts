import { SAVE_KEY_PREFIX, SAVE_SLOTS, SETTINGS_KEY } from '../core/config';

export interface CharacterSave {
  level: number;
  xp: number;
  hp: number;
  mp: number;
}

export interface SaveData {
  version: number;
  savedAt: number;
  world: number;
  zone: string;
  x: number;
  y: number;
  playTime: number;
  knight: CharacterSave;
  princess: CharacterSave | null;
  wizard: CharacterSave | null;
  inventory: Record<string, number>;
  flags: string[];
}

export interface Settings {
  musicVolume: number;
  sfxVolume: number;
  screenShake: boolean;
  leftHanded: boolean;
}

const SAVE_VERSION = 1;

export const DEFAULT_SETTINGS: Settings = {
  musicVolume: 0.6,
  sfxVolume: 0.8,
  screenShake: true,
  leftHanded: false,
};

/**
 * localStorage-backed saves, three slots plus a settings blob.
 *
 * Every write is wrapped: private browsing and full quotas must never crash the
 * game, they just mean progress is not persisted.
 */
export class SaveManager {
  readonly slots = SAVE_SLOTS;

  key(slot: number): string {
    return `${SAVE_KEY_PREFIX}${slot}`;
  }

  save(slot: number, data: Omit<SaveData, 'version' | 'savedAt'>): boolean {
    const payload: SaveData = { ...data, version: SAVE_VERSION, savedAt: Date.now() };
    try {
      localStorage.setItem(this.key(slot), JSON.stringify(payload));
      return true;
    } catch (err) {
      console.warn('[save] write failed', err);
      return false;
    }
  }

  load(slot: number): SaveData | null {
    try {
      const raw = localStorage.getItem(this.key(slot));
      if (!raw) return null;
      const data = JSON.parse(raw) as SaveData;
      if (data.version !== SAVE_VERSION) return null;
      return data;
    } catch (err) {
      console.warn('[save] read failed', err);
      return null;
    }
  }

  erase(slot: number): void {
    try {
      localStorage.removeItem(this.key(slot));
    } catch {
      /* ignore */
    }
  }

  listSlots(): Array<SaveData | null> {
    return Array.from({ length: SAVE_SLOTS }, (_, i) => this.load(i));
  }

  loadSettings(): Settings {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return { ...DEFAULT_SETTINGS };
      return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  saveSettings(settings: Settings): void {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      /* ignore */
    }
  }
}

export function formatPlayTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}:${m.toString().padStart(2, '0')}`;
}
