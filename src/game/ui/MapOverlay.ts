import type Phaser from 'phaser';
import type { AreaExplorationState, AreaId, AreaMetadata } from '../world/AreaManager';

export interface MapAreaSummary {
  id: AreaId;
  name: string;
  discovered: boolean;
  isCurrent: boolean;
  exploration: AreaExplorationState;
}

export class MapOverlay {
  private readonly container?: Phaser.GameObjects.Container;
  private entries: Phaser.GameObjects.Text[] = [];
  private readonly background?: Phaser.GameObjects.Rectangle;
  private visible = false;
  private summaries: MapAreaSummary[] = [];

  constructor(private readonly scene: Phaser.Scene) {
    const { add } = scene;

    if (!add?.container) {
      this.container = undefined;
      this.background = undefined;
      return;
    }

    const width = scene.scale?.width ?? 800;
    const height = scene.scale?.height ?? 600;

    const container = add.container(0, 0);
    container.setScrollFactor?.(0, 0);
    container.setDepth?.(1500);
    container.setVisible?.(false);
    container.setAlpha?.(0);

    const background = add.rectangle?.(width / 2, height / 2, width, height, 0x000000, 0.65);
    if (background) {
      background.setScrollFactor?.(0, 0);
      background.setDepth?.(0);
      background.setOrigin?.(0.5);
      container.add?.(background);
    }

    this.container = container;
    this.background = background;
  }

  update(summaries: MapAreaSummary[]) {
    this.summaries = summaries;
    this.render();
  }

  show() {
    this.visible = true;
    this.container?.setVisible?.(true);
    this.container?.setAlpha?.(1);
  }

  hide() {
    this.visible = false;
    this.container?.setVisible?.(false);
    this.container?.setAlpha?.(0);
  }

  isVisible() {
    return this.visible;
  }

  destroy() {
    this.clearEntries();
    this.background?.destroy?.();
    this.container?.destroy?.();
    this.visible = false;
    this.summaries = [];
  }

  private render() {
    const { add } = this.scene;
    if (!this.container || !add?.text) {
      return;
    }

    this.clearEntries();

    const width = this.scene.scale?.width ?? 800;
    const height = this.scene.scale?.height ?? 600;
    const baseX = width * 0.15;
    const baseY = height * 0.2;
    const lineHeight = 28;

    const container = this.container;
    if (!container) {
      return;
    }

    const createText = add.text;
    if (typeof createText !== 'function') {
      return;
    }

    this.summaries.forEach((summary, index) => {
      const completionPercent = Math.round(summary.exploration.completion * 100);
      const statusLabel = summary.discovered ? `${completionPercent}% explored` : 'Unknown';
      const prefix = summary.isCurrent ? '> ' : '  ';
      const text = createText.call(
        add,
        baseX,
        baseY + index * lineHeight,
        `${prefix}${summary.name} - ${statusLabel}`,
        {
          fontSize: '20px',
          color: summary.discovered ? '#ffffff' : '#888888',
        },
      );

      text.setScrollFactor?.(0, 0);
      text.setDepth?.(10);
      container.add?.(text);
      this.entries.push(text);
    });
  }

  private clearEntries() {
    while (this.entries.length > 0) {
      const entry = this.entries.pop();
      entry?.destroy?.();
    }
  }
}

export function createMapSummaries(
  metadata: AreaMetadata[],
  discoveredIds: AreaId[],
  currentAreaId: AreaId,
  explorationLookup: (areaId: AreaId) => AreaExplorationState,
): MapAreaSummary[] {
  const discovered = new Set(discoveredIds);

  return metadata.map(({ id, name }) => {
    const isDiscovered = discovered.has(id);
    const exploration = isDiscovered
      ? explorationLookup(id)
      : { visitedTiles: 0, totalTiles: 0, completion: 0 } satisfies AreaExplorationState;

    return {
      id,
      name,
      discovered: isDiscovered,
      isCurrent: id === currentAreaId,
      exploration,
    } satisfies MapAreaSummary;
  });
}
