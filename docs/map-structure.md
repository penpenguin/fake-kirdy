# マップ構成概要

## 固定マップ
| 表示名 | エリアID | 主な役割 | 隣接エリア |
| --- | --- | --- | --- |
| Central Hub | central-hub | ゲーム開始地点。各方向に基幹エリアを接続 | 北: Mirror Corridor / 北西: Ice Area / 北東: Fire Area / 南東: Forest Area / 南西: Cave Area |
| Ice Area | ice-area | 北方エリア。ハブ北西角ルートと接続し、Ice Expanse の入口を提供 | 南東: Central Hub / 東: Ice Expanse 入口 |
| Forest Area | forest-area | ハブ南東角ルート。Forest Expanse サイドルートへの入口 | 北西: Central Hub / 東: Labyrinth-001 |
| Cave Area | cave-area | ハブ南西角ルート。Ruins Expanse メインラインへの入口 | 北東: Central Hub / 北: Ruins Expanse 入口 |
| Fire Area | fire-area | Fire クラスタ入口。Goal Sanctum から切り離され、Fire Expanse へのゲートのみ維持 | 南西: Central Hub / 南: Fire Expanse 入口 |
| Mirror Corridor | mirror-corridor | Central Hub 北扉から侵入するゴール前通路。Goal Sanctum への侵入を制御 | 南: Central Hub / 北: Goal Sanctum |
| Goal Sanctum | goal-sanctum | ゴール判定とスコア集計 | 南: Mirror Corridor / 北: Sky Sanctum |
| Sky Sanctum | sky-sanctum | 空中分岐ハブ | 南: Goal Sanctum / 東: Aurora Spire / 西: Starlit Keep |
| Aurora Spire | aurora-spire | 垂直タワー | 西: Sky Sanctum |
| Starlit Keep | starlit-keep | 水平要塞 | 東: Sky Sanctum |
| Forest Reliquary | forest-reliquary | Forest Expanse 終端の儀式場。森林ルートの最終試練として keystone を守る | 西: Forest Expanse 5 |
| Ice Reliquary | ice-reliquary | Ice Expanse 終端の氷柱神殿。滑走床と狭い足場で keystone を保護 | 西: Ice Expanse 5 |
| Fire Reliquary | fire-reliquary | Fire Expanse 終端の溶岩祭壇。火炎トラップと連続足場で侵入を制限 | 西: Fire Expanse 22 |
| Ruins Reliquary | ruins-reliquary | Ruins Expanse 終端の封印空間。Sky クラスタへのゲート兼 keystone 保管庫 | 西: Ruins Expanse 18 / 南: Sky Expanse 1 |

中央ハブの出入口は北西・北東・南西・南東の四隅に再配置し、北中央の新設扉から Mirror Corridor へ入れるようになりました。これにより Fire Area とは物理的に分離された状態でゴール前通路へ進行できます。Fire Area 側の北扉は撤去され、Goal Sanctum への出入りは Mirror Corridor 経由のみに制限されています。

また、Forest / Ice / Fire / Cave（Ruins）ブランチの終端には固定リリクアリ（`forest-reliquary` / `ice-reliquary` / `fire-reliquary` / `ruins-reliquary`）を新設し、それぞれに「Keystone」系の遺物（`forest-keystone` / `ice-keystone` / `fire-keystone` / `cave-keystone`）を配置しました。これらをすべて集めるまで Central Hub 北扉はロックされ、Mirror Corridor へ進入できません。

Goal Sanctum の北壁には役割の異なる 2 枚の扉を並べています。中央の `goal-door` タイルはリザルト演出専用でマップ遷移を伴わず、右側に追加した通常ドアが Sky Sanctum への遷移を担当します。これによりゴール演出中でもエリア遷移ロジックが干渉せず、ゲーム体験とマップ接続仕様を同時に満たせます。

### Sky Sanctum 拡張ステージ詳細

`goal-sanctum` 北側の扉から接続する天空遺跡帯は 3 ステージ構成で、ホバリング・縦移動ギミックを中心に難易度を引き上げる。

| ステージ ID | 表示名 | 接続 | 主な敵 | ギミック概要 |
| --- | --- | --- | --- | --- |
| `sky-sanctum` | Sky Sanctum | 南: goal-sanctum / 東: aurora-spire / 西: starlit-keep | Frost Wabble, Glacio Durt | 浮遊足場と中央気流で縦移動を生むホバリング導線 |
| `aurora-spire` | Aurora Spire | 西: sky-sanctum | Wabble Bee, Dronto Durt | 螺旋状足場と落下避けトゲ床。上層への縦型タワー |
| `starlit-keep` | Starlit Keep | 東: sky-sanctum | Glacio Durt, Wabble Bee | 時間で開閉するバリア床と狭い横穴による回避ルート |

#### Sky Sanctum (`sky-sanctum`)
- **テーマ:** ゴール聖域の上空に浮かぶ中央広場。気流の吹き上げで縦移動をサポート。
- **ギミック:** マップ中央部に 2 本の細い足場列を配置し、その間を通過するプレイヤーは安全に上層へ移動できる。左右にサブルートを用意して敵配置種類を使い分ける。
- **敵構成:** `frost-wabble`（冷気弾）と `glacio-durt`（突進）を 2:1 で巡回。
- **接続:** 南側の扉を `goal-sanctum` の北出口に連結。東西扉は以下ステージへ接続。

