import type {
  AreaCollectibleDefinition,
  AreaDefinition,
  AreaDoorDefinition,
  AreaId,
  DeadEndDefinition,
  HealRewardType,
  Vector2,
} from './AreaManager';

export interface SpawnTile {
  column: number;
  row: number;
  x: number;
  y: number;
}

export interface DeadEndHealPlan {
  deadEndId: string;
  position: Vector2;
  reward: HealRewardType;
  spawned: boolean;
}

export interface HealItemInstance {
  id: string;
  position: Vector2;
  reward: HealRewardType;
  consumed: boolean;
}

export class MapSystem {
  private readonly areas = new Map<AreaId, AreaDefinition>();
  private readonly healItems = new Map<AreaId, Map<string, HealItemInstance>>();
  private readonly collectibles = new Map<AreaId, Map<string, CollectibleItemInstance>>();

  constructor(definitions: Iterable<AreaDefinition>) {
    for (const definition of definitions) {
      this.areas.set(definition.id, definition);
    }
  }

  enforceDoorSpawnConstraints(areaId: AreaId, candidates: SpawnTile[], radiusOverride?: number): SpawnTile[] {
    const area = this.areas.get(areaId);
    if (!area || !area.doors || area.doors.length === 0) {
      return candidates;
    }

    const baseRadius = Math.max(1, area.doorBuffer ?? 1);
    const overrideRadius = radiusOverride && radiusOverride > 0 ? radiusOverride : undefined;

    return candidates.filter((candidate) =>
      area.doors!.every((door) => {
        const radius = Math.max(door.safeRadius ?? baseRadius, overrideRadius ?? baseRadius);
        return !isWithinDoorRadius(candidate, door, radius);
      }),
    );
  }

  scatterDeadEndHeals(areaId: AreaId): DeadEndHealPlan[] {
    const area = this.areas.get(areaId);
    if (!area || !area.deadEnds || area.deadEnds.length === 0) {
      this.healItems.delete(areaId);
      return [];
    }
    const items = new Map<string, HealItemInstance>();
    const plans: DeadEndHealPlan[] = area.deadEnds.map((deadEnd) => {
      const instance: HealItemInstance = {
        id: deadEnd.id,
        position: { ...deadEnd.position },
        reward: deadEnd.reward,
        consumed: false,
      };
      items.set(deadEnd.id, instance);
      return {
        deadEndId: deadEnd.id,
        position: { ...deadEnd.position },
        reward: deadEnd.reward,
        spawned: true,
      } satisfies DeadEndHealPlan;
    });

    this.healItems.set(areaId, items);
    return plans;
  }

  getActiveHealItems(areaId: AreaId): HealItemInstance[] {
    const map = this.healItems.get(areaId);
    if (!map) {
      return [];
    }

    return Array.from(map.values()).filter((item) => !item.consumed);
  }

  consumeHeal(areaId: AreaId, healId: string): HealItemInstance | undefined {
    const map = this.healItems.get(areaId);
    const item = map?.get(healId);
    if (!item || item.consumed) {
      return undefined;
    }

    item.consumed = true;
    return { ...item } satisfies HealItemInstance;
  }

  registerCollectibles(areaId: AreaId, isAlreadyCollected?: (itemId: string) => boolean) {
    const area = this.areas.get(areaId);
    if (!area || !area.collectibles || area.collectibles.length === 0) {
      this.collectibles.delete(areaId);
      return [] as CollectibleItemInstance[];
    }

    const instances = new Map<string, CollectibleItemInstance>();
    area.collectibles.forEach((collectible) => {
      instances.set(collectible.id, {
        id: collectible.id,
        position: { ...collectible.position },
        itemId: collectible.itemId,
        collected: Boolean(isAlreadyCollected?.(collectible.itemId)),
      });
    });

    this.collectibles.set(areaId, instances);
    return Array.from(instances.values());
  }

  getActiveCollectibles(areaId: AreaId): CollectibleItemInstance[] {
    const map = this.collectibles.get(areaId);
    if (!map) {
      return [];
    }

    return Array.from(map.values()).filter((item) => !item.collected);
  }

  collectCollectible(areaId: AreaId, collectibleId: string): CollectibleItemInstance | undefined {
    const map = this.collectibles.get(areaId);
    const instance = map?.get(collectibleId);
    if (!instance || instance.collected) {
      return undefined;
    }

    instance.collected = true;
    return { ...instance } satisfies CollectibleItemInstance;
  }
}

function isWithinDoorRadius(tile: SpawnTile, door: AreaDoorDefinition, radius: number): boolean {
  if (radius <= 0) {
    return false;
  }

  const dx = Math.abs(tile.column - door.tile.column);
  const dy = Math.abs(tile.row - door.tile.row);
  const chebyshev = Math.max(dx, dy);
  return chebyshev <= radius;
}

export interface CollectibleItemInstance {
  id: string;
  position: Vector2;
  itemId: string;
  collected: boolean;
}
