// Pocket Storm visual direction: toy-like low-poly island, readable silhouettes, mint safety ring, coral combat feedback.
// All gameplay is framework-agnostic TypeScript; React only mounts the canvas and overlay markup.
import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";

const ASSETS = {
  terrain: `${import.meta.env.BASE_URL}assets/pocket-storm-terrain-v2.png`,
} as const;

const MINT = Color3.FromHexString("#64D9A6");
const CORAL = Color3.FromHexString("#FF6F61");
const NAVY = Color3.FromHexString("#15334B");
const BUTTER = Color3.FromHexString("#F6D66B");
const CREAM = Color3.FromHexString("#F4E9BF");
const SAGE = Color3.FromHexString("#6DA679");

type RoundState = "ready" | "playing" | "upgrade" | "victory" | "defeat";
type EnemyMode = "patrol" | "chase" | "shoot" | "strafe" | "storm";
type WeaponId = "blaster" | "burst" | "charge";
type PickupKind = "ammo" | "shield" | "juice";
type EnemyRole = "rusher" | "strafer" | "scout";
type UpgradeId = "cometCore" | "pepperSpring" | "mintEngine" | "safetyJar" | "juiceBox" | "utilityBelt";

interface UpgradeOption {
  id: UpgradeId;
  title: string;
  copy: string;
  icon: string;
}

const WEAPONS: Record<WeaponId, { name: string; mode: string; damage: number; cooldown: number; ammoCost: number; color: Color3 }> = {
  blaster: { name: "トイブラスター / MK I", mode: "オート", damage: 25, cooldown: 0.125, ammoCost: 1, color: CORAL },
  burst: { name: "ペッパー・ポップ / 3連", mode: "3連射", damage: 17, cooldown: 0.5, ammoCost: 1, color: Color3.FromHexString("#FFAB63") },
  charge: { name: "コメット・ポップ / 重砲", mode: "チャージ", damage: 58, cooldown: 0.72, ammoCost: 2, color: BUTTER },
};

const UPGRADES: UpgradeOption[] = [
  { id: "cometCore", title: "コメットコア", copy: "すべての射撃ダメージ +20%", icon: "✦" },
  { id: "pepperSpring", title: "ペッパーばね", copy: "連射の間隔 -22%", icon: "↯" },
  { id: "mintEngine", title: "ミントエンジン", copy: "ホップの待機時間 -32%", icon: "➜" },
  { id: "safetyJar", title: "セーフティ瓶", copy: "シールド上限 +25、即時回復", icon: "◈" },
  { id: "juiceBox", title: "レスキュージュース", copy: "HPを35回復", icon: "✚" },
  { id: "utilityBelt", title: "ユーティリティベルト", copy: "予備弾 +40", icon: "▣" },
];

interface Enemy {
  root: TransformNode;
  body: Mesh;
  hp: number;
  maxHp: number;
  cooldown: number;
  wanderTime: number;
  wanderDirection: Vector3;
  mode: EnemyMode;
  role: EnemyRole;
  alive: boolean;
  spawn: Vector3;
  elite: boolean;
  baseColor: Color3;
}

interface Obstacle {
  position: Vector3;
  radius: number;
}

interface Tracer {
  mesh: Mesh;
  life: number;
}

interface PickupCrate {
  root: TransformNode;
  kind: PickupKind;
  drop: boolean;
}

export interface GameHandle {
  scene: Scene;
  dispose: () => void;
}

class InputManager {
  private keys = new Set<string>();
  private shootRequested = false;
  private shootHeld = false;
  private aimHeld = false;
  private shoulderSwapRequested = false;
  private tacticalRequested = false;
  private pointerActive = false;
  private sensitivity = 1;
  public yaw = Math.PI;
  public pitch = 0.12;

  private readonly onKeyDown = (event: KeyboardEvent) => {
    this.keys.add(event.key.toLowerCase());
    if (event.key.toLowerCase() === "r") this.keys.add("reload");
    if (event.key.toLowerCase() === "c") this.shoulderSwapRequested = true;
    if (event.key.toLowerCase() === "e") this.tacticalRequested = true;
  };

  private readonly onKeyUp = (event: KeyboardEvent) => {
    this.keys.delete(event.key.toLowerCase());
  };

  private readonly onMouseMove = (event: MouseEvent) => {
    if (!this.pointerActive && event.buttons !== 1 && event.buttons !== 2) return;
    const aimMultiplier = this.aimHeld ? 0.52 : 1;
    this.yaw += event.movementX * 0.0027 * this.sensitivity * aimMultiplier;
    this.pitch = Math.max(-0.42, Math.min(0.58, this.pitch - event.movementY * 0.0019 * this.sensitivity * aimMultiplier));
  };

  private readonly onPointerDown = (event: PointerEvent) => {
    if (event.button === 0) {
      this.shootRequested = true;
      this.shootHeld = true;
    }
    if (event.button === 2) this.aimHeld = true;
    this.lockPointer();
  };

  private readonly onPointerUp = (event: PointerEvent) => {
    if (event.button === 0) this.shootHeld = false;
    if (event.button === 2) this.aimHeld = false;
  };

  private readonly onContextMenu = (event: MouseEvent) => event.preventDefault();

  private readonly onLockChange = () => {
    this.pointerActive = document.pointerLockElement === this.canvas;
  };

  constructor(private readonly canvas: HTMLCanvasElement) {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    document.addEventListener("mousemove", this.onMouseMove);
    document.addEventListener("pointerlockchange", this.onLockChange);
    canvas.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("contextmenu", this.onContextMenu);
  }

  public lockPointer() {
    if (document.pointerLockElement === this.canvas) return;
    const request = this.canvas.requestPointerLock?.();
    if (request && typeof request.catch === "function") void request.catch(() => undefined);
  }

  public consumeShoot() {
    const requested = this.shootRequested || this.shootHeld;
    this.shootRequested = false;
    return requested;
  }

  public isAiming() {
    return this.aimHeld;
  }

  public isSprinting() {
    return this.keys.has("shift") && !this.aimHeld;
  }

  public setSensitivity(value: number) {
    this.sensitivity = Math.max(0.55, Math.min(1.75, value));
  }

  public consumeReload() {
    const requested = this.keys.has("reload");
    this.keys.delete("reload");
    return requested;
  }

  public consumeWeaponSelection(): WeaponId | null {
    const selections: [string, WeaponId][] = [["1", "blaster"], ["2", "burst"], ["3", "charge"]];
    for (const [key, weapon] of selections) {
      if (this.keys.has(key)) {
        this.keys.delete(key);
        return weapon;
      }
    }
    return null;
  }

  public consumeShoulderSwap() {
    const requested = this.shoulderSwapRequested;
    this.shoulderSwapRequested = false;
    return requested;
  }

  public consumeTactical() {
    const requested = this.tacticalRequested;
    this.tacticalRequested = false;
    return requested;
  }

  public movement() {
    const z = (this.keys.has("w") ? 1 : 0) - (this.keys.has("s") ? 1 : 0);
    const x = (this.keys.has("d") ? 1 : 0) - (this.keys.has("a") ? 1 : 0);
    return new Vector3(x, 0, z);
  }

  public lookDirection() {
    const horizontal = Math.cos(this.pitch);
    return new Vector3(Math.sin(this.yaw) * horizontal, Math.sin(this.pitch), Math.cos(this.yaw) * horizontal).normalize();
  }

  public moveForward() {
    const look = this.lookDirection();
    look.y = 0;
    return look.normalize();
  }

