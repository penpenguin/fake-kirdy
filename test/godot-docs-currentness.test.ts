import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

const readRepoFile = (relativePath: string): string =>
  readFileSync(join(repoRoot, relativePath), 'utf8');

const listMarkdownFiles = (relativeDir: string): string[] => {
  const dir = join(repoRoot, relativeDir);
  return readdirSync(dir)
    .flatMap((entry) => {
      const absolutePath = join(dir, entry);
      const pathFromRoot = relative(repoRoot, absolutePath);
      if (statSync(absolutePath).isDirectory()) {
        return listMarkdownFiles(pathFromRoot);
      }
      return entry.endsWith('.md') ? [pathFromRoot] : [];
    })
    .sort();
};

describe('Godot docs currentness', () => {
  it('removes obsolete Phaser-era and completed migration docs after their durable facts move into current docs', () => {
    expect(existsSync(join(repoRoot, 'docs', 'design.md'))).toBe(false);
    expect(existsSync(join(repoRoot, 'docs', 'requirements.md'))).toBe(false);
    expect(existsSync(join(repoRoot, 'docs', 'swallow-capture-detach.md'))).toBe(false);
    expect(existsSync(join(repoRoot, 'docs', 'godot-v2', 'migration-plan.md'))).toBe(false);
    expect(existsSync(join(repoRoot, 'docs', 'godot-v2', 'full-migration-execplan.md'))).toBe(false);
    expect(existsSync(join(repoRoot, 'docs', 'godot-v2', 'gameplay-completion-execplan.md'))).toBe(false);
    expect(existsSync(join(repoRoot, 'docs', 'godot-v2', 'legacy-reference-boundary.md'))).toBe(false);
  });

  it('provides current entrypoints for the documentation tree', () => {
    const docsIndex = readRepoFile('docs/README.md');
    const godotIndex = readRepoFile('docs/godot-v2/README.md');
    const readme = readRepoFile('README.md');

    expect(docsIndex).toContain('Godot 4');
    expect(docsIndex).toContain('現行仕様');
    expect(docsIndex).toContain('npm run test:canonical');
    expect(docsIndex).not.toContain('履歴');
    expect(docsIndex).not.toContain('ExecPlan');
    expect(godotIndex).toContain('canonical Godot');
    expect(godotIndex).toContain('Replay and trace');
    expect(godotIndex).toContain('Web export');
    expect(godotIndex).not.toContain('Historical records');
    expect(godotIndex).not.toContain('migration record');
    expect(readme).toContain('docs/README.md');
    expect(readme).toContain('docs/godot-v2/README.md');
    expect(readme).toContain('docs/map-structure.md');
    expect(readme).toContain('npm run check:godot');
  });

  it('keeps current-facing docs from presenting Phaser or the prototype tree as active runtime facts', () => {
    const combinedDocs = listMarkdownFiles('docs')
      .map((pathFromRoot) => `\n# ${pathFromRoot}\n${readRepoFile(pathFromRoot)}`)
      .join('\n');

    expect(combinedDocs).not.toMatch(/Full Godot Migration ExecPlan/i);
    expect(combinedDocs).not.toMatch(/completed migration record/i);
    expect(combinedDocs).not.toMatch(/legacy reference boundary/i);
    expect(combinedDocs).not.toMatch(/Phaser remains the reference/i);
    expect(combinedDocs).not.toMatch(/current Phaser \+ Matter/i);
    expect(combinedDocs).not.toMatch(/src\/game\//);
    expect(combinedDocs).not.toMatch(/prototypes\/godot-v2/);
    expect(combinedDocs).not.toMatch(/HTML5 CanvasとPhaser\.js/);
  });
});
