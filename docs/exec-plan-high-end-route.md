# Central Hub 経由ハイエンドルート移行 ExecPlan

This ExecPlan must be maintained per `.agent/PLANS.md`. Living sections (Progress / Surprises & Discoveries / Decision Log / Outcomes & Retrospective) are mandatory and kept up to date.

## Purpose / Big Picture

Sky Sanctum 以降のハイエンドコンテンツ（Sky Sanctum / Aurora Spire / Starlit Keep / Sky Expanse / Void Expanse）を Goal Sanctum 北扉からのみ到達できるようにし、Central Hub 直通の接続を解除する。プレイヤーは Keystone を 4 つ集めた後、Mirror Corridor→Goal Sanctum→ハイエンド帯へ進入でき、ゴール演出と干渉しない。完了後はテストで新動線が固定され、ビルドが通ることを確認する。

## Progress

- [x] (2025-11-20 00:30Z) ドキュメント更新内容を確認し、本 ExecPlan を作成
- [x] (2025-11-20 01:10Z) 現状調査：AreaManager / stage definitions / CLUSTERS / SaveManager / ドアロック条件の把握
- [x] (2025-11-20 01:35Z) テスト追加（赤）：Goal/Ruins 経路切断、Hub→Sky 新経路、Keystone ロック共有を固定
- [x] (2025-11-20 02:10Z) 実装（緑化）：CentralHub 東扉追加、Sky/Void 起点付け替え、Goal/Ruins からの接続削除、ロック条件拡張
- [x] (2025-11-20 02:35Z) 回帰確認：`npm run test -- --runInBand --silent` パス
- [x] (2025-11-20 03:20Z) レビュー指摘対応：Sky Sanctum の南扉を Hub に戻し、東西枝と整合。テスト再緑化。
- [ ] Outcomes & Retrospective 反映

## Surprises & Discoveries

- Central Hub の D 配置が角部の床構造に依存しており、内側が壁だとドアが生成されない。角内側を床にする必要があった。
- Sky Sanctum 側の南扉を Hub 接続に戻す際、入口方向とスポーン位置がずれると即座に枝エリアへ送られる問題が起きるため、neighbor と entryPoint の組み合わせを方向一致させることが重要。

## Decision Log

- Decision: Sky ハイエンド入口は Goal Sanctum 北扉とし、Mirror Corridor と Keystone ロックを共有。
  Rationale: ゴール演出後にハイエンド帯へ進む導線を一元化し、ハブの混雑を避けるため。
  Date/Author: 2025-11-20 / codex (updated)
- Decision: Ruins Reliquary から Sky/Void への南扉は完全撤去（レイアウトから D も削除）。
  Rationale: 既存マップからの接続を誤認させないため。MapGraph で neighbor 不整合が発覚。
  Date/Author: 2025-11-20 / codex
- Decision: Sky Sanctum の南扉は Hub への往来専用とし、西扉を Starlit Keep、東扉を Aurora Spire に固定。
  Rationale: ハイエンドゲート入場後のスポーンと扉方向を一致させ、枝ステージへの誤遷移を防ぐ。
  Date/Author: 2025-11-20 / codex

## Outcomes & Retrospective

- TDD で赤→緑を通し、`npm run test -- --runInBand --silent` が緑化。Sky/Void の入口を Goal Sanctum 北扉に一本化し、Central Hub 直通接続をデータ・レイアウトともに除去。ハイエンド扉のロック表示も Mirror Corridor と同条件で維持。

## Context and Orientation

- 中心ファイル：`src/game/world/stages/central-hub.ts`（ハブの定義と neighbors/entryPoints）、`src/game/world/stages/sky-sanctum.ts` 他 Sky 固定マップ、`src/game/world/stages/procedural.ts`（CLUSTERS と Sky/Void エントリ ID）、`src/game/world/AreaManager.ts`（AREA_IDS と遷移・ロック処理）、`src/game/state/SaveManager.ts` または同等の初期探索データ保持部。  
- 現状は Goal Sanctum 北扉や Ruins Reliquary 南扉を通じて Sky へ遷移している記述が残っている可能性がある。Central Hub 北中央の新扉を追加し、既存 Sky/Void 連結をそちらに付け替える。
- Keystone 4 個で開放するロック条件が Mirror Corridor 入口に適用されているため、同じ条件で Sky 側新扉も閉じる必要がある。

## Plan of Work

1. コード調査：AreaManager の AREA_IDS とステージ登録、Save 初期状態、door ロック判定（Keystone 数）を確認。Sky/Void への current neighbors/entryPoint を洗い出す。  
2. テスト先行：  
   - Central Hub 北中央扉の neighbors.target が `sky-sanctum` になること。  
   - Goal Sanctum / Ruins Reliquary から Sky/Void への neighbors が存在しないことを明示する。  
   - Keystone 未満の状態で Sky 扉が開かない（既存ロックと同一ロジックを共有）。  
3. 実装：  
   - `central-hub.ts` に Sky 行き扉を追加し、entryPoints/doorBuffer など整合性を確認。  
   - Sky/Starlit/Aurora の south neighbor を `central-hub` 側に向け、Sky Expanse 入口を Sky Sanctum 北へ付け替える。  
   - `procedural.ts` の CLUSTERS 接続を調整し、Ruins → Sky のリンクを除去。Sky/Void 開始地点を新ルートに合わせる。  
   - `SaveManager` 初期探索/ロック解除対象を更新。  
   - AreaManager/Stage 定義の AREA_IDS や helper で不要になった getSkyExpanseEntryId などの呼び出し箇所を整理。  
4. リファクタ＆クリーニング：重複ロジックや不要なエントリを除去し、名前整合を保つ。  
5. 検証：Vitest で追加テストを含め全体実行、必要ならビルドで型整合確認。

## Concrete Steps

- 作業ディレクトリ：`/home/user/repository/fake-kirdy/.worktrees/high-end-content`
- コマンド例（タイミングに応じて更新）  
  - 調査時：`rg "SkyExpanse|sky-sanctum" src`、`rg "goal-sanctum" src/game/world`  
  - テスト実行：`npm run test`  
  - 型確認（必要に応じて）：`npm run typecheck`  
  - ビルド確認（終盤任意）：`npm run build`

## Validation and Acceptance

- 追加したテストが赤→緑になること。  
- `npm run test` が全て成功する。  
- ビルドを実施する場合は `npm run build` が成功する。  
- 仕様上の確認：エリア定義で `central-hub` に Sky 扉が存在し、`goal-sanctum` / `ruins-reliquary` から Sky/Void への neighbors が無いことをデータ上で確認できる。

## Idempotence and Recovery

- データ定義・テスト追加のみのため、`git checkout -- <file>` で個別ロールバック可能。  
- バンドル生成は副作用なし。テスト失敗時は差分ファイルを見て原因箇所を逆順で戻す。

## Artifacts and Notes

- 後で貼るべきログや抜粋が出たらここに追加する。

## Interfaces and Dependencies

- 既存 TypeScript 実装を利用。特別な外部依存追加は不要。  
- Phaser/MapSystem 周辺の API は変更しない前提で、AreaDefinition の neighbors/entryPoints/metadata を更新する。

変更履歴メモ: 初版作成（2025-11-20）。