  public dispose() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    document.removeEventListener("mousemove", this.onMouseMove);
    document.removeEventListener("pointerlockchange", this.onLockChange);
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    window.removeEventListener("pointerup", this.onPointerUp);
    this.canvas.removeEventListener("contextmenu", this.onContextMenu);
  }
}

class HUDController {
  private hitTimeout: number | undefined;
  private damageTimeout: number | undefined;

  private readonly startButton = document.querySelector<HTMLButtonElement>("#start-button");
  private readonly retryButton = document.querySelector<HTMLButtonElement>("#retry-button");
  private readonly settingsButton = document.querySelector<HTMLButtonElement>("#settings-button");
  private readonly settingsPanel = document.querySelector<HTMLElement>("#settings-panel");
  private readonly sensitivitySlider = document.querySelector<HTMLInputElement>("#sensitivity-slider");
  private readonly upgradeButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-upgrade-slot]"));

  constructor(private readonly world: GameWorld) {
    this.startButton?.addEventListener("click", this.handleStart);
    this.retryButton?.addEventListener("click", this.handleRetry);
    this.settingsButton?.addEventListener("click", this.toggleSettings);
    this.sensitivitySlider?.addEventListener("input", this.updateSensitivity);
    this.upgradeButtons.forEach((button) => button.addEventListener("click", this.handleUpgrade));
  }

  private readonly handleStart = () => this.world.start();
  private readonly handleRetry = () => this.world.reset();
  private readonly toggleSettings = () => this.settingsPanel?.classList.toggle("is-open");
  private readonly updateSensitivity = () => {
    const rawValue = Number(this.sensitivitySlider?.value ?? 100);
    this.world.setSensitivity(rawValue / 100);
    this.setText("sensitivity-value", `${rawValue}%`);
  };
  private readonly handleUpgrade = (event: Event) => {
    const button = event.currentTarget as HTMLButtonElement;
    this.world.chooseUpgrade(Number(button.dataset.upgradeSlot ?? -1));
  };

  public update(world: GameWorld) {
    this.setText("hud-health", String(Math.max(0, Math.ceil(world.playerHp))));
    this.setStyle("hud-health-fill", "width", `${Math.max(0, world.playerHp)}%`);
    this.setText("hud-shield", String(Math.ceil(world.shield)));
    this.setStyle("hud-shield-fill", "width", `${Math.max(0, world.shield) * 2}%`);
    this.setText("hud-ammo", String(world.ammo).padStart(2, "0"));
    this.setText("hud-reserve", String(world.reserve));
    this.setText("hud-enemies", `敵 ${world.livingEnemies} 体`);
    this.setText("hud-storm", world.stormTimeText);
    this.setText("hud-zone", `${Math.max(0, Math.round(world.distanceToZone))}m`);
    this.setText("hud-weapon", WEAPONS[world.weapon].name);
    this.setText("hud-reload", world.reloading ? "RELOAD" : WEAPONS[world.weapon].mode);
    this.setText("hud-objective", world.state === "playing" ? `嵐レベル ${world.stormStage} · 嵐接近。丘へ走れ。` : "リング内で最後まで生き残れ");
    this.setText("hud-control-mode", world.aiming ? "照準中" : world.sprinting ? "ダッシュ" : "準備OK");
    this.setText("hud-tactical", world.tacticalCooldown > 0 ? `${world.tacticalCooldown.toFixed(1)}秒` : "準備OK");
    this.setText("hud-score", `島スコア ${String(world.score).padStart(4, "0")}`);

    const marker = document.querySelector<HTMLElement>("#map-marker");
    if (marker) {
      const x = 50 + (world.playerPosition.x / 60) * 38;
      const y = 50 + (world.playerPosition.z / 60) * 38;
      marker.style.left = `${Math.max(5, Math.min(95, x))}%`;
      marker.style.top = `${Math.max(5, Math.min(95, y))}%`;
    }
    const slots = document.querySelectorAll("#weapon-slots span");
    slots.forEach((slot, index) => slot.classList.toggle("active", index === ["blaster", "burst", "charge"].indexOf(world.weapon)));
    const pickup = document.querySelector<HTMLElement>("#pickup-callout");
    if (pickup) {
      pickup.textContent = world.pickupMessage;
      pickup.classList.toggle("is-active", world.pickupTimer > 0);
    }
    const threat = document.querySelector<HTMLElement>("#threat-chip");
    if (threat) {
      const isThreatened = world.nearestEnemyDistance < 12;
      threat.classList.toggle("is-active", isThreatened);
      this.setText("hud-threat", isThreatened ? "敵が近い" : "周囲クリア");
    }
    const event = document.querySelector<HTMLElement>("#event-banner");
    if (event) {
      event.classList.toggle("is-active", world.eventTimer > 0);
      this.setText("event-copy", world.eventMessage);
    }
  }

  public hideLaunch() {
    document.querySelector("#start-overlay")?.classList.add("is-hidden");
  }

  public showUpgrade(options: UpgradeOption[]) {
    options.forEach((option, index) => {
      this.setText(`upgrade-title-${index}`, option.title);
      this.setText(`upgrade-copy-${index}`, option.copy);
      const icon = document.querySelector<HTMLElement>(`[data-upgrade-slot="${index}"] .upgrade-icon`);
      if (icon) icon.textContent = option.icon;
    });
    document.querySelector("#upgrade-overlay")?.classList.add("is-visible");
  }

  public hideUpgrade() {
    document.querySelector("#upgrade-overlay")?.classList.remove("is-visible");
  }

  public showResult(victory: boolean, result: { eliminated: number; score: number; badges: number; totalBadges: number; unlock: string }) {
    const overlay = document.querySelector("#result-overlay");
    const title = document.querySelector("#result-title");
    const kicker = document.querySelector("#result-kicker");
    const copy = document.querySelector("#result-copy");
    if (title) title.textContent = victory ? "嵐を越えた！" : "また島で会おう";
    if (kicker) kicker.textContent = victory ? "ISLAND SURVIVOR" : "RUN COMPLETE";
    if (copy) copy.textContent = victory ? `敵 ${result.eliminated} 体を突破。島はあなたを覚えている。` : `敵 ${result.eliminated} 体を突破。次のドロップで、もっと遠くへ。`;
    this.setText("result-score", String(result.score).padStart(4, "0"));
    this.setText("result-badges", `+${result.badges}`);
    this.setText("result-total-badges", String(result.totalBadges));
    this.setText("result-unlock", result.unlock);
    overlay?.classList.add("is-visible");
  }

  public hitMarker() {
    const marker = document.querySelector("#hit-marker");
    marker?.classList.remove("is-active");
    window.clearTimeout(this.hitTimeout);
    requestAnimationFrame(() => marker?.classList.add("is-active"));
    this.hitTimeout = window.setTimeout(() => marker?.classList.remove("is-active"), 130);
  }

  public damageFlash() {
    const vignette = document.querySelector("#damage-vignette");
    vignette?.classList.remove("is-active");
    window.clearTimeout(this.damageTimeout);
    requestAnimationFrame(() => vignette?.classList.add("is-active"));
    this.damageTimeout = window.setTimeout(() => vignette?.classList.remove("is-active"), 220);
  }

  private setText(id: string, value: string) {
    const element = document.getElementById(id);
    if (element && element.textContent !== value) element.textContent = value;
  }

  private setStyle(id: string, property: string, value: string) {
    const element = document.getElementById(id) as HTMLElement | null;
    if (element) element.style.setProperty(property, value);
  }

  public dispose() {
    this.startButton?.removeEventListener("click", this.handleStart);
    this.retryButton?.removeEventListener("click", this.handleRetry);
    this.settingsButton?.removeEventListener("click", this.toggleSettings);
    this.sensitivitySlider?.removeEventListener("input", this.updateSensitivity);
    this.upgradeButtons.forEach((button) => button.removeEventListener("click", this.handleUpgrade));
    window.clearTimeout(this.hitTimeout);
    window.clearTimeout(this.damageTimeout);
  }
}

