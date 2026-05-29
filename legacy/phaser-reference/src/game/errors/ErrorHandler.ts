import type Phaser from 'phaser';

export type GameErrorType = 'ASSET_LOAD_FAILED' | 'CRITICAL_GAME_ERROR' | (string & {});

export interface GameError {
  type: GameErrorType;
  message?: string;
  resourceKey?: string;
  [key: string]: unknown;
}

export type ErrorHandlingScene = Phaser.Scene & {
  loadFallbackAsset?: (error: GameError | unknown) => void;
};

const MENU_SCENE_KEY = 'MenuScene';
export const DEFAULT_CRITICAL_ERROR_MESSAGE = 'ゲームでエラーが発生しました。メニューに戻ります。';

export class ErrorHandler {
  static handleGameError(error: GameError | unknown, scene: ErrorHandlingScene): void {
    console.error('[ErrorHandler] game error captured', error);

    const normalized = this.normalizeError(error);

    if (normalized.type === 'ASSET_LOAD_FAILED') {
      this.invokeFallback(scene, normalized);
      return;
    }

    this.routeToMenu(scene, normalized);
  }

  private static normalizeError(error: GameError | unknown): GameError {
    if (error && typeof error === 'object') {
      const candidate = error as Partial<GameError> & { type?: unknown; message?: unknown };
      if (typeof candidate.type === 'string') {
        const message = typeof candidate.message === 'string' ? candidate.message : undefined;
        return {
          ...(error as Record<string, unknown>),
          type: candidate.type,
          message,
        } as GameError;
      }
    }

    if (error instanceof Error) {
      return {
        type: 'CRITICAL_GAME_ERROR',
        message: error.message,
      } satisfies GameError;
    }

    return {
      type: 'CRITICAL_GAME_ERROR',
    } satisfies GameError;
  }

  private static invokeFallback(scene: ErrorHandlingScene, error: GameError): void {
    if (typeof scene.loadFallbackAsset === 'function') {
      scene.loadFallbackAsset(error);
    }
  }

  private static routeToMenu(scene: ErrorHandlingScene, error: GameError): void {
    const message = this.buildCriticalMessage(error);

    const scenePlugin = scene.scene;
    scenePlugin?.start?.(MENU_SCENE_KEY, { errorMessage: message });
  }

  private static buildCriticalMessage(error: GameError): string {
    const rawMessage = typeof error.message === 'string' ? error.message.trim() : '';

    if (rawMessage.length > 0) {
      return rawMessage;
    }

    return DEFAULT_CRITICAL_ERROR_MESSAGE;
  }
}
