import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type Phaser from 'phaser';

import type { GameError } from './ErrorHandler';
import { ErrorHandler } from './ErrorHandler';

describe('ErrorHandler', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('delegates asset load failures to the scene fallback loader', () => {
    const error: GameError = { type: 'ASSET_LOAD_FAILED', resourceKey: 'hero-texture' };
    const loadFallbackAsset = vi.fn();
    const start = vi.fn();

    ErrorHandler.handleGameError(error, {
      loadFallbackAsset,
      scene: { start },
    } as unknown as Phaser.Scene);

    expect(console.error).toHaveBeenCalledWith('[ErrorHandler] game error captured', error);
    expect(loadFallbackAsset).toHaveBeenCalledWith(error);
    expect(start).not.toHaveBeenCalled();
  });

  it('redirects critical game errors back to the menu with a user message', () => {
    const error: GameError = { type: 'CRITICAL_GAME_ERROR', message: 'Unexpected failure' };
    const start = vi.fn();

    ErrorHandler.handleGameError(error, {
      scene: { start },
    } as unknown as Phaser.Scene);

    expect(console.error).toHaveBeenCalledWith('[ErrorHandler] game error captured', error);
    expect(start).toHaveBeenCalledWith('MenuScene', {
      errorMessage: 'Unexpected failure',
    });
  });

  it('falls back to the default critical error message when none is provided', () => {
    const error: GameError = { type: 'CRITICAL_GAME_ERROR' };
    const start = vi.fn();

    ErrorHandler.handleGameError(error, {
      scene: { start },
    } as unknown as Phaser.Scene);

    expect(start).toHaveBeenCalledWith('MenuScene', {
      errorMessage: 'ゲームでエラーが発生しました。メニューに戻ります。',
    });
  });
});