class GameWorld {
  public state: RoundState = "ready";
  public playerHp = 100;
  public shield = 0;
  public ammo = 18;
  public reserve = 72;
  public reloading = false;
  public livingEnemies = 8;
  public distanceToZone = 0;
  public weapon: WeaponId = "blaster";
  public aiming = false;
  public sprinting = false;
  public shoulderSide = 1;
  public nearestEnemyDistance = Infinity;
  public tacticalCooldown = 0;
  public pickupMessage = "";
  public pickupTimer = 0;
  public score = 0;
  public eventMessage = "島をよく見ろ。強化のチャンスは近い。";
  public eventTimer = 0;
  public readonly playerPosition = new Vector3(0, 0, 20);

  private readonly playerRoot = new TransformNode("player-root", this.scene);
  private readonly enemies: Enemy[] = [];
  private readonly obstacles: Obstacle[] = [];
  private readonly tracers: Tracer[] = [];
  private readonly camera: UniversalCamera;
  private readonly input: InputManager;
  private readonly hud: HUDController;
  private readonly stormRing: Mesh;
  private readonly crates: PickupCrate[] = [];
  private roundElapsed = 0;
  private shotCooldown = 0;
  private reloadTimer = 0;
  private stormRadius = 52;
  private eliminated = 0;
  private burstShots = 0;
  private burstTimer = 0;
  private switchCooldown = 0;
  private shieldCap = 50;
  private damageMultiplier = 1;
  private fireRateMultiplier = 1;
  private hopCooldownMultiplier = 1;
  private upgradesTaken = 0;
  private nextUpgradeAt = 2;
  private pendingUpgrades: UpgradeOption[] = [];
  private eliteSpawned = false;
  private supplyEventSpawned = false;
  private lifetimeBadges = 0;
  private readonly playerVelocity = Vector3.Zero();
  private readonly playerMeshes: Mesh[] = [];
  private readonly demo = new URLSearchParams(window.location.search).has("demo");
  private readonly previewMode = new URLSearchParams(window.location.search).get("preview");

  constructor(private readonly scene: Scene, canvas: HTMLCanvasElement) {
    this.input = new InputManager(canvas);
    this.lifetimeBadges = this.readLifetimeBadges();
    this.camera = new UniversalCamera("follow-camera", new Vector3(0, 4, 28), scene);
    this.camera.minZ = 0.1;
    this.camera.fov = 1.05;
    this.camera.inputs.clear();
    this.scene.activeCamera = this.camera;

    this.createLighting();
    this.createArena();
    this.createPlayer();
    this.createEnemies();
    this.stormRing = this.createStormRing();
    this.createCrates();
    this.hud = new HUDController(this);
    this.updateCamera();

    if (this.previewMode === "upgrades") {
      this.pendingUpgrades = UPGRADES.slice(0, 3);
      this.state = "upgrade";
      window.setTimeout(() => this.hud.showUpgrade(this.pendingUpgrades), 80);
    } else if (this.previewMode === "event") {
      window.setTimeout(() => {
        this.roundElapsed = 121;
        this.start();
      }, 80);
    } else if (this.previewMode === "result") {
      window.setTimeout(() => {
        this.start();
        this.eliminated = 6;
        this.score = 870;
        this.roundElapsed = 128;
        this.finish(true);
      }, 80);
    } else if (this.demo) {
      window.setTimeout(() => this.start(), 250);
    }
  }

  public get stormTimeText() {
    const remaining = Math.max(0, 160 - this.roundElapsed);
    return `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(Math.floor(remaining % 60)).padStart(2, "0")}`;
  }

  public get stormStage() {
    return Math.min(4, 1 + Math.floor(this.roundElapsed / 40));
  }

  public start() {
    if (this.state === "playing") return;
    this.state = "playing";
    document.querySelector("#result-overlay")?.classList.remove("is-visible");
    this.hud.hideLaunch();
    if (!this.demo && !this.previewMode) this.input.lockPointer();
  }

  public setSensitivity(value: number) {
    this.input.setSensitivity(value);
  }

  public chooseUpgrade(slot: number) {
    const option = this.pendingUpgrades[slot];
    if (this.state !== "upgrade" || !option) return;
    if (option.id === "cometCore") this.damageMultiplier += 0.2;
    if (option.id === "pepperSpring") this.fireRateMultiplier *= 0.78;
    if (option.id === "mintEngine") this.hopCooldownMultiplier *= 0.68;
    if (option.id === "safetyJar") {
      this.shieldCap += 25;
      this.shield = this.shieldCap;
    }
    if (option.id === "juiceBox") this.playerHp = Math.min(100, this.playerHp + 35);
    if (option.id === "utilityBelt") this.reserve = Math.min(180, this.reserve + 40);
    this.upgradesTaken += 1;
    this.pendingUpgrades = [];
    this.state = "playing";
    this.pickupMessage = `${option.title} · 強化完了！`;
    this.pickupTimer = 1.7;
    this.hud.hideUpgrade();
    if (!this.demo) this.input.lockPointer();
  }

  private offerUpgrades() {
    const start = (this.upgradesTaken * 3) % UPGRADES.length;
    this.pendingUpgrades = [0, 1, 2].map((offset) => UPGRADES[(start + offset) % UPGRADES.length]);
    this.nextUpgradeAt += 2;
    this.state = "upgrade";
    document.exitPointerLock?.();
    this.hud.showUpgrade(this.pendingUpgrades);
  }

  public reset() {
    this.playerHp = 100;
    this.shield = 0;
    this.ammo = 18;
    this.reserve = 72;
    this.reloading = false;
    this.roundElapsed = 0;
    this.shotCooldown = 0;
    this.reloadTimer = 0;
    this.stormRadius = 52;
    this.eliminated = 0;
    this.score = 0;
    this.weapon = "blaster";
    this.shoulderSide = 1;
    this.pickupMessage = "";
    this.pickupTimer = 0;
    this.burstShots = 0;
    this.burstTimer = 0;
    this.switchCooldown = 0;
    this.tacticalCooldown = 0;
    this.shieldCap = 50;
    this.damageMultiplier = 1;
    this.fireRateMultiplier = 1;
    this.hopCooldownMultiplier = 1;
    this.upgradesTaken = 0;
    this.nextUpgradeAt = 2;
    this.pendingUpgrades = [];
    this.eliteSpawned = false;
    this.supplyEventSpawned = false;
    this.eventTimer = 0;
    this.eventMessage = "島をよく見ろ。強化のチャンスは近い。";
    this.hud.hideUpgrade();
    this.playerVelocity.copyFromFloats(0, 0, 0);
    this.playerRoot.position.copyFromFloats(0, 0, 20);
    this.enemies.forEach((enemy) => {
      enemy.root.position.copyFrom(enemy.spawn);
      enemy.maxHp = 60;
      enemy.hp = enemy.maxHp;
      enemy.cooldown = 0;
      enemy.alive = true;
      enemy.elite = false;
      enemy.body.setEnabled(true);
      enemy.body.scaling.setAll(1);
      const material = enemy.body.material as StandardMaterial | null;
      if (material) {
        material.diffuseColor.copyFrom(enemy.baseColor);
        material.emissiveColor = Color3.Black();
      }
      enemy.root.setEnabled(true);
    });
    this.livingEnemies = this.enemies.length;
    for (let index = this.crates.length - 1; index >= 0; index -= 1) {
      const crate = this.crates[index];
      if (crate.drop) {
        crate.root.getChildMeshes().forEach((mesh) => mesh.dispose());
        crate.root.dispose();
        this.crates.splice(index, 1);
      } else {
        crate.root.setEnabled(true);
      }
    }
    this.start();
  }

