# 敵仕様まとめ

## 1. EnemyManager 基本設定と挙動
- デフォルト設定: `maxActiveEnemies=3`, `enemyClusterLimit=2`, `enemySafetyRadius=96`, `enemySpawnCooldownMs=10000`, `enemyDisperseCooldownMs=400`。クールダウンは `update` 内で減算。
- スポーン: `spawnWabbleBee` / `spawnFrostWabble` / `spawnDrontoDurt` / `spawnGlacioDurt` を提供。`getPlayerPosition` 未指定でも内部の参照を注入し、生成時に `InhaleSystem.addInhalableTarget` と `PhysicsSystem.registerEnemy` へ登録した上でスポーンクールダウンを開始。
- 更新ループ: 破棄済みスプライトは除去。`suspendedEnemies` は非表示かつ速度 0 に固定、カリング範囲外の敵も非表示。アクティブリストが変化すると `InhaleSystem.setInhalableTargets` を再構成。
- サスペンド/解除/消化: `suspendEnemy` / `resumeEnemy` / `consumeEnemy` が吸い込みフローと連動し、`suspendedEnemies` と `enemyBySprite` を介して更新と表示を制御。
- 密集緩和: 安全半径 96 内で `enemyClusterLimit` を超えた敵を `disperseEnemy` がリング状に退避。退避中の敵にはクールダウン（400ms）が付き、`onDisperse` コールバックで新しい基準位置を通知。

## 2. 挙動実装済みの敵
### Wabble Bee 系
- **Wabble Bee**（空中巡回→接近追尾）  
  - 物理: 重力無効、矩形 42×36、スケール 0.65。  
  - 能力/HP: 既定アビリティ `fire`、HP=1。  
  - AI: スポーン X を中心に巡回（半径 64、速度=Kirdy 移動速度×0.4）。プレイヤーが ±160 以内で追尾（速度×1.125）。退避後 2 秒間は追尾を封印。  
  - イベント: 撃破時に `enemy-defeated` を発火。

- **Frost Wabble**（氷属性）  
  - Wabble Bee の色差分。アビリティ `ice`、巡回速度 0.9 倍、追尾速度 = 基準、検知距離 200、薄い青 tint。

### Dronto Durt 系
- **Dronto Durt**（地上突進）  
  - 物理: 重力有効、矩形 48×48、スケール 0.75。  
  - 能力/HP: `sword`、HP=1。  
  - AI: プレイヤーが ±200 以内なら ±方向へ突進（速度=基準×1.125）、範囲外は停止。

- **Glacio Durt**（氷突進）  
  - Dronto の氷版。アビリティ `ice`、検知距離 220、突進速度=基準×0.95、薄い青 tint。

## 3. プレースホルダー敵（AI 未実装）
`PassiveEnemy` による待機型。吸い込み／能力同期用メタデータと形状のみ保持し、将来 AI を差し替える前提。

| 敵タイプ | 既定アビリティ | 特徴 | 既定HP |
| --- | --- | --- | --- |
| vine-hopper | leaf | 重力有効、スケール0.85 | 1 |
| thorn-roller | spike | 重力有効、矩形40×32 | 1 |
| sap-spitter | sticky | 重力有効、矩形32×28 | 1 |
| chill-wisp | ice | 重力無効、スケール0.75 | 1 |
| glacier-golem | guard | 重力有効、矩形48×56、スケール1.1 | 3 |
| frost-archer | ice-arrow | 重力有効、矩形30×46 | 1 |
| ember-imp | fire | 重力無効、スケール0.8 | 1 |
| magma-crab | magma-shield | 重力有効、矩形42×28、スケール0.9 | 1 |
| blaze-strider | dash-fire | 重力有効、矩形40×32、スケール0.95 | 1 |
| stone-sentinel | beam | 重力有効、矩形52×52、スケール1.05 | 3 |
| curse-bat | curse | 重力無効、スケール0.8 | 1 |
| relic-thief | warp | 重力有効、矩形32×36、スケール0.9 | 1 |
| gale-kite | wind | 重力無効、スケール0.85 | 1 |
| nimbus-knight | thunder | 重力無効、矩形42×46、スケール1.0 | 2 |
| prism-wraith | prism | 重力無効、スケール0.9 | 1 |

- いずれも `sprite.data` に `enemyType` と `abilityType` を保持し、撃破時に `enemy-defeated` を発火。吸い込み後の能力変換や HUD 更新フローで利用可能。
- AI 実装時は `createPlaceholderEnemy` の `body`・`ignoreGravity`・`defaultHP` をそのまま活用し、`PassiveEnemy.updateAI` を差し替えるだけでよい。

## 4. ボス（リリクアリ防衛用の大型敵）
リリクアリ部屋で Keystone を守る常設ボス。各バイオーム終端に 1 体ずつ配置し、撃破後に遺物を解放する。

### 4.1 配置と共通仕様
- 配置場所: `forest-reliquary`, `ice-reliquary`, `fire-reliquary`, `ruins-reliquary` の各部屋中央。
- エンカウント条件: 部屋に入った時点でドアロック、ボス HP が 0 になるとロック解除し Keystone をドロップ。
- HP/ダメージ: HP は最低 8。攻撃は Kirdy 基本HPの 2 倍を 3 回受けると瀕死になる火力帯に調整。
- 能力連携: 撃破時に `enemy-defeated` と合わせて `boss-defeated` を発火し、GameScene 側で遺物取得・ロック解除・HUD 更新をトリガーする。
- 吸い込み耐性: `InhaleSystem.addInhalableTarget` には登録しない（吸い込み不可）。代わりにフェーズ移行ギミックを優先。

### 4.2 バイオーム別ボス仕様
| ボスID | バイオーム | コア行動 | 特徴・フェーズ | 既定アビリティ |
| --- | --- | --- | --- | --- |
| guardian-treant | Forest | 根の突き上げ + 稀に種子散弾 | HP50%で移動速度上昇、床トゲ設置 | leaf |
| frost-colossus | Ice | 氷柱落下 + 直線ビーム | HP50%でビーム2連射、足元に滑り氷床 | ice |
| magma-hydra | Fire | 3ヘッド噴炎（扇形） | HP50%で火球ばら撒き、足場を燃焼させ一部崩落 | fire |
| relic-warden | Ruins | 瞬間移動→連続斬撃 | HP50%で分身1体追加、ワープ頻度増加 | sword |

### 4.3 実装メモ
- 型: `BossEnemy`（Enemy を継承）を新設し、`isBoss: true` を data に付与。`InhaleSystem` には登録しない。
- 部屋ロック: GameScene がリリクアリ入室時に `scene.events.emit('boss-encounter-start')`、撃破時に `boss-defeated` を受けてドアを解除し Keystone をスポーン。
- 攻撃テレグラフ: フェーズ切替や大技の前に 0.8〜1.2 秒の予備動作を入れ、ビジュアル／サウンドを合わせる。
- テスト指針: ボス撃破で `boss-defeated` が発火すること、吸い込み対象に登録されないこと、HP50%でフェーズが変わることを Vitest で検証する。
