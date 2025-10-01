import type Phaser from 'phaser';

type SoundManagerLike = Partial<{
  play(key: string, config?: Phaser.Types.Sound.SoundConfig): Phaser.Sound.BaseSound | false | undefined;
  add(key: string, config?: Phaser.Types.Sound.SoundConfig): Phaser.Sound.BaseSound | undefined;
  setVolume(value: number): void;
  setMute(value: boolean): void;
}>;

type BaseSoundLike = Partial<Phaser.Sound.BaseSound> & { key?: string };

const DEFAULT_MASTER_VOLUME = 0.6;

function clamp01(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  if (value <= 0) {
    return 0;
  }

  if (value >= 1) {
    return 1;
  }

  return value;
}

export class AudioManager {
  private readonly sound: SoundManagerLike;
  private currentBgm?: BaseSoundLike;
  private masterVolume = DEFAULT_MASTER_VOLUME;
  private muted = false;

  constructor(private readonly scene: Phaser.Scene) {
    this.sound = scene.sound ?? {};
    this.sound.setVolume?.(this.masterVolume);
  }

  playSfx(key: string, config?: Phaser.Types.Sound.SoundConfig) {
    this.sound.play?.(key, config);
  }

  playBgm(key: string, config?: Phaser.Types.Sound.SoundConfig) {
    const soundManager = this.sound;
    if (!soundManager.add) {
      return;
    }

    if (this.currentBgm?.key === key) {
      return this.currentBgm;
    }

    this.currentBgm?.stop?.();
    this.currentBgm?.destroy?.();

    const mergedConfig: Phaser.Types.Sound.SoundConfig = {
      loop: true,
      ...config,
      loop: true,
    };

    const bgm = soundManager.add(key, mergedConfig);
    bgm?.play?.();
    this.applyCurrentMuteState(bgm as BaseSoundLike | undefined);
    this.applyCurrentVolume(bgm as BaseSoundLike | undefined);
    this.currentBgm = bgm ?? undefined;

    return this.currentBgm;
  }

  stopBgm() {
    this.currentBgm?.stop?.();
    this.currentBgm?.destroy?.();
    this.currentBgm = undefined;
  }

  setMasterVolume(volume: number) {
    const clamped = clamp01(volume);
    this.masterVolume = clamped;
    this.sound.setVolume?.(clamped);
    this.applyCurrentVolume(this.currentBgm);
  }

  getMasterVolume() {
    return this.masterVolume;
  }

  setMuted(muted: boolean) {
    this.muted = Boolean(muted);
    this.sound.setMute?.(this.muted);
    this.applyCurrentMuteState(this.currentBgm);
  }

  toggleMute() {
    this.setMuted(!this.muted);
  }

  isMuted() {
    return this.muted;
  }

  private applyCurrentVolume(sound?: BaseSoundLike) {
    sound?.setVolume?.(this.masterVolume);
  }

  private applyCurrentMuteState(sound?: BaseSoundLike) {
    sound?.setMute?.(this.muted);
  }
}