  public update(delta: number) {
    if (this.state === "playing") {
      this.roundElapsed += delta;
      this.pickupTimer = Math.max(0, this.pickupTimer - delta);
      this.eventTimer = Math.max(0, this.eventTimer - delta);
      this.shotCooldown = Math.max(0, this.shotCooldown - delta);
      this.switchCooldown = Math.max(0, this.switchCooldown - delta);
      this.tacticalCooldown = Math.max(0, this.tacticalCooldown - delta);
      this.updateStorm(delta);
      this.updateIslandEvents();
      this.updatePlayer(delta);
      this.updateEnemies(delta);
      this.updateCrates(delta);
      this.updateTracers(delta);
      this.updateCamera();

      if (this.livingEnemies === 0) this.finish(true);
      if (this.playerHp <= 0) this.finish(false);
    } else {
      this.updateCamera();
    }
    this.hud.update(this);
  }

  private createLighting() {
    this.scene.clearColor = new Color4(0.52, 0.78, 0.92, 1);
    const hemi = new HemisphericLight("sunny-hemi", new Vector3(0.2, 1, -0.1), this.scene);
    hemi.diffuse = Color3.FromHexString("#FFF5CD");
    hemi.groundColor = Color3.FromHexString("#90BFA2");
    hemi.intensity = 1.45;
    const sun = new DirectionalLight("sun", new Vector3(-0.45, -1, 0.25), this.scene);
    sun.position = new Vector3(30, 45, -25);
    sun.diffuse = Color3.FromHexString("#FFF1B2");
    sun.intensity = 1.05;
  }

  private createArena() {
    const ground = MeshBuilder.CreateGround("butter-meadow", { width: 140, height: 140, subdivisions: 2 }, this.scene);
    const groundMat = this.material("ground-mat", Color3.FromHexString("#C8DB88"));
    const texture = new Texture(ASSETS.terrain, this.scene);
    texture.uScale = 11;
    texture.vScale = 11;
    groundMat.diffuseTexture = texture;
    groundMat.specularColor = Color3.Black();
    ground.material = groundMat;

    const river = MeshBuilder.CreateGround("ribbon-river", { width: 14, height: 125 }, this.scene);
    river.position.x = -24;
    river.position.y = 0.02;
    river.rotation.y = -0.12;
    river.material = this.material("river-mat", Color3.FromHexString("#81CFE2"));

    const bridge = MeshBuilder.CreateBox("bridge", { width: 8, height: 0.45, depth: 3.4 }, this.scene);
    bridge.position.set(-24, 0.35, 4);
    bridge.rotation.y = -0.12;
    bridge.material = this.material("bridge-mat", Color3.FromHexString("#C98E62"));
    this.obstacles.push({ position: bridge.position.clone(), radius: 4.2 });

    const hillMat = this.material("hill-mat", Color3.FromHexString("#B9D183"));
    [[31, 1.4, -35, 13], [-37, 1, -25, 11], [28, 1.2, 32, 10], [-8, 1, -45, 12]].forEach(([x, y, z, size], index) => {
      const hill = MeshBuilder.CreateSphere(`hill-${index}`, { segments: 6, diameter: size }, this.scene);
      hill.position.set(x, -size * 0.32 + y, z);
      hill.scaling.y = 0.46;
      hill.material = hillMat;
    });

    this.createHouse(new Vector3(17, 0, 8), 0.25);
    this.createHouse(new Vector3(-8, 0, -26), -0.4);
    this.createWindmill(new Vector3(30, 0, -27));
    this.createMushroom(new Vector3(-13, 0, -5), 1.45, CORAL);
    this.createMushroom(new Vector3(-18, 0, -10), 0.9, Color3.FromHexString("#BCA5E8"));
    this.createMushroom(new Vector3(7, 0, -14), 1.1, BUTTER);
    this.createToyPath();

    [
      new Vector3(7, 0, 27), new Vector3(-12, 0, 15), new Vector3(22, 0, -5), new Vector3(-32, 0, -11),
      new Vector3(3, 0, -33), new Vector3(39, 0, 18), new Vector3(-42, 0, 29), new Vector3(12, 0, -42),
    ].forEach((position, index) => this.createTree(position, index));

    [
      new Vector3(10, 0, 18), new Vector3(-16, 0, 3), new Vector3(25, 0, -18), new Vector3(-30, 0, 18),
      new Vector3(35, 0, 31), new Vector3(-4, 0, -42), new Vector3(18, 0, 39),
    ].forEach((position, index) => this.createRock(position, index));
  }

  private createPlayer() {
    this.playerRoot.position.copyFrom(this.playerPosition);
    const jacket = MeshBuilder.CreateCylinder("player-jacket", { height: 1.15, diameterTop: 0.68, diameterBottom: 0.9, tessellation: 6 }, this.scene);
    jacket.position.y = 0.95;
    jacket.material = this.material("player-sky-blue", Color3.FromHexString("#4C8EB1"));
    jacket.parent = this.playerRoot;
    this.playerMeshes.push(jacket);
    const head = MeshBuilder.CreateSphere("player-head", { diameter: 0.63, segments: 6 }, this.scene);
    head.position.y = 1.76;
    head.material = this.material("player-peach", Color3.FromHexString("#FFD2AC"));
    head.parent = this.playerRoot;
    this.playerMeshes.push(head);
    const hood = MeshBuilder.CreateCylinder("player-hood", { height: 0.42, diameter: 0.73, tessellation: 6 }, this.scene);
    hood.position.y = 1.83;
    hood.material = this.material("hood-mat", Color3.FromHexString("#356986"));
    hood.parent = this.playerRoot;
    this.playerMeshes.push(hood);
    const backpack = MeshBuilder.CreateBox("player-backpack", { width: 0.68, height: 0.72, depth: 0.28 }, this.scene);
    backpack.position.set(0, 1.02, 0.49);
    backpack.material = this.material("backpack-mat", Color3.FromHexString("#F0A26D"));
    backpack.parent = this.playerRoot;
    this.playerMeshes.push(backpack);
    const blaster = MeshBuilder.CreateBox("toyblaster", { width: 0.3, height: 0.25, depth: 1.15 }, this.scene);
    blaster.position.set(0.38, 1.1, -0.52);
    blaster.rotation.z = -0.18;
    blaster.material = this.material("blaster-mat", CORAL);
    blaster.parent = this.playerRoot;
    this.playerMeshes.push(blaster);
  }

