# 新規ステージ拡張仕様

## 概要

`goal-sanctum` 北側の扉から到達できる天空遺跡帯を新たに追加する。  
本エリア群は 3 ステージで構成され、それぞれに異なるギミックと敵構成を持たせる。

| ステージ ID | 表示名 | 接続 | 主な敵 | ギミック概要 |
| --- | --- | --- | --- | --- |
| `sky-sanctum` | Sky Sanctum | 南: goal-sanctum / 東: aurora-spire / 西: starlit-keep | Frost Wabble, Glacio Durt | 浮遊足場と中央気流で縦移動を生むホバリング導線 |
| `aurora-spire` | Aurora Spire | 西: sky-sanctum | Wabble Bee, Dronto Durt | 螺旋状足場と落下避けトゲ床。上層への縦型タワー |
| `starlit-keep` | Starlit Keep | 東: sky-sanctum | Glacio Durt, Wabble Bee | 時間で開閉するバリア床と狭い横穴による回避ルート |

## ステージ詳細

### Sky Sanctum (`sky-sanctum`)
- **テーマ:** ゴール聖域の上空に浮かぶ中央広場。気流の吹き上げで縦移動をサポート。
- **ギミック:** マップ中央部に 2 本の細い足場列を配置し、その間を通過するプレイヤーは安全に上層へ移動できる。左右にサブルートを用意して敵配置種類を使い分ける。
- **敵構成:** `frost-wabble`（冷気弾）と `glacio-durt`（突進）を 2:1 の比率で巡回させ、ホバリングを要求する配置にする。
- **接続:** 南側の扉を `goal-sanctum` の北出口に連結。東西扉は後述のステージへ接続。

### Aurora Spire (`aurora-spire`)
- **テーマ:** 極光が差し込む縦長の塔内部。狭い螺旋階段と足場。
- **ギミック:** 最下層にトゲ床、塔内部に 3 層の狭い足場を配置。落下リスクを高めつつ敵を避けながら上昇させる。
- **敵構成:** 機動力の高い `wabble-bee` と直線突進の `dronto-durt` を配置し、縦移動中の被弾リスクを演出。
- **接続:** 西側扉のみ。`sky-sanctum` の東扉と対になる。

### Starlit Keep (`starlit-keep`)
- **テーマ:** 星明かりに照らされた古城の外縁。段差が多く横長。
- **ギミック:** 特定の床タイルを 2 枚化し、一定ラインで段差を越えると上下の床が交互に開閉するパターンを擬似的に再現（移動ルートが時間で変化するようレイアウト）。
- **敵構成:** `glacio-durt` と `wabble-bee` を 1:1 で配置。狭い横穴で追跡されないよう回避ルートを用意。
- **接続:** 東側扉のみ。`sky-sanctum` の西扉と対になる。

## 実装メモ

- `goal-sanctum` 北側扉のタイル座標 (`column: 14`, `row: 1`) を `sky-sanctum` に遷移させる。
- 新ステージを `STAGE_DEFINITIONS` へ追加し、`AreaManager.AREA_IDS` および `SaveManager` の初期探索データに反映する。
- それぞれのレイアウトに最低 2 種類の敵スポーンエントリを定義し、`baseline` 値は 2 以上に設定する。
