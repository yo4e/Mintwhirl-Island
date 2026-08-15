# Pocket Storm — Code Structure

## アーキテクチャの原則

React はゲームの**額縁**、Babylon.js は描画・入力・シーンの**キャンバス**、`client/src/game/` はゲームルールの**本体**です。ゲーム状態はReactに持ち込まず、Babylonメッシュを所有する小さなTypeScriptクラスで扱います。

```text
GameCanvas.tsx
  └─ createGameScene(engine, canvas)
      └─ GameWorld
          ├─ InputManager
          ├─ Player
          │   └─ Weapon
          ├─ EnemyManager
          │   └─ Enemy × N
          ├─ Arena
          ├─ StormController
          ├─ PickupManager
          └─ HUDController
```

## Module Responsibilities

| Module | Responsibility | Owns |
| --- | --- | --- |
| `scene.ts` | エンジンからゲームワールドを起動し、`GameHandle` を返す | Scene, GameWorld, dispose lifecycle |
| `GameWorld.ts` | ラウンド状態と各システムの更新順序を管理する | Player, managers, HUD state |
| `Player.ts` | 移動、旋回、HP、被弾、三人称モデルを管理する | player root, body, backpack meshes |
| `Weapon.ts` | 発射間隔、残弾、リロード、レイ判定と弾道表現を管理する | 3つの武器設定、tracer meshes, weapon state |
| `Enemy.ts` | 小規模な状態機械でNPCの移動・射撃・被弾を管理する | 突撃・横移動・間合い管理、エリート化、enemy root, HP, state |
| `Arena.ts` | 地面、川、岩、木、小屋、橋、風車、衝突可能な障害物を生成する | static meshes, obstacle bounds |
| `StormController.ts` | 安全リング、縮小タイマー、段階的なリング外ダメージと終盤イベントを管理する | ring mesh, stage, emergency supply |
| `PickupManager.ts` | 補給箱、近接判定、弾薬・シールド・回復の選択を扱う | typed crates, pickup callout |
| `HUDController.ts` | DOMの軽量HUD更新、開始・結果オーバーレイを扱う | DOM bindings only |
| `InputManager` | キー、マウス、ポインターロックを意味単位のアクションに変換する | ダッシュ、精密照準、肩替え、ホップ、連射、感度、input state |

## States and Update Flow

`GameWorld` は `ready → playing → upgrade → victory | defeat` のラウンド状態を持ちます。NPCは `patrol → chase → shoot` を基本に、リング外で `returnToStorm` を最優先します。プレイヤーは通常移動、Shiftによるダッシュ、右クリック中の精密照準、Cによる肩越し視点の左右切替、Eによるミント・ホップを使い分けます。2撃破ごとにゲームを一時停止し、3択のポケット強化を選びます。嵐レベル3ではエリート敵、レベル4では中央補給を発生させます。

## Asset Hints

| Asset | In-game use | Size |
| --- | --- | --- |
| ロゴ | 開始画面のシンボル、タブアイコン | 128×128 px 表示 |
| 草地テクスチャ | 地面の色味と小さな表情 | 12m ごとに反復 |
| 空の景観 | 開始オーバーレイの背景、色彩参照 | 1920×1080 px、横幅いっぱい |
| 補給箱 | 3D補給箱の色・金具参照 | 1.2m 四方 |
| 視覚基準 | カメラ・HUD・配置のQA参照 | 16:9 フルスクリーン |
