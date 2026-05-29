import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import ts from 'typescript';

const repoRoot = process.cwd();
const stageRoot = join(repoRoot, 'legacy', 'phaser-reference', 'src', 'game', 'world', 'stages');
const outputPath = join(repoRoot, 'godot', 'levels', 'phaser_stage_manifest.json');
const checkOnly = process.argv.includes('--check');
const sharedScope = collectConstScope(readSourceFile(join(stageRoot, 'procedural.ts')));

const manifest = buildManifest();
const nextManifestText = `${JSON.stringify(manifest, null, 2)}\n`;

if (checkOnly) {
  const currentManifestText = existsSync(outputPath) ? readFileSync(outputPath, 'utf8') : '';
  if (currentManifestText !== nextManifestText) {
    console.error('[phaser:stage-manifest] phaser_stage_manifest.json is out of date; run npm run godot:stage-manifest.');
    process.exit(1);
  }

  console.log(`[phaser:stage-manifest] phaser_stage_manifest.json is up to date; exported ${manifest.stages.length} stages.`);
  process.exit(0);
}

writeFileSync(outputPath, nextManifestText);
console.log(`[phaser:stage-manifest] wrote godot/levels/phaser_stage_manifest.json; exported ${manifest.stages.length} stages.`);

function buildManifest() {
  const stageFiles = readdirSync(stageRoot)
    .filter((fileName) => fileName.endsWith('.ts'))
    .filter((fileName) => !fileName.endsWith('.test.ts'))
    .filter((fileName) => !['index.ts', 'procedural.ts', 'stage-utils.ts'].includes(fileName))
    .sort();

  const stages = stageFiles
    .map((fileName) => readStageDefinition(join(stageRoot, fileName)))
    .filter((stage) => stage !== null)
    .concat(buildRepresentativeProceduralStages())
    .sort((left, right) => left.id.localeCompare(right.id));

  return {
    version: 1,
    generated_from: 'legacy/phaser-reference/src/game/world/stages',
    stages,
  };
}

function buildRepresentativeProceduralStages() {
  const clusters = [
    { cluster: 'forest', count: 5, difficulty: 2 },
    { cluster: 'ice', count: 5, difficulty: 3 },
    { cluster: 'fire', count: 22, difficulty: 3 },
    { cluster: 'ruins', count: 18, difficulty: 2 },
    { cluster: 'sky', count: 18, difficulty: 4 },
    { cluster: 'void', count: 64, difficulty: 1 },
  ];
  const nodes = [];
  let areaIndex = 0;
  let metadataIndex = 10;
  let previousClusterLast;
  let forestEntryNode;
  let iceEntryNode;
  let fireEntryNode;
  let ruinsEntryNode;
  let forestExitNode;
  let iceExitNode;
  let fireExitNode;
  let ruinsExitNode;
  let skyEntryNode;

  for (const blueprint of clusters) {
    const clusterNodes = [];

    for (let index = 0; index < blueprint.count; index += 1) {
      areaIndex += 1;
      const node = {
        id: buildProceduralAreaId(areaIndex),
        cluster: blueprint.cluster,
        difficulty: blueprint.difficulty,
        metadataIndex,
        neighbors: {},
      };

      metadataIndex += 1;
      nodes.push(node);
      clusterNodes.push(node);
    }

    clusterNodes.forEach((node, index) => {
      const previous = clusterNodes[index - 1];
      if (previous !== undefined) {
        node.neighbors.west = previous.id;
        previous.neighbors.east = node.id;
      }
    });

    const firstNode = clusterNodes[0];
    const lastNode = clusterNodes.at(-1);

    if (
      previousClusterLast !== undefined &&
      firstNode !== undefined &&
      !['ice', 'fire', 'ruins', 'sky'].includes(blueprint.cluster)
    ) {
      firstNode.neighbors.north = previousClusterLast.id;
      previousClusterLast.neighbors.south = firstNode.id;
    }

    previousClusterLast = lastNode ?? previousClusterLast;

    if (blueprint.cluster === 'forest') {
      forestEntryNode = forestEntryNode ?? firstNode;
      forestExitNode = lastNode;
    }
    if (blueprint.cluster === 'ice') {
      iceEntryNode = iceEntryNode ?? firstNode;
      iceExitNode = lastNode;
    }
    if (blueprint.cluster === 'fire') {
      fireEntryNode = fireEntryNode ?? firstNode;
      fireExitNode = lastNode;
    }
    if (blueprint.cluster === 'ruins') {
      ruinsEntryNode = ruinsEntryNode ?? firstNode;
      ruinsExitNode = lastNode;
    }
    if (blueprint.cluster === 'sky') {
      skyEntryNode = skyEntryNode ?? firstNode;
    }
  }

  if (forestEntryNode !== undefined) {
    forestEntryNode.neighbors.west = 'forest-area';
  }
  if (iceEntryNode !== undefined) {
    iceEntryNode.neighbors.west = 'ice-area';
  }
  if (fireEntryNode !== undefined) {
    fireEntryNode.neighbors.south = 'fire-area';
  }
  if (ruinsEntryNode !== undefined) {
    ruinsEntryNode.neighbors.south = 'cave-area';
  }
  if (forestExitNode !== undefined) {
    forestExitNode.neighbors.east = 'forest-reliquary';
  }
  if (iceExitNode !== undefined) {
    iceExitNode.neighbors.east = 'ice-reliquary';
  }
  if (fireExitNode !== undefined) {
    fireExitNode.neighbors.east = 'fire-reliquary';
  }
  if (ruinsExitNode !== undefined) {
    ruinsExitNode.neighbors.east = 'ruins-reliquary';
  }
  if (skyEntryNode !== undefined) {
    skyEntryNode.neighbors.south = 'sky-sanctum';
  }

  return nodes.map((node, index) => ({
    id: node.id,
    name: `${capitalize(node.cluster)} Expanse ${index + 1}`,
    source_path: 'legacy/phaser-reference/src/game/world/stages/procedural.ts',
    layout: {
      rows: 12,
      columns: 18,
      tile_size: 32,
    },
    neighbors: node.neighbors,
    metadata: {
      cluster: node.cluster,
      index: node.metadataIndex,
      difficulty: node.difficulty,
    },
    dead_ends: buildProceduralDeadEnds(),
    procedural_generated: true,
  }));
}