  private createEnemies() {
    const positions = [
      [1, 0, 5], [15, 0, 10], [-13, 0, 5], [19, 0, -12], [-22, 0, -8], [4, 0, -30], [-26, 0, 25], [31, 0, 28],
    ];
    const colors = [BUTTER, Color3.FromHexString("#BCA5E8"), CORAL, BUTTER, Color3.FromHexString("#BCA5E8"), CORAL, BUTTER, Color3.FromHexString("#BCA5E8")];
    positions.forEach((entry, index) => {
      const spawn = new Vector3(entry[0], entry[1], entry[2]);
      const role: EnemyRole = index % 3 === 0 ? "rusher" : index % 3 === 1 ? "strafer" : "scout";
      const root = new TransformNode(`enemy-${index}`, this.scene);
      root.position.copyFrom(spawn);
      const body = MeshBuilder.CreateCylinder(`enemy-body-${index}`, { height: 1.25, diameterTop: 0.7, diameterBottom: 0.88, tessellation: 6 }, this.scene);
      body.position.y = 0.85;
      body.material = this.material(`enemy-mat-${index}`, colors[index]);
      body.parent = root;
      const visor = MeshBuilder.CreateBox(`enemy-visor-${index}`, { width: 0.5, height: 0.22, depth: 0.13 }, this.scene);
      visor.position.set(0, 1.3, -0.4);
      visor.material = this.material(`enemy-visor-mat-${index}`, NAVY);
      visor.parent = root;
      const gun = MeshBuilder.CreateBox(`enemy-gun-${index}`, { width: 0.22, height: 0.2, depth: 0.82 }, this.scene);
      gun.position.set(0.35, 0.9, -0.42);
      gun.material = this.material(`enemy-gun-mat-${index}`, CREAM);
      gun.parent = root;
      this.enemies.push({
        root, body, hp: 60, maxHp: 60, cooldown: 0.7 + index * 0.09, wanderTime: index * 0.4,
        wanderDirection: new Vector3(Math.sin(index), 0, Math.cos(index)), mode: "patrol", role, alive: true, elite: false, baseColor: colors[index], spawn,
      });
    });
  }

  private createStormRing() {
    const points: Vector3[] = [];
    for (let index = 0; index <= 72; index += 1) {
      const angle = (index / 72) * Math.PI * 2;
      points.push(new Vector3(Math.cos(angle) * 52, 0.13, Math.sin(angle) * 52));
    }
    const line = MeshBuilder.CreateLines("storm-mint-line", { points, updatable: false }, this.scene);
    line.color = MINT;
    line.alpha = 0.96;
    const ring = MeshBuilder.CreateTorus("storm-mint-ring", { diameter: 104, thickness: 0.56, tessellation: 64 }, this.scene);
    ring.position.y = 0.16;
    const ringMaterial = this.material("storm-mint-material", MINT);
    ringMaterial.emissiveColor = MINT;
    ringMaterial.alpha = 0.9;
    ring.material = ringMaterial;
    return ring;
  }

  private createCrates() {
    const pickups: PickupKind[] = ["ammo", "shield", "juice", "ammo"];
    [new Vector3(-4, 0, 11), new Vector3(24, 0, 22), new Vector3(-19, 0, -20), new Vector3(12, 0, -17)].forEach((position, index) => {
      const kind = pickups[index];
      const root = new TransformNode(`crate-${index}`, this.scene);
      root.position.copyFrom(position);
      const box = MeshBuilder.CreateBox(`crate-box-${index}`, { size: 1.25 }, this.scene);
      box.position.y = 0.62;
      const crateColor = kind === "ammo" ? Color3.FromHexString("#37B9C5") : kind === "shield" ? Color3.FromHexString("#66CFE7") : Color3.FromHexString("#FF8C79");
      box.material = this.material(`crate-mat-${index}`, crateColor);
      box.parent = root;
      const badge = MeshBuilder.CreatePlane(`crate-badge-${index}`, { size: 0.82 }, this.scene);
      badge.position.set(0, 0.62, -0.64);
      badge.material = this.material(`crate-badge-mat-${index}`, kind === "shield" ? Color3.FromHexString("#66CFE7") : CREAM);
      badge.parent = root;
      this.crates.push({ root, kind, drop: false });
      this.obstacles.push({ position: position.clone(), radius: 1.05 });
    });
  }

  private createTree(position: Vector3, index: number) {
    const root = new TransformNode(`tree-${index}`, this.scene);
    root.position.copyFrom(position);
    const trunk = MeshBuilder.CreateCylinder(`tree-trunk-${index}`, { height: 2.2, diameterTop: 0.42, diameterBottom: 0.65, tessellation: 5 }, this.scene);
    trunk.position.y = 1.1;
    trunk.material = this.material(`trunk-mat-${index}`, Color3.FromHexString("#9A704F"));
    trunk.parent = root;
    const crown = MeshBuilder.CreateSphere(`tree-crown-${index}`, { diameter: 3.1, segments: 6 }, this.scene);
    crown.position.y = 3.05;
    crown.scaling.y = 0.82;
    crown.material = this.material(`crown-mat-${index}`, index % 2 === 0 ? SAGE : Color3.FromHexString("#83B56E"));
    crown.parent = root;
    this.obstacles.push({ position: position.clone(), radius: 1.55 });
  }

  private createRock(position: Vector3, index: number) {
    const rock = MeshBuilder.CreatePolyhedron(`rock-${index}`, { type: index % 3 }, this.scene);
    rock.position.copyFrom(position);
    rock.position.y = 0.72;
    rock.scaling.setAll(1.15 + (index % 2) * 0.35);
    rock.scaling.y = 0.8;
    rock.material = this.material(`rock-mat-${index}`, Color3.FromHexString(index % 2 ? "#A8B2B0" : "#909FA2"));
    this.obstacles.push({ position: position.clone(), radius: 1.3 });
  }

  private createHouse(position: Vector3, rotation: number) {
    const root = new TransformNode("cottage", this.scene);
    root.position.copyFrom(position);
    root.rotation.y = rotation;
    const walls = MeshBuilder.CreateBox("cottage-walls", { width: 4.2, height: 2.6, depth: 3.4 }, this.scene);
    walls.position.y = 1.3;
    walls.material = this.material("cottage-cream", CREAM);
    walls.parent = root;
    const roof = MeshBuilder.CreateCylinder("cottage-roof", { height: 4.6, diameter: 3.4, tessellation: 3 }, this.scene);
    roof.position.y = 3.2;
    roof.rotation.z = Math.PI / 2;
    roof.material = this.material("cottage-roof-mat", CORAL);
    roof.parent = root;
    this.obstacles.push({ position: position.clone(), radius: 3.1 });
  }

  private createWindmill(position: Vector3) {
    const root = new TransformNode("windmill", this.scene);
    root.position.copyFrom(position);
    const tower = MeshBuilder.CreateCylinder("windmill-tower", { height: 5.2, diameterTop: 1.1, diameterBottom: 1.9, tessellation: 5 }, this.scene);
    tower.position.y = 2.6;
    tower.material = this.material("windmill-tower-mat", CREAM);
    tower.parent = root;
    for (let index = 0; index < 4; index += 1) {
      const blade = MeshBuilder.CreateBox(`windmill-blade-${index}`, { width: 0.46, height: 2.6, depth: 0.14 }, this.scene);
      blade.position.set(0, 5.5, -0.8);
      blade.rotation.z = index * (Math.PI / 2);
      blade.material = this.material(`windmill-blade-mat-${index}`, Color3.FromHexString("#F3A966"));
      blade.parent = root;
    }
    this.obstacles.push({ position: position.clone(), radius: 2.1 });
  }

