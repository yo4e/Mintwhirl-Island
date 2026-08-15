// Pocket Storm visual direction: playful low-poly diorama with Storm Mint safety cues and coral combat feedback.
// React is the picture frame; Babylon owns the canvas and all gameplay remains under client/src/game.
import { useEffect, useRef } from "react";
import { Engine } from "@babylonjs/core/Engines/engine";
import { createGameScene, type GameHandle } from "@/game/scene";

const ASSETS = {
  logo: `${import.meta.env.BASE_URL}assets/pocket-storm-logo-v2.png`,
  sky: `${import.meta.env.BASE_URL}assets/pocket-storm-sky-v2.png`,
} as const;

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || startedRef.current) return;
    startedRef.current = true;

    const engine = new Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
      adaptToDeviceRatio: true,
    });

    let handle: GameHandle | null = null;
    let active = true;
    createGameScene(engine, canvas).then((nextHandle) => {
      if (!active) {
        nextHandle.dispose();
        return;
      }
      handle = nextHandle;
      engine.runRenderLoop(() => nextHandle.scene.render());
    });

    const onResize = () => engine.resize();
    window.addEventListener("resize", onResize);

    return () => {
      active = false;
      window.removeEventListener("resize", onResize);
      handle?.dispose();
      engine.dispose();
      startedRef.current = false;
    };
  }, []);

  return (
    <main className="game-shell" aria-label="Pocket Storm: Solo Battle Royale">
      <canvas ref={canvasRef} className="game-canvas" aria-label="三人称視点の戦闘フィールド" />

      <div id="game-hud" className="game-hud" aria-live="polite">
        <section className="hud-top-left" aria-label="プレイヤーステータス">
          <div className="brand-chip">
            <img src={ASSETS.logo} alt="" />
            <span>POCKET<br />STORM</span>
          </div>
          <div className="health-card">
            <div className="health-head"><span>バンガード</span><strong id="hud-health">100</strong></div>
            <div className="health-track"><div id="hud-health-fill" className="health-fill" /></div>
            <div className="shield-head"><span>シールド</span><strong id="hud-shield">0</strong></div>
            <div className="shield-track"><div id="hud-shield-fill" className="shield-fill" /></div>
          </div>
        </section>

        <section className="storm-card" aria-label="嵐の収束までの時間">
          <span className="storm-dot" />
          <span className="storm-label">嵐接近</span>
          <strong id="hud-storm">02:40</strong>
        </section>

        <section className="minimap-card" aria-label="安全地帯のミニマップ">
          <div id="minimap" className="minimap"><span id="map-marker" /></div>
          <div><span>安全地帯</span><strong id="hud-zone">52m</strong></div>
        </section>

        <section id="threat-chip" className="threat-chip" aria-live="polite">
          <span>!</span><strong id="hud-threat">敵が近い</strong>
        </section>

        <section className="hud-bottom-left" aria-label="ラウンド状況">
          <span className="round-kicker">ソロ・ランブル</span>
          <strong id="hud-enemies">敵 8 体</strong>
          <span id="hud-score" className="score-readout">島スコア 0000</span>
          <span id="hud-objective">リング内で最後まで生き残れ</span>
        </section>

        <section className="control-hints" aria-label="操作モード">
          <span id="hud-control-mode" className="control-mode">準備OK</span>
          <span><b>SHIFT</b> ダッシュ</span><span><b>RMB</b> 照準</span><span><b>C</b> 肩替え</span><span><b>E</b> ホップ</span>
        </section>

        <section className="tactical-chip" aria-label="戦術アクション">
          <b>E</b><span>ミント・ホップ</span><strong id="hud-tactical">準備OK</strong>
        </section>

        <section className="weapon-card" aria-label="武器と弾薬">
          <div className="weapon-label"><span id="hud-weapon">トイブラスター / MK I</span><small id="hud-reload">オート</small></div>
          <div className="ammo-row"><strong id="hud-ammo">18</strong><span>/ <b id="hud-reserve">72</b></span></div>
          <div id="weapon-slots" className="inventory-slots"><span className="active">1</span><span>2</span><span>3</span></div>
        </section>

        <div id="crosshair" className="crosshair" aria-hidden="true"><i /><i /><i /><i /></div>
        <div id="hit-marker" className="hit-marker" aria-hidden="true"><i /><i /><i /><i /></div>
        <div id="damage-vignette" className="damage-vignette" aria-hidden="true" />
        <div id="pickup-callout" className="pickup-callout" aria-live="polite" />
        <div id="event-banner" className="event-banner" aria-live="assertive"><span>!</span><strong id="event-copy">島がざわめいている</strong></div>
        <button id="settings-button" className="settings-button" type="button" aria-label="操作設定を開く">⚙</button>
        <section id="settings-panel" className="settings-panel" aria-label="操作設定">
          <span>視点感度</span>
          <input id="sensitivity-slider" type="range" min="55" max="175" step="5" defaultValue="100" />
          <small id="sensitivity-value">100%</small>
        </section>
      </div>

      <section id="upgrade-overlay" className="upgrade-overlay" aria-live="assertive" aria-label="ポケット強化の選択">
        <div className="upgrade-panel">
          <img src={ASSETS.logo} alt="" />
          <p className="eyebrow">ISLAND GIFT</p>
          <h2>ポケット強化を<br />ひとつ選べ。</h2>
          <p className="upgrade-copy">敵を倒したごほうび。嵐が近づく前に、次の一手を決めよう。</p>
          <div className="upgrade-options">
            <button className="upgrade-option" type="button" data-upgrade-slot="0"><span className="upgrade-icon">✦</span><strong id="upgrade-title-0">コメットコア</strong><small id="upgrade-copy-0">ダメージが上がる</small></button>
            <button className="upgrade-option" type="button" data-upgrade-slot="1"><span className="upgrade-icon">↯</span><strong id="upgrade-title-1">ミントエンジン</strong><small id="upgrade-copy-1">ホップが早く戻る</small></button>
            <button className="upgrade-option" type="button" data-upgrade-slot="2"><span className="upgrade-icon">✚</span><strong id="upgrade-title-2">レスキュージュース</strong><small id="upgrade-copy-2">HPを回復する</small></button>
          </div>
        </div>
      </section>

      <section id="start-overlay" className="launch-overlay" style={{ backgroundImage: `linear-gradient(110deg, rgba(12, 32, 54, .84) 0%, rgba(12, 32, 54, .55) 46%, rgba(12, 32, 54, .18) 72%), url(${ASSETS.sky})` }}>
        <div className="launch-grain" />
        <div className="launch-content">
          <img className="launch-mark" src={ASSETS.logo} alt="Pocket Storm" />
          <p className="eyebrow">SOLO BATTLE ROYALE</p>
          <h1>POCKET<br /><em>STORM</em></h1>
          <p className="launch-copy">かわいい島を駆け抜け、嵐を越えろ。<br />残るのは、最後のひとり。</p>
          <button id="start-button" className="storm-button" type="button">島へドロップ <span>↗</span></button>
          <div className="control-sheet">
            <span><b>WASD</b> 移動</span><span><b>SHIFT</b> ダッシュ</span><span><b>RMB</b> 照準</span><span><b>C</b> 肩替え</span><span><b>E</b> ホップ</span><span><b>CLICK</b> 射撃</span><span><b>1–3</b> 武器</span><span><b>R</b> 装填</span>
          </div>
        </div>
        <div className="launch-preview" aria-hidden="true">
          <div className="preview-ring" />
          <div className="preview-island" />
          <div className="preview-hut"><i /><b /></div>
          <div className="preview-windmill"><i /><b /><em /><strong /></div>
          <div className="preview-tree tree-one"><i /><b /></div>
          <div className="preview-tree tree-two"><i /><b /></div>
          <div className="preview-drop">+</div>
        </div>
        <p className="launch-note">敵2体で強化を選べ · 嵐レベル3でエリート警報 · 最後まで残れ</p>
      </section>

      <section id="result-overlay" className="result-overlay" aria-live="assertive">
        <div className="result-card">
          <img src={ASSETS.logo} alt="" />
          <p id="result-kicker" className="eyebrow">ROUND COMPLETE</p>
          <h2 id="result-title">STORM SURVIVOR</h2>
          <p id="result-copy">島は静かになった。</p>
          <div className="result-stats" aria-label="ラウンド結果">
            <span><b id="result-score">0000</b>島スコア</span>
            <span><b id="result-badges">+0</b>島バッジ</span>
            <span><b id="result-total-badges">0</b>累計バッジ</span>
          </div>
          <p id="result-unlock" className="result-unlock">あと5バッジで「風車ランナー」バッジ。</p>
          <button id="retry-button" className="storm-button" type="button">もう一度ドロップ <span>↗</span></button>
        </div>
      </section>
    </main>
  );
}
