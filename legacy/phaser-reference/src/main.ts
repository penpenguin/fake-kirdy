import { createGame } from './game/createGame';

export function bootstrapGame() {
  const container = document.getElementById('game');
  if (!(container instanceof HTMLElement)) {
    throw new Error('Expected #game container element to bootstrap the game.');
  }

  return createGame(container);
}

bootstrapGame();
