import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioManager } from './AudioManager';

type SoundManagerStub = {
  play: ReturnType<typeof vi.fn>;
  add: ReturnType<typeof vi.fn>;
  setVolume: ReturnType<typeof vi.fn>;
  setMute: ReturnType<typeof vi.fn>;
};

type BaseSoundStub = {
  key: string;
  play: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  setVolume: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
};

function createSoundStub(key: string): BaseSoundStub {
  return {
    key,
    play: vi.fn(),
    stop: vi.fn(),
    setVolume: vi.fn(),
    destroy: vi.fn(),
  };
}

describe('AudioManager', () => {
  let soundManager: SoundManagerStub;
  let scene: { sound?: SoundManagerStub };

  beforeEach(() => {
    soundManager = {
      play: vi.fn(),
      add: vi.fn(),
      setVolume: vi.fn(),
      setMute: vi.fn(),
    };

    scene = { sound: soundManager };
  });

  it('plays sound effects through the scene sound manager', () => {
    const audio = new AudioManager(scene as any);

    audio.playSfx('kirdy-inhale', { volume: 0.4 });

    expect(soundManager.play).toHaveBeenCalledWith('kirdy-inhale', { volume: 0.4 });
  });

  it('starts looping background music and stops the previous track', () => {
    const firstTrack = createSoundStub('bgm-main');
    const secondTrack = createSoundStub('bgm-boss');
    soundManager.add
      .mockReturnValueOnce(firstTrack as any)
      .mockReturnValueOnce(secondTrack as any);

    const audio = new AudioManager(scene as any);

    audio.playBgm('bgm-main');
    expect(soundManager.add).toHaveBeenCalledWith('bgm-main', expect.objectContaining({ loop: true }));
    expect(firstTrack.play).toHaveBeenCalled();

    audio.playBgm('bgm-boss');

    expect(firstTrack.stop).toHaveBeenCalled();
    expect(soundManager.add).toHaveBeenLastCalledWith('bgm-boss', expect.objectContaining({ loop: true }));
    expect(secondTrack.play).toHaveBeenCalled();
  });

  it('clamps and persists master volume changes', () => {
    const audio = new AudioManager(scene as any);

    audio.setMasterVolume(0.5);
    expect(soundManager.setVolume).toHaveBeenLastCalledWith(0.5);
    expect(audio.getMasterVolume()).toBe(0.5);

    audio.setMasterVolume(1.4);
    expect(soundManager.setVolume).toHaveBeenLastCalledWith(1);
    expect(audio.getMasterVolume()).toBe(1);

    audio.setMasterVolume(-1);
    expect(soundManager.setVolume).toHaveBeenLastCalledWith(0);
    expect(audio.getMasterVolume()).toBe(0);
  });

  it('toggles the mute state via the sound manager', () => {
    const audio = new AudioManager(scene as any);

    audio.setMuted(true);
    expect(soundManager.setMute).toHaveBeenLastCalledWith(true);
    expect(audio.isMuted()).toBe(true);

    audio.toggleMute();
    expect(soundManager.setMute).toHaveBeenLastCalledWith(false);
    expect(audio.isMuted()).toBe(false);
  });
});