function buildProceduralDeadEnds() {
  return [
    { id: 'dead-end-0', column: 2, row: 9, reward: 'health' },
    { id: 'dead-end-1', column: 15, row: 2, reward: 'max-health' },
    { id: 'dead-end-2', column: 9, row: 8, reward: 'revive' },
  ];
}

function buildProceduralAreaId(index) {
  return `labyrinth-${String(index).padStart(3, '0')}`;
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function readStageDefinition(filePath) {
  const sourceFile = readSourceFile(filePath);
  const scope = mergeScopes(sharedScope, collectConstScope(sourceFile));
  const config = findBuildStageDefinitionConfig(sourceFile);

  if (config === null) {
    return null;
  }

  const id = resolveString(getObjectPropertyInitializer(config, 'id'), scope, sourceFile);
  if (id === undefined) {
    throw new Error(`Unable to read stage id from ${filePath}`);
  }

  const layout = resolveLayout(getObjectPropertyInitializer(config, 'layout'), scope, sourceFile);
  const tileSize = resolveNumber(getObjectPropertyInitializer(config, 'tileSize'), scope, sourceFile);
  const metadata = resolvePrimitiveObject(getObjectPropertyInitializer(config, 'metadata'), scope, sourceFile);
  const collectibles = resolvePrimitiveObjectArray(getObjectPropertyInitializer(config, 'collectibles'), scope, sourceFile);
  const deadEnds = resolveDeadEnds(getObjectPropertyInitializer(config, 'deadEndOverrides'), scope, sourceFile);
  const { neighbors, dynamic_neighbors } = resolveNeighbors(getObjectPropertyInitializer(config, 'neighbors'), scope, sourceFile);

  const stage = {
    id,
    name: resolveString(getObjectPropertyInitializer(config, 'name'), scope, sourceFile) ?? id,
    source_path: relative(repoRoot, filePath).replaceAll('\\', '/'),
    layout: {
      rows: layout.length,
      columns: layout.length > 0 ? layout[0].length : 0,
      tile_size: tileSize ?? null,
    },
    neighbors,
    metadata,
  };

  if (collectibles.length > 0) {
    stage.collectibles = collectibles;
  }

  if (deadEnds.length > 0) {
    stage.dead_ends = deadEnds;
  }

  if (Object.keys(dynamic_neighbors).length > 0) {
    stage.dynamic_neighbors = dynamic_neighbors;
  }

  return stage;
}

function readSourceFile(filePath) {
  const sourceText = readFileSync(filePath, 'utf8');
  return ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

function mergeScopes(...scopes) {
  const merged = {
    strings: new Map(),
    numbers: new Map(),
    stringArrays: new Map(),
  };

  for (const scope of scopes) {
    for (const [key, value] of scope.strings) {
      merged.strings.set(key, value);
    }
    for (const [key, value] of scope.numbers) {
      merged.numbers.set(key, value);
    }
    for (const [key, value] of scope.stringArrays) {
      merged.stringArrays.set(key, value);
    }
  }

  return merged;
}

function collectConstScope(sourceFile) {
  const scope = {
    strings: new Map(),
    numbers: new Map(),
    stringArrays: new Map(),
  };

  sourceFile.forEachChild((node) => {
    if (!ts.isVariableStatement(node)) {
      return;
    }

    for (const declaration of node.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.initializer === undefined) {
        continue;
      }

      const name = declaration.name.text;
      const initializer = unwrapExpression(declaration.initializer);

      const stringValue = literalString(initializer);
      if (stringValue !== undefined) {
        scope.strings.set(name, stringValue);
        continue;
      }

      const numberValue = literalNumber(initializer);
      if (numberValue !== undefined) {
        scope.numbers.set(name, numberValue);
        continue;
      }

      if (ts.isArrayLiteralExpression(initializer)) {
        const values = initializer.elements.map((element) => literalString(unwrapExpression(element)));
        if (values.every((value) => value !== undefined)) {
          scope.stringArrays.set(name, values);
        }
      }
    }
  });

  return scope;
}

function findBuildStageDefinitionConfig(sourceFile) {
  let config = null;

  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'buildStageDefinition' &&
      node.arguments.length > 0 &&
      ts.isObjectLiteralExpression(node.arguments[0])
    ) {
      config = node.arguments[0];
      return;
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return config;
}

function resolveLayout(expression, scope, sourceFile) {
  const unwrapped = unwrapExpression(expression);
  if (unwrapped === undefined) {
    return [];
  }

  if (ts.isIdentifier(unwrapped)) {
    return scope.stringArrays.get(unwrapped.text) ?? [];
  }

  if (!ts.isArrayLiteralExpression(unwrapped)) {
    throw new Error(`Unsupported layout expression in ${basename(sourceFile.fileName)}: ${unwrapped.getText(sourceFile)}`);
  }

  return unwrapped.elements.map((element) => {
    const value = literalString(unwrapExpression(element));
    if (value === undefined) {
      throw new Error(`Unsupported layout row in ${basename(sourceFile.fileName)}: ${element.getText(sourceFile)}`);
    }

    return value;
  });
}

function resolveNeighbors(expression, scope, sourceFile) {
  const neighbors = {};
  const dynamic_neighbors = {};
  const unwrapped = unwrapExpression(expression);

  if (unwrapped === undefined) {
    return { neighbors, dynamic_neighbors };
  }

  if (!ts.isObjectLiteralExpression(unwrapped)) {
    throw new Error(`Unsupported neighbors expression in ${basename(sourceFile.fileName)}: ${unwrapped.getText(sourceFile)}`);
  }

  for (const property of unwrapped.properties) {
    if (!ts.isPropertyAssignment(property)) {
      continue;
    }

    const name = propertyName(property.name);
    if (name === undefined) {
      continue;
    }

    const value = resolveString(property.initializer, scope, sourceFile);
    if (value !== undefined) {
      neighbors[name] = value;
    } else {
      dynamic_neighbors[name] = property.initializer.getText(sourceFile);
    }
  }

  return { neighbors, dynamic_neighbors };
}

function resolvePrimitiveObject(expression, scope, sourceFile) {
  const result = {};
  const unwrapped = unwrapExpression(expression);

  if (unwrapped === undefined) {
    return result;
  }

  if (!ts.isObjectLiteralExpression(unwrapped)) {
    throw new Error(`Unsupported object expression in ${basename(sourceFile.fileName)}: ${unwrapped.getText(sourceFile)}`);
  }

  for (const property of unwrapped.properties) {
    if (!ts.isPropertyAssignment(property)) {
      continue;
    }

    const name = propertyName(property.name);
    if (name === undefined) {
      continue;
    }

    const value = resolvePrimitive(property.initializer, scope, sourceFile);
    if (value !== undefined) {
      result[name] = value;
    }
  }

  return result;
}

function resolvePrimitiveObjectArray(expression, scope, sourceFile) {
  const unwrapped = unwrapExpression(expression);
  if (unwrapped === undefined) {
    return [];
  }

  if (!ts.isArrayLiteralExpression(unwrapped)) {
    throw new Error(`Unsupported object array expression in ${basename(sourceFile.fileName)}: ${unwrapped.getText(sourceFile)}`);
  }

  return unwrapped.elements
    .map((element) => {
      const item = unwrapExpression(element);
      if (!ts.isObjectLiteralExpression(item)) {
        throw new Error(`Unsupported object array item in ${basename(sourceFile.fileName)}: ${element.getText(sourceFile)}`);
      }

      return resolvePrimitiveObject(item, scope, sourceFile);
    })
    .filter((item) => Object.keys(item).length > 0);
}

function resolveDeadEnds(expression, scope, sourceFile) {
  return resolvePrimitiveObjectArray(expression, scope, sourceFile).map((deadEnd, index) => ({
    id: `dead-end-${index}`,
    column: deadEnd.column,
    row: deadEnd.row,
    reward: deadEnd.reward ?? 'health',
  }));
}

function resolvePrimitive(expression, scope, sourceFile) {
  const stringValue = resolveString(expression, scope, sourceFile);
  if (stringValue !== undefined) {
    return stringValue;
  }

  const numberValue = resolveNumber(expression, scope, sourceFile);
  if (numberValue !== undefined) {
    return numberValue;
  }

  const unwrapped = unwrapExpression(expression);
  if (unwrapped?.kind === ts.SyntaxKind.TrueKeyword) {
    return true;
  }
  if (unwrapped?.kind === ts.SyntaxKind.FalseKeyword) {
    return false;
  }

  return undefined;
}

function resolveString(expression, scope, sourceFile) {
  const unwrapped = unwrapExpression(expression);
  const value = literalString(unwrapped);
  if (value !== undefined) {
    return value;
  }

  if (unwrapped !== undefined && ts.isIdentifier(unwrapped)) {
    return scope.strings.get(unwrapped.text);
  }

  return undefined;
}

function resolveNumber(expression, scope, sourceFile) {
  const unwrapped = unwrapExpression(expression);
  const value = literalNumber(unwrapped);
  if (value !== undefined) {
    return value;
  }

  if (unwrapped !== undefined && ts.isIdentifier(unwrapped)) {
    return scope.numbers.get(unwrapped.text);
  }

  return undefined;
}

function literalString(expression) {
  if (expression === undefined) {
    return undefined;
  }

  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
    return expression.text;
  }

  return undefined;
}

function literalNumber(expression) {
  if (expression === undefined) {
    return undefined;
  }

  if (ts.isNumericLiteral(expression)) {
    return Number(expression.text);
  }

  if (
    ts.isPrefixUnaryExpression(expression) &&
    expression.operator === ts.SyntaxKind.MinusToken &&
    ts.isNumericLiteral(expression.operand)
  ) {
    return -Number(expression.operand.text);
  }

  return undefined;
}

function getObjectPropertyInitializer(objectLiteral, name) {
  if (objectLiteral === undefined) {
    return undefined;
  }

  for (const property of objectLiteral.properties) {
    if (ts.isPropertyAssignment(property) && propertyName(property.name) === name) {
      return property.initializer;
    }

    if (ts.isShorthandPropertyAssignment(property) && property.name.text === name) {
      return property.name;
    }
  }

  return undefined;
}

function propertyName(name) {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }

  return undefined;
}

function unwrapExpression(expression) {
  let current = expression;
  while (
    current !== undefined &&
    (ts.isAsExpression(current) ||
      ts.isSatisfiesExpression(current) ||
      ts.isParenthesizedExpression(current) ||
      ts.isTypeAssertionExpression(current))
  ) {
    current = current.expression;
  }

  return current;
}