#### Aurora Spire (`aurora-spire`)
- **テーマ:** 極光が差し込む縦長の塔内部。狭い螺旋階段と足場。
- **ギミック:** 最下層にトゲ床、塔内部に 3 層の狭い足場を配置。落下リスクを高めつつ敵を避けながら上昇させる。
- **敵構成:** 機動力の高い `wabble-bee` と直線突進の `dronto-durt` を配置し、縦移動中の被弾リスクを演出。
- **接続:** `sky-sanctum` 東扉のみ。

#### Starlit Keep (`starlit-keep`)
- **テーマ:** 星明かりに照らされた古城の外縁。段差が多く横長。
- **ギミック:** 特定の床タイルを 2 枚化し、一定ラインで段差を越えると上下の床が交互に開閉するようレイアウトする。
- **敵構成:** `glacio-durt` と `wabble-bee` を 1:1 で配置。狭い横穴で追跡されないよう回避ルートを用意。
- **接続:** `sky-sanctum` 西扉のみ。

#### 実装メモ
- `goal-sanctum` 北側扉のタイル座標 (`column: 14`, `row: 1`) を `sky-sanctum` に遷移させる。
- 新ステージを `STAGE_DEFINITIONS` に追加し、`AreaManager.AREA_IDS` と `SaveManager` の初期探索データを更新する。
- 各レイアウトに最低 2 種類の敵スポーンエントリを設定し、`baseline` 値は 2 以上を維持する。

## 手続き生成マップ
`src/game/world/stages/procedural.ts` の `CLUSTERS` でクラスタごとの生成数と難易度を管理しています（2025-11-18 時点）。

| クラスタ | 生成数 | 表示名パターン | 難易度 | 接続の特徴 |
| --- | --- | --- | --- | --- |
| forest | 5 | Forest Expanse 1〜5 | 2 | Forest Area 東隣から一直線に生成。最終ノード東側に Forest Reliquary を接続し、遺物ルームで行き止まり。 |
| ice | 5 | Ice Expanse 1〜5 | 3 | Ice Area 東側と直接接続する支線。最終ノード東側に Ice Reliquary を接続し、遺物を取得して折り返す。 |
| fire | 22 | Fire Expanse 1〜22 | 3 | Fire Area 南から侵入する支線。最終ノード東側に Fire Reliquary を接続し、他クラスタとは直接接続しない。 |
| ruins | 18 | Ruins Expanse 1〜18 | 2 | Cave Area から直接侵入し、最終ノード東側で Ruins Reliquary を経由して Sky クラスタへ接続。Fire クラスタとは分離。 |
| sky | 18 | Sky Expanse 1〜18 | 4 | ruins クラスタ北側に接続。 |
| void | 64 | Void Expanse 1〜64 | 1 | sky 最終ノードの北側。Forest/Ice を削減した分をここで補い、全体で 132 面を維持。 |

### 接続ルール
1. 各クラスタは内部で西⇔東に線形接続されます。`clusterNodes[index].neighbors` により、前ノードは東方向、次ノードは西方向で互いを参照します。
2. 異なるクラスタ間は原則として「前クラスタ最終ノード」と「次クラスタ先頭ノード」を南⇔北で接続しますが、Ice / Fire / Ruins クラスタはそれぞれ Ice Area / Fire Area / Cave Area から分岐するため、前クラスタとは繋がりません。
3. 最初のノード (`labyrinth-001`) の西隣には `forest-area` を、Ice クラスタ先頭ノードの西隣には `ice-area` を、Fire クラスタ先頭ノードの南隣には `fire-area` を、Ruins クラスタ先頭ノードの南隣には `cave-area` を接続し、それぞれの入口を明確化しています。
4. 各生成エリアには共通レイアウト幅 18×12（タイルサイズ 32px）、共通エントリポイント、デッドエンド報酬（health / max-health / revive）が付与され、`MapSystem.scatterDeadEndHeals` と `MapOverlay` の探索情報に活用されます。

## 名称一意性とデバッグ
- `AreaManager` では `ensureUniqueAreaNames` を通じて、同名ステージが存在する場合でも `(2)` `(3)`...のサフィックスを付与して HUD やログ表示の重複を避けています。
- HUD 右側には現在のマップ名を常時表示するため、上記一覧と組み合わせてデバッグ用にエリア遷移を追跡できます。

## 接続イメージ (Mermaid)
```mermaid
graph LR
  subgraph Fixed
    CH[Central Hub]
    MC[Mirror Corridor]
    IA[Ice Area]
    FA[Forest Area]
    CA[Cave Area]
    FIRE[Fire Area]
    GOAL[Goal Sanctum]
    SKY[Sky Sanctum]
    AS[Aurora Spire]
    SK[Starlit Keep]
  end

  CH -- north --> MC
  MC -- north --> GOAL -- north --> SKY
  CH --|北東|--> FIRE
  CH --|北西|--> IA
  CH --|南東|--> FA
  CH --|南西|--> CA
  FIRE -- south --> FireExpanse1
  SKY -- east --> AS
  SKY -- west --> SK
  FA -- east --> ForestExpanse1
  IA -- east --> IceExpanse1
  CA -- north --> RuinsExpanse1

  subgraph Procedural
    ForestExpanse1 -- east --> ForestExpanse5 -- east --> ForestReliquary
    IceExpanse1 -- east --> IceExpanse5 -- east --> IceReliquary
    FireExpanse1 -- east --> FireExpanse22 -- east --> FireReliquary
    RuinsExpanse1 -- east --> RuinsExpanse18 -- east --> RuinsReliquary
    RuinsReliquary -- south --> SkyExpanse1 -- east --> SkyExpanse18
    SkyExpanse18 -- north --> VoidExpanse1 -- east --> VoidExpanse64
  end
```