  private createMushroom(position: Vector3, scale: number, capColor: Color3) {
    const root = new TransformNode(`candy-mushroom-${position.x}-${position.z}`, this.scene);
    root.position.copyFrom(position);
    const stem = MeshBuilder.CreateCylinder(`mushroom-stem-${position.x}`, { height: 2.6 * scale, diameterTop: 0.48 * scale, diameterBottom: 0.74 * scale, tessellation: 6 }, this.scene);
    stem.position.y = 1.3 * scale;
    stem.material = this.material(`mushroom-stem-mat-${position.x}`, CREAM);
    stem.parent = root;
    const cap = MeshBuilder.CreateSphere(`mushroom-cap-${position.x}`, { diameter: 2.3 * scale, segments: 6 }, this.scene);
    cap.position.y = 2.7 * scale;
    cap.scaling.y = 0.55;
    cap.material = this.material(`mushroom-cap-mat-${position.x}`, capColor);
    cap.parent = root;
    this.obstacles.push({ position: position.clone(), radius: 1.15 * scale });
  }

  private createToyPath() {
    const pathMaterial = this.material("toy-path-mat", Color3.FromHexString("#F8E7B0"));
    [[-4, -16, 0.22, 0.32], [4, -8, 0.22, -0.48], [11, 1, 0.22, 0.35]].forEach(([x, z, y, rotation], index) => {
      const path = MeshBuilder.CreateBox(`toy-path-${index}`, { width: 5.6, height: 0.08, depth: 18 }, this.scene);
      path.position.set(x, y, z);
      path.rotation.y = rotation;
      path.material = pathMaterial;
    });
  }

  private updateStorm(delta: number) {
    const shrinkRate = 0.18 + this.stormStage * 0.055;
    const targetRadius = Math.max(10, 52 - this.roundElapsed * shrinkRate);
    this.stormRadius += (targetRadius - this.stormRadius) * Math.min(1, delta * 2);
    this.stormRing.scaling.set(this.stormRadius / 52, 1, this.stormRadius / 52);
    this.distanceToZone = Math.max(0, this.playerRoot.position.length() - this.stormRadius);
    if (this.distanceToZone > 0) this.applyPlayerDamage(delta * (5.5 + this.stormStage * 2.5));
  }

  private updateIslandEvents() {
    if (this.stormStage >= 3 && !this.eliteSpawned) this.spawnEliteEnemy();
    if (this.stormStage >= 4 && !this.supplyEventSpawned) this.spawnEmergencySupply();
  }

  private spawnEliteEnemy() {
    const elite = this.enemies.filter((enemy) => enemy.alive && !enemy.elite).sort((first, second) => Vector3.Distance(second.root.position, this.playerRoot.position) - Vector3.Distance(first.root.position, this.playerRoot.position))[0];
    if (!elite) return;
    elite.elite = true;
    elite.maxHp = 180;
    elite.hp = elite.maxHp;
    elite.body.scaling.setAll(1.38);
    const material = elite.body.material as StandardMaterial | null;
    if (material) {
      material.diffuseColor.copyFrom(CORAL);
      material.emissiveColor = Color3.FromHexString("#7E2E3A");
    }
    this.eliteSpawned = true;
    this.raiseEvent("エリート警報！ コーラル・コマンダー出現。", 3.2);
  }

  private spawnEmergencySupply() {
    [new Vector3(-2, 0, -2), new Vector3(3, 0, 1), new Vector3(1, 0, -4)].forEach((position, index) => this.spawnLootDrop(position, ["shield", "ammo", "juice"][index] as PickupKind));
    this.supplyEventSpawned = true;
    this.raiseEvent("緊急補給が島の中央に落ちた！", 3.2);
  }

  private raiseEvent(message: string, duration: number) {
    this.eventMessage = message;
    this.eventTimer = duration;
  }

  private updatePlayer(delta: number) {
    if (this.demo) this.updateDemoInput();
    const movement = this.input.movement();
    const forward = this.input.moveForward();
    const right = new Vector3(-forward.z, 0, forward.x);
    this.aiming = this.input.isAiming();
    this.sprinting = this.input.isSprinting() && movement.lengthSquared() > 0;
    const moveSpeed = this.aiming ? 6.7 : this.sprinting ? 13.2 : 9.1;
    const desiredVelocity = Vector3.Zero();
    if (movement.lengthSquared() > 0) {
      const desired = forward.scale(movement.z).add(right.scale(movement.x));
      desired.normalize();
      desiredVelocity.copyFrom(desired.scale(moveSpeed));
    }
    const response = movement.lengthSquared() > 0 ? 15 : 21;
    this.playerVelocity.copyFrom(Vector3.Lerp(this.playerVelocity, desiredVelocity, Math.min(1, delta * response)));
    if (this.playerVelocity.lengthSquared() > 0.003) this.moveActor(this.playerRoot, this.playerVelocity.scale(delta), 0.75);
    this.playerRoot.rotation.y = this.input.yaw + Math.PI;
    this.playerPosition.copyFrom(this.playerRoot.position);
    if (this.input.consumeShoulderSwap()) this.shoulderSide *= -1;
    if (this.input.consumeTactical() && this.tacticalCooldown <= 0 && !this.aiming) this.useMintHop(forward, movement);

    const selectedWeapon = this.input.consumeWeaponSelection();
    if (selectedWeapon && selectedWeapon !== this.weapon && this.switchCooldown <= 0) {
      this.weapon = selectedWeapon;
      this.switchCooldown = 0.14;
      this.burstShots = 0;
      this.burstTimer = 0;
    }
    if (this.input.consumeReload() && !this.reloading) this.beginReload();
    if (this.reloading) {
      this.reloadTimer -= delta;
      if (this.reloadTimer <= 0) this.completeReload();
    }
    if (this.burstShots > 0) {
      this.burstTimer -= delta;
      if (this.burstTimer <= 0) this.fireBurstShot();
    }
    if (!this.reloading && this.input.consumeShoot() && this.shotCooldown <= 0 && this.burstShots === 0) this.firePlayerWeapon();
  }

  private updateDemoInput() {
    const closest = this.closestLivingEnemy();
    if (!closest) return;
    const direction = closest.root.position.subtract(this.playerRoot.position);
    this.input.yaw = Math.atan2(direction.x, direction.z);
    this.input.pitch = 0.1;
    if (this.roundElapsed % 0.28 < 0.02) (this.input as unknown as { shootRequested: boolean }).shootRequested = true;
    if (this.playerRoot.position.length() > 17) this.playerRoot.position.scaleInPlace(0.992);
  }

