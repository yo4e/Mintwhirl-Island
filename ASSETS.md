# Assets

**Art direction:** 晴れた島を舞台にしたプレイフル・ローポリ・ジオラマ。バターブルーの空、クリーム色の草地、セージの木々を基調に、Storm Mint `#64D9A6` を安全地帯とブランドの色に、コーラルを危険・被弾に限定する。シルエットの明瞭さとHUDの即読性を最優先する。

## Visual Target

| Name | Role | Size | URL |
| --- | --- | --- | --- |
| pocket-storm-visual-target | カメラ・HUD・戦闘密度の視覚基準 | 16:9, 1920×1080相当 | `/manus-storage/pocket-storm-visual-target_5520f3c7.png` |

## Brand and Textures

| Name | Description | Size | URL |
| --- | --- | --- | --- |
| pocket-storm-logo | ミントの旋風と雷からなる透明ブランドマーク | 128×128 px 表示 | `/manus-storage/pocket-storm-logo-v2_fee3b707.png` |
| pocket-storm-terrain | 反復可能なクリーム色・セージ色の草地テクスチャ | 12m tile | `/manus-storage/pocket-storm-terrain-v2_faf6ab1f.png` |
| pocket-storm-sky | 遠い丘と柔らかい雲を含む横長の空 | 1920×1080 px, fullscreen overlay | `/manus-storage/pocket-storm-sky-v2_d47204eb.png` |

## Props

| Name | Description | Size | URL |
| --- | --- | --- | --- |
| pocket-storm-supply-crate | ターコイズ、クリーム、コーラル金具の補給箱参照 | 1.2m cube | `/manus-storage/pocket-storm-supply-crate_07f7de03.png` |

## Runtime Policy

生成画像はゲームプロジェクトへ複製せず、上記の永続URLを使用します。ゲームの主要形状は、読みやすさと読み込み速度を両立するため、Babylon.js の低ポリゴン手続きメッシュで実装します。補給箱・芝・空は生成画像の視覚言語をマテリアル・UI装飾に反映します。