  private updateEnemies(delta: number) {
    this.nearestEnemyDistance = Infinity;
    this.enemies.forEach((enemy, index) => {
      if (!enemy.alive) return;
      enemy.cooldown -= delta;
      const toCenter = enemy.root.position.length();
      const toPlayer = this.playerRoot.position.subtract(enemy.root.position);
      const distance = toPlayer.length();
      this.nearestEnemyDistance = Math.min(this.nearestEnemyDistance, distance);
      const direction = toPlayer.normalize();
      const danger = 1 + (this.stormStage - 1) * 0.14;
      const elitePower = enemy.elite ? 1.32 : 1;
      if (toCenter > this.stormRadius - 1.5) {
        enemy.mode = "storm";
        this.moveActor(enemy.root, enemy.root.position.scale(-1).normalize().scale(delta * 4.9), 0.66);
      } else if (distance < 16) {
        enemy.root.rotation.y = Math.atan2(direction.x, direction.z);
        let canFire = false;
        let fireRate = 1.3;
        let accuracy = 0.42;
        let damage = 6.5;
        if (enemy.role === "rusher") {
          enemy.mode = distance < 7.4 ? "shoot" : "chase";
          if (distance > 7.2) this.moveActor(enemy.root, direction.scale(delta * 4.3 * danger * elitePower), 0.66);
          canFire = distance < 10;
          fireRate = 1.08;
          accuracy = 0.48;
          damage = 7.4;
        } else if (enemy.role === "strafer") {
          enemy.mode = "strafe";
          if (distance > 10.5) this.moveActor(enemy.root, direction.scale(delta * 3.1 * danger * elitePower), 0.66);
          const lateral = new Vector3(-direction.z, 0, direction.x).scale(Math.sin(this.roundElapsed * 2.2 + index) > 0 ? 1 : -1);
          this.moveActor(enemy.root, lateral.scale(delta * 2.1), 0.66);
          canFire = distance < 15;
          fireRate = 0.92;
          accuracy = 0.36;
          damage = 5.8;
        } else {
          enemy.mode = distance < 8.2 ? "strafe" : "shoot";
          if (distance > 13) this.moveActor(enemy.root, direction.scale(delta * 2.65 * danger * elitePower), 0.66);
          if (distance < 8.2) this.moveActor(enemy.root, direction.scale(-delta * 2.35), 0.66);
          canFire = distance < 16;
          fireRate = 1.46;
          accuracy = 0.52;
          damage = 9.1;
        }
        if (canFire && enemy.cooldown <= 0) {
          enemy.cooldown = fireRate / (danger * elitePower);
          const hit = Math.max(0.15, accuracy - distance * 0.014);
          const tracerColor = enemy.role === "rusher" ? CORAL : enemy.role === "strafer" ? Color3.FromHexString("#BCA5E8") : BUTTER;
          this.spawnTracer(enemy.root.position.add(new Vector3(0, 1.15, 0)), this.playerRoot.position.add(new Vector3(0, 1.1, 0)), tracerColor);
          if (Math.random() < hit) this.applyPlayerDamage(damage * danger * elitePower);
        }
      } else {
        enemy.mode = "patrol";
        enemy.wanderTime -= delta;
        if (enemy.wanderTime <= 0) {
          enemy.wanderTime = 1.2 + Math.random() * 2.1;
          enemy.wanderDirection = new Vector3(Math.sin(index * 3.8 + this.roundElapsed), 0, Math.cos(index * 2.4 + this.roundElapsed)).normalize();
        }
        const patrolSpeed = enemy.role === "rusher" ? 2.2 : enemy.role === "strafer" ? 1.85 : 1.5;
        this.moveActor(enemy.root, enemy.wanderDirection.scale(delta * patrolSpeed), 0.66);
        enemy.root.rotation.y = Math.atan2(enemy.wanderDirection.x, enemy.wanderDirection.z);
      }
    });
  }

  private updateCrates(delta: number) {
    this.crates.forEach((crate, index) => {
      if (!crate.root.isEnabled()) return;
      crate.root.rotation.y += delta * 0.55;
      crate.root.position.y = Math.sin(this.roundElapsed * 1.6 + index) * 0.08;
      const distance = Vector3.Distance(crate.root.position, this.playerRoot.position);
      if (distance < 1.55) {
        crate.root.setEnabled(false);
        this.collectPickup(crate.kind);
      }
    });
  }

  private updateTracers(delta: number) {
    for (let index = this.tracers.length - 1; index >= 0; index -= 1) {
      const tracer = this.tracers[index];
      tracer.life -= delta;
      if (tracer.life <= 0) {
        tracer.mesh.dispose();
        this.tracers.splice(index, 1);
      }
    }
  }

  private firePlayerWeapon() {
    const config = WEAPONS[this.weapon];
    if (this.ammo < config.ammoCost) {
      this.beginReload();
      return;
    }
    if (this.weapon === "burst") {
      this.shotCooldown = config.cooldown * this.fireRateMultiplier;
      this.burstShots = 3;
      this.burstTimer = 0;
      return;
    }
    this.fireHitscan(config.damage * this.damageMultiplier, config.ammoCost, config.color);
    this.shotCooldown = config.cooldown * this.fireRateMultiplier;
    if (this.ammo < WEAPONS[this.weapon].ammoCost) this.beginReload();
  }

  private fireBurstShot() {
    if (this.ammo <= 0 || this.burstShots <= 0) {
      this.burstShots = 0;
      this.beginReload();
      return;
    }
    this.fireHitscan(WEAPONS.burst.damage * this.damageMultiplier, 1, WEAPONS.burst.color);
    this.burstShots -= 1;
    this.burstTimer = 0.09 * this.fireRateMultiplier;
    if (this.burstShots <= 0 && this.ammo <= 0) this.beginReload();
  }

  private fireHitscan(damage: number, ammoCost: number, color: Color3) {
    this.ammo -= ammoCost;
    const origin = this.playerRoot.position.add(new Vector3(0, 1.18, 0));
    const look = this.input.lookDirection();
    const target = origin.add(look.scale(35));
    const enemy = this.closestEnemyInAim(look, origin);
    if (enemy) {
      target.copyFrom(enemy.root.position.add(new Vector3(0, 1.12, 0)));
      enemy.hp -= damage;
      this.hud.hitMarker();
      if (enemy.hp <= 0) this.eliminateEnemy(enemy);
    }
    this.spawnTracer(origin, target, color);
  }

  private beginReload() {
    if (this.reloading || this.ammo >= 18 || this.reserve <= 0) return;
    this.reloading = true;
    this.reloadTimer = 1.15;
  }

  private completeReload() {
    const needed = 18 - this.ammo;
    const load = Math.min(needed, this.reserve);
    this.ammo += load;
    this.reserve -= load;
    this.reloading = false;
  }

  private closestEnemyInAim(look: Vector3, origin: Vector3) {
    const candidates = this.enemies.filter((enemy) => {
      if (!enemy.alive) return false;
      const direction = enemy.root.position.add(new Vector3(0, 1.12, 0)).subtract(origin);
      const distance = direction.length();
      const alignment = Vector3.Dot(direction.normalize(), look);
      return distance < 36 && alignment > 0.965;
    });
    return candidates.sort((first, second) => Vector3.Distance(first.root.position, this.playerRoot.position) - Vector3.Distance(second.root.position, this.playerRoot.position))[0] ?? null;
  }

  private closestLivingEnemy() {
    return this.enemies.filter((enemy) => enemy.alive).sort((first, second) => Vector3.Distance(first.root.position, this.playerRoot.position) - Vector3.Distance(second.root.position, this.playerRoot.position))[0] ?? null;
  }

  private eliminateEnemy(enemy: Enemy) {
    enemy.alive = false;
    enemy.root.setEnabled(false);
    this.livingEnemies -= 1;
    this.eliminated += 1;
    this.score += enemy.elite ? 420 : 145;
    const drops: PickupKind[] = ["shield", "ammo", "juice"];
    this.spawnLootDrop(enemy.root.position, drops[this.eliminated % drops.length]);
    if (this.eliminated >= this.nextUpgradeAt && this.livingEnemies > 0) this.offerUpgrades();
  }

  private spawnLootDrop(position: Vector3, kind: PickupKind) {
    const root = new TransformNode(`loot-drop-${this.eliminated}`, this.scene);
    root.position.copyFrom(position);
    const color = kind === "shield" ? Color3.FromHexString("#66CFE7") : kind === "ammo" ? Color3.FromHexString("#37B9C5") : CORAL;
    const core = MeshBuilder.CreatePolyhedron(`loot-core-${this.eliminated}`, { type: kind === "ammo" ? 2 : 1, size: 0.82 }, this.scene);
    core.position.y = 0.78;
    core.material = this.material(`loot-core-mat-${this.eliminated}`, color);
    core.parent = root;
    const beacon = MeshBuilder.CreateCylinder(`loot-beacon-${this.eliminated}`, { height: 1.55, diameter: 0.13, tessellation: 6 }, this.scene);
    beacon.position.y = 1.65;
    const beaconMaterial = this.material(`loot-beacon-mat-${this.eliminated}`, color);
    beaconMaterial.emissiveColor = color;
    beaconMaterial.alpha = 0.68;
    beacon.material = beaconMaterial;
    beacon.parent = root;
    this.crates.push({ root, kind, drop: true });
  }

  private useMintHop(forward: Vector3, movement: Vector3) {
    const right = new Vector3(-forward.z, 0, forward.x);
    const direction = movement.lengthSquared() > 0
      ? forward.scale(movement.z).add(right.scale(movement.x)).normalize()
      : forward;
    this.moveActor(this.playerRoot, direction.scale(6.4), 0.75);
    this.playerVelocity.copyFrom(direction.scale(11));
    this.tacticalCooldown = 5.6 * this.hopCooldownMultiplier;
    this.pickupMessage = "ミント・ホップ · 位置を変えろ";
    this.pickupTimer = 1.1;
  }

  private applyPlayerDamage(amount: number) {
    const shieldAbsorbed = Math.min(this.shield, amount);
    this.shield -= shieldAbsorbed;
    this.playerHp = Math.max(0, this.playerHp - (amount - shieldAbsorbed));
    this.hud.damageFlash();
  }

  private collectPickup(kind: PickupKind) {
    if (kind === "ammo") {
      this.reserve = Math.min(144, this.reserve + 24);
      this.pickupMessage = "+24 AMMO · ドロップ補給";
    } else if (kind === "shield") {
      this.shield = Math.min(this.shieldCap, this.shield + 25);
      this.pickupMessage = "+25 SHIELD · ミントガード";
    } else {
      this.playerHp = Math.min(100, this.playerHp + 32);
      this.pickupMessage = "+32 HP · ストロベリージュース";
    }
    this.pickupTimer = 1.7;
  }

  private spawnTracer(from: Vector3, to: Vector3, color: Color3) {
    const tracer = MeshBuilder.CreateLines(`tracer-${performance.now()}`, { points: [from, to] }, this.scene);
    tracer.color = color;
    tracer.alpha = 0.95;
    this.tracers.push({ mesh: tracer, life: 0.08 });
  }

  private updateCamera() {
    const forward = this.input.moveForward();
    const look = this.input.lookDirection();
    const right = new Vector3(-forward.z, 0, forward.x);
    const aimDistance = this.aiming ? 4.55 : 7.65;
    const shoulderOffset = (this.aiming ? 1.48 : 1.82) * this.shoulderSide;
    const shoulderVector = right.scale(shoulderOffset);
    const cameraPosition = this.playerRoot.position.subtract(forward.scale(aimDistance)).add(shoulderVector).add(new Vector3(0, this.aiming ? 2.35 : 3.65, 0));
    const constrainedPosition = this.constrainCameraPosition(cameraPosition);
    const lookOrigin = this.playerRoot.position.add(shoulderVector.scale(0.14)).add(new Vector3(0, 1.22, 0));
    const target = lookOrigin.add(look.scale(this.aiming ? 19 : 15));
    this.camera.position.copyFrom(Vector3.Lerp(this.camera.position, constrainedPosition, this.aiming ? 0.28 : 0.2));
    this.camera.fov += ((this.aiming ? 0.82 : 1.05) - this.camera.fov) * 0.2;
    this.camera.setTarget(target);
    const targetVisibility = this.aiming ? 0.3 : 1;
    this.playerMeshes.forEach((mesh) => {
      mesh.visibility += (targetVisibility - mesh.visibility) * 0.28;
    });
  }

  private constrainCameraPosition(desiredPosition: Vector3) {
    const constrained = desiredPosition.clone();
    this.obstacles.forEach((obstacle) => {
      const offset = constrained.subtract(obstacle.position);
      offset.y = 0;
      const safeDistance = obstacle.radius + 0.85;
      if (offset.lengthSquared() < safeDistance * safeDistance) {
        if (offset.lengthSquared() < 0.001) offset.x = 0.01;
        offset.normalize();
        constrained.x = obstacle.position.x + offset.x * safeDistance;
        constrained.z = obstacle.position.z + offset.z * safeDistance;
      }
    });
    return constrained;
  }

  private moveActor(root: TransformNode, delta: Vector3, radius: number) {
    const next = root.position.add(delta);
    const boundary = 64;
    next.x = Math.max(-boundary, Math.min(boundary, next.x));
    next.z = Math.max(-boundary, Math.min(boundary, next.z));
    this.obstacles.forEach((obstacle) => {
      const offset = next.subtract(obstacle.position);
      offset.y = 0;
      const minDistance = radius + obstacle.radius;
      if (offset.lengthSquared() < minDistance * minDistance) {
        if (offset.lengthSquared() < 0.001) offset.x = 0.01;
        offset.normalize();
        next.copyFrom(obstacle.position.add(offset.scale(minDistance)));
      }
    });
    root.position.copyFrom(next);
  }

  private finish(victory: boolean) {
    if (this.state !== "playing") return;
    this.state = victory ? "victory" : "defeat";
    document.exitPointerLock?.();
    const finalScore = this.score + Math.round(this.roundElapsed * 12) + (victory ? 260 : 0);
    const badges = Math.max(1, Math.floor(finalScore / 340) + (victory ? 2 : 0));
    this.lifetimeBadges += badges;
    try { window.localStorage.setItem("pocket-storm-island-badges", String(this.lifetimeBadges)); } catch { /* optional browser persistence */ }
    this.hud.showResult(victory, {
      eliminated: this.eliminated,
      score: finalScore,
      badges,
      totalBadges: this.lifetimeBadges,
      unlock: this.nextUnlockText(),
    });
  }

  private readLifetimeBadges() {
    try { return Math.max(0, Number(window.localStorage.getItem("pocket-storm-island-badges")) || 0); } catch { return 0; }
  }

  private nextUnlockText() {
    const unlocks = [
      { at: 5, label: "風車ランナー・バッジ" },
      { at: 12, label: "コメット・デカール" },
      { at: 24, label: "嵐越えの王冠" },
    ];
    const next = unlocks.find((unlock) => this.lifetimeBadges < unlock.at);
    return next ? `あと${next.at - this.lifetimeBadges}バッジで「${next.label}」。` : "すべての島バッジを集めた！";
  }

  private material(name: string, color: Color3) {
    const material = new StandardMaterial(name, this.scene);
    material.diffuseColor = color;
    material.specularColor = Color3.Black();
    return material;
  }

  private texturedMaterial(name: string, url: string) {
    const material = new StandardMaterial(name, this.scene);
    material.diffuseTexture = new Texture(url, this.scene);
    material.useAlphaFromDiffuseTexture = true;
    material.specularColor = Color3.Black();
    return material;
  }

  public dispose() {
    this.input.dispose();
    this.hud.dispose();
    this.tracers.forEach((tracer) => tracer.mesh.dispose());
  }
}

export async function createGameScene(engine: Engine, canvas: HTMLCanvasElement): Promise<GameHandle> {
  const scene = new Scene(engine);
  const world = new GameWorld(scene, canvas);
  const observer = scene.onBeforeRenderObservable.add(() => {
    world.update(Math.min(0.05, scene.getEngine().getDeltaTime() / 1000));
  });
  return {
    scene,
    dispose: () => {
      scene.onBeforeRenderObservable.remove(observer);
      world.dispose();
      scene.dispose();
    },
  };
}
