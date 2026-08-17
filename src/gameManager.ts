import { AudioManager } from './audio/audioManager';
import { Camera } from './core/camera';
import { FIXED_DT, GAME_HEIGHT, GAME_WIDTH, MAX_FRAME_DT } from './core/config';
import { Input } from './core/input';
import { clamp, dist } from './core/math';
import { CHARACTERS } from './data/characters';
import { ITEMS } from './data/items';
import { Companion } from './entities/companion';
import type { Enemy } from './entities/enemy';
import { Chest, Interactive } from './entities/interactive';
import type { Pickup } from './entities/pickup';
import { Player } from './entities/player';
import { Background } from './gfx/background';
import { loadAssets, type Assets } from './gfx/assets';
import { Lighting } from './gfx/lighting';
import { Particles } from './gfx/particles';
import type { Renderer } from './gfx/renderer';
import { castleLevel } from './levels/castle';
import { forestLevel } from './levels/forest';
import { spaceLevel } from './levels/space';
import type { LevelDef, LevelHooks } from './levels/level';
import { QuestManager, QUESTS } from './quest/questManager';
import { DEFAULT_SETTINGS, SaveManager, type SaveData, type Settings } from './save/saveManager';
import { Trail } from './systems/follow';
import { World } from './systems/world';
import { DialogueBox } from './ui/dialogue';
import { Hud } from './ui/hud';
import { Menus } from './ui/menus';
import { TouchControls } from './ui/touchControls';

type GameState = 'title' | 'playing' | 'paused' | 'inventory' | 'settings' | 'gameover' | 'ending' | 'transition';

const LEVELS: Record<number, LevelDef> = {
  1: forestLevel,
  2: castleLevel,
  3: spaceLevel,
};

/**
 * Top-level orchestrator.
 *
 * Owns the systems, runs the fixed-step loop, routes input to either gameplay
 * or the menus, and implements `LevelHooks` so level scripts can drive the
 * story without knowing about any of it.
 */
export class GameManager implements LevelHooks {
  private renderer: Renderer;
  private input = new Input();
  private world = new World();
  private camera = new Camera();
  private particles = new Particles();
  private lighting = new Lighting();
  private background = new Background();
  private audio = new AudioManager();
  private quests = new QuestManager();
  private saves = new SaveManager();
  private hud = new Hud();
  private menus = new Menus();
  private dialogue = new DialogueBox();
  private touch: TouchControls;
  private assets!: Assets;

  private state: GameState = 'title';
  private player: Player | null = null;
  private companions: Companion[] = [];
  private trail = new Trail();
  private currentWorld = 1;
  private currentLevel: LevelDef = forestLevel;
  private checkpoints: Record<string, { x: number; y: number }> = {};
  private lastCheckpoint = { x: 0, y: 0 };
  private lastZoneId = '';
  private inventory: Record<string, number> = {};
  private slot = 0;
  private playTime = 0;
  private accumulator = 0;
  private lastFrame = 0;
  private clock = 0;
  private transition = { time: 0, duration: 1.6, target: 1 };
  private settings: Settings = { ...DEFAULT_SETTINGS };
  private bossActive = false;
  private autosaveTimer = 0;

  constructor(renderer: Renderer) {
    this.renderer = renderer;
    this.touch = new TouchControls(this.input, renderer);
    this.world.particles = this.particles;
    this.world.camera = this.camera;
    this.world.onEnemyDefeated = (enemy) => this.onEnemyDefeated(enemy);
    this.input.attachKeyboard(window);

    this.touch.onSystemButton = (id) => {
      this.audio.unlock();
      if (this.state === 'playing') this.openMenu(id === 'pause' ? 'paused' : 'inventory');
      else if (this.state === 'paused' || this.state === 'inventory' || this.state === 'settings') this.resume();
    };
    this.touch.onMenuPointer = (x, y) => this.onMenuTap(x, y);
    this.touch.onTapAnywhere = () => {
      this.audio.unlock();
      if (this.dialogue.active) this.dialogue.advance();
    };
  }

  async boot(): Promise<void> {
    this.assets = await loadAssets();
    this.world.assets = this.assets;
    this.settings = this.saves.loadSettings();
    this.applySettings();
    if (this.assets.overridden.length > 0) {
      console.info('[assets] sheets loaded from disk:', this.assets.overridden.join(', '));
    }
    this.installDebugApi();
    this.enterTitle();
    this.lastFrame = performance.now();
    requestAnimationFrame(this.frame);
  }

  /* ------------------------------------------------------------ main loop */

  private frame = (now: number): void => {
    const raw = (now - this.lastFrame) / 1000;
    this.lastFrame = now;
    const dt = Math.min(MAX_FRAME_DT, Math.max(0, raw));
    this.clock += dt;

    this.audio.update(dt);
    this.input.update(dt);
    this.step(dt);
    this.draw();
    requestAnimationFrame(this.frame);
  };

  private step(dt: number): void {
    switch (this.state) {
      case 'playing':
        this.updatePlaying(dt);
        break;
      case 'transition':
        this.updateTransition(dt);
        break;
      default:
        // Menus keep the background world frozen but the UI animated.
        this.hud.update(dt);
        break;
    }
    this.handleSystemKeys();
  }

  private updatePlaying(dt: number): void {
    this.playTime += dt;
    this.autosaveTimer += dt;
    this.hud.update(dt);
    this.dialogue.update(dt);
    this.background.update(dt);
    this.lighting.update(dt);

    const player = this.player;
    if (!player) return;

    const busy = this.dialogue.active;
    player.cutsceneLock = busy;

    if (!busy) {
      if (this.input.pressed('dodge')) {
        this.input.consume('dodge');
        if (player.tryDodge()) this.audio.playSfx('dodge');
      }
      if (this.input.pressed('interact')) {
        this.input.consume('interact');
        this.tryInteract();
      }
    } else if (this.input.pressed('interact') || this.input.pressed('attack')) {
      this.input.consume('interact');
      this.input.consume('attack');
      this.dialogue.advance();
    }

    // Fixed-step simulation keeps physics identical on every device.
    this.accumulator += dt;
    let steps = 0;
    while (this.accumulator >= FIXED_DT && steps < 5) {
      this.accumulator -= FIXED_DT;
      steps++;
      if (this.world.hitstop > 0) {
        this.world.hitstop -= FIXED_DT;
        continue;
      }
      this.world.update(FIXED_DT);
      this.trail.record(player.x, player.y);
      this.particles.update(FIXED_DT, this.camera.x, this.camera.y);
      this.checkTriggers();
      this.collectPickups();
    }

    this.camera.follow(player.x, player.y - 8, dt);
    // Entering a new camera zone arms the checkpoint the player respawns at.
    const zoneId = this.camera.activeZoneId;
    if (zoneId && zoneId !== this.lastZoneId) {
      this.lastZoneId = zoneId;
      const spot = this.checkpoints[zoneId];
      if (spot) this.lastCheckpoint = { ...spot };
    }
    this.hud.objective = this.quests.currentObjective(this.currentWorld);
    this.updateBossState();

    if (player.isDead && player.deathTimer > 1.4) {
      this.state = 'gameover';
      this.touch.menuMode = true;
      this.audio.playMusic(null);
    }
    if (this.autosaveTimer > 30) {
      this.autosaveTimer = 0;
      this.saveGame(this.slot);
    }
  }

  private updateTransition(dt: number): void {
    this.transition.time += dt;
    if (this.transition.time >= this.transition.duration * 0.5 && this.transition.target !== this.currentWorld) {
      if (this.transition.target >= 4) {
        this.state = 'ending';
        this.touch.menuMode = true;
        this.audio.playMusic('victory');
        return;
      }
      this.loadWorld(this.transition.target);
    }
    if (this.transition.time >= this.transition.duration) {
      this.state = 'playing';
    }
  }

  private handleSystemKeys(): void {
    if (this.input.pressed('pause')) {
      this.input.consume('pause');
      if (this.state === 'playing') this.openMenu('paused');
      else if (this.state !== 'title') this.resume();
    }
    if (this.input.pressed('menu')) {
      this.input.consume('menu');
      if (this.state === 'playing') this.openMenu('inventory');
      else if (this.state === 'inventory') this.resume();
    }
  }

  /* ----------------------------------------------------------- interaction */

  private tryInteract(): void {
    const player = this.player;
    if (!player) return;
    let best: Interactive | null = null;
    let bestD = Infinity;
    for (const entity of this.world.entitiesOfKind('interactive')) {
      const interactive = entity as Interactive;
      if (interactive.autoTrigger || !interactive.canInteract(player.x, player.y)) continue;
      const d = dist(player.x, player.y, interactive.x, interactive.y);
      if (d < bestD) {
        bestD = d;
        best = interactive;
      }
    }
    if (!best) return;
    if (best instanceof Chest) this.audio.playSfx('chest');
    else this.audio.playSfx('menu');
    best.interact();
  }

  private checkTriggers(): void {
    const player = this.player;
    if (!player) return;
    for (const entity of this.world.entitiesOfKind('interactive')) {
      const interactive = entity as Interactive;
      if (interactive.autoTrigger) {
        if (interactive.canInteract(player.x, player.y)) interactive.interact();
        continue;
      }
      interactive.showPrompt = interactive.canInteract(player.x, player.y);
    }
  }

  private collectPickups(): void {
    const player = this.player;
    if (!player) return;
    for (const entity of this.world.entitiesOfKind('pickup')) {
      const pickup = entity as Pickup;
      if (dist(player.x, player.y, pickup.x, pickup.y) > 14) continue;
      pickup.alive = false;
      this.giveItem(pickup.itemId);
      this.audio.playSfx('pickup');
      const item = ITEMS[pickup.itemId];
      if (item) this.hud.toast(item.name.toUpperCase());
    }
  }

  /** The boss the HUD should show: alive, in this room, and already fighting. */
  private engagedBoss(): Enemy | null {
    const player = this.player;
    if (!player) return null;
    for (const entity of this.world.entitiesOfKind('enemy')) {
      const enemy = entity as Enemy;
      if (!enemy.isBoss || enemy.isDead) continue;
      if (enemy.isEngaged || dist(player.x, player.y, enemy.x, enemy.y) < 200) return enemy;
    }
    return null;
  }

  private updateBossState(): void {
    const boss = this.engagedBoss();
    const active = Boolean(boss && !boss.isDead);
    if (active !== this.bossActive) {
      this.bossActive = active;
      if (!active) this.audio.playMusic(this.currentLevel.music);
    }
  }

  private onEnemyDefeated(enemy: { defeatFlag?: string; isBoss: boolean }): void {
    if (enemy.defeatFlag) this.setFlag(enemy.defeatFlag);
    if (enemy.isBoss) {
      this.bossMusic(false);
      this.hud.toast('GARDIEN VAINCU !');
      this.audio.playSfx('levelUp');
    }
  }

  /* ------------------------------------------------------------ level flow */

  private enterTitle(): void {
    this.state = 'title';
    this.touch.menuMode = true;
    this.touch.visible = false;
    this.audio.playMusic(null);
  }

  startNewGame(slot: number): void {
    this.slot = slot;
    this.quests.clear();
    this.inventory = {};
    this.playTime = 0;
    this.companions = [];
    this.player = null;
    this.loadWorld(1);
    this.beginTransition(1);
  }

  loadGame(slot: number): void {
    const data = this.saves.load(slot);
    if (!data) {
      this.startNewGame(slot);
      return;
    }
    this.slot = slot;
    this.quests.load(data.flags);
    this.inventory = { ...data.inventory };
    this.playTime = data.playTime;
    this.companions = [];
    this.player = null;
    this.loadWorld(data.world, data);
    this.beginTransition(data.world);
  }

  private beginTransition(target: number): void {
    this.transition = { time: 0, duration: 1.4, target };
    this.state = 'transition';
    this.touch.menuMode = false;
    this.touch.visible = true;
  }

  private loadWorld(index: number, save?: SaveData): void {
    const level = LEVELS[index] ?? forestLevel;
    this.currentLevel = level;
    this.currentWorld = index;

    const keepPlayer = this.player;
    const result = level.build(this.world, this);
    this.checkpoints = result.checkpoints;
    this.lastCheckpoint = { ...result.spawn };
    this.lastZoneId = '';

    // Player.
    const player = keepPlayer ?? new Player(this.assets.knight, this.input, save?.knight.level ?? 1);
    player.world = this.world;
    if (save) {
      player.applyLevel(save.knight.level);
      player.xp = save.knight.xp;
      player.hp = clamp(save.knight.hp, 1, player.maxHp);
      player.mp = clamp(save.knight.mp, 0, player.maxMp);
    }
    player.events = {
      onLevelUp: () => {
        this.audio.playSfx('levelUp');
        this.hud.toast(`NIVEAU ${player.level} !`);
      },
      onDeath: () => this.audio.playSfx('hurt'),
    };
    const spawn = save && save.world === index ? { x: save.x, y: save.y } : result.spawn;
    player.x = spawn.x;
    player.y = spawn.y;
    player.alive = true;
    // Reaching a new world always puts the party back on its feet.
    if (player.isDead) player.hp = Math.max(1, Math.round(player.maxHp * 0.5));
    player.state = 'idle';
    player.invuln = 1;
    this.player = player;
    this.world.add(player);
    this.trail.reset(player.x, player.y);
    this.lastCheckpoint = { ...spawn };

    // Party: rebuilt from the quest flags so it survives world changes.
    this.companions = [];
    if (this.quests.has('party.princess')) {
      this.spawnCompanion('princess', save?.princess?.level ?? player.level, save?.princess ?? null);
    }
    if (this.quests.has('party.wizard')) {
      this.spawnCompanion('wizard', save?.wizard?.level ?? player.level, save?.wizard ?? null);
    }

    // Presentation.
    this.camera.setZones(result.zones);
    this.camera.snapTo(player.x, player.y);
    this.background.setTheme(level.theme, this.world.tilemap.widthPx, this.world.tilemap.heightPx);
    this.lighting.configure(level.lighting);
    this.particles.clear();
    this.particles.setAmbient(level.ambient);
    this.audio.playMusic(level.music);
    this.hud.worldTitle = level.subtitle;
    this.hud.objective = this.quests.currentObjective(index);
    this.world.flush();
  }

  private spawnCompanion(
    id: 'princess' | 'wizard',
    level: number,
    save: { hp: number; mp: number; xp: number } | null,
  ): Companion {
    const slot = this.companions.length + 1;
    const bank = id === 'princess' ? this.assets.princess : this.assets.wizard;
    const companion = new Companion(id, bank, this.player!, this.trail, slot, level);
    companion.world = this.world;
    if (save) {
      companion.hp = clamp(save.hp, 1, companion.maxHp);
      companion.mp = clamp(save.mp, 0, companion.maxMp);
      companion.xp = save.xp;
    }
    const spot = this.trail.pointBehind(CHARACTERS[id].base.followDistance * slot);
    companion.x = spot.x;
    companion.y = spot.y;
    this.companions.push(companion);
    this.world.add(companion);
    return companion;
  }

  /* --------------------------------------------------------- level hooks */

  startDialogue(id: string, onDone?: () => void): void {
    this.dialogue.start(id as never, onDone);
  }

  setFlag(flag: string): void {
    this.quests.setFlag(flag);
    this.hud.objective = this.quests.currentObjective(this.currentWorld);
  }

  hasFlag(flag: string): boolean {
    return this.quests.has(flag);
  }

  joinPrincess(x: number, y: number): void {
    const companion = this.spawnCompanion('princess', this.player?.level ?? 1, null);
    companion.x = x;
    companion.y = y;
    this.audio.playSfx('heal');
    this.hud.toast('LYRA REJOINT LE GROUPE');
  }

  joinWizard(x: number, y: number): void {
    const companion = this.spawnCompanion('wizard', this.player?.level ?? 1, null);
    companion.x = x;
    companion.y = y;
    this.audio.playSfx('magic');
    this.hud.toast('ORIN REJOINT LE GROUPE');
  }

  giveItem(itemId: string, quantity = 1): void {
    this.inventory[itemId] = (this.inventory[itemId] ?? 0) + quantity;
    const item = ITEMS[itemId];
    if (item?.kind === 'quest') this.setFlag(`item.${itemId}`);
    if (item?.kind === 'key') this.setFlag(`item.${itemId}`);
  }

  hasItem(itemId: string): boolean {
    return (this.inventory[itemId] ?? 0) > 0;
  }

  consumeItem(itemId: string): boolean {
    if (!this.hasItem(itemId)) return false;
    this.inventory[itemId] -= 1;
    if (this.inventory[itemId] <= 0) delete this.inventory[itemId];
    return true;
  }

  goToWorld(index: number): void {
    this.saveGame(this.slot);
    this.beginTransition(index);
  }

  showToast(text: string): void {
    this.hud.toast(text);
  }

  bossMusic(on: boolean): void {
    this.audio.playMusic(on ? 'boss' : this.currentLevel.music);
    if (on) this.audio.playSfx('bossRoar');
  }

  /* ------------------------------------------------------------- menus */

  private openMenu(state: GameState): void {
    this.state = state;
    this.touch.menuMode = true;
    this.touch.releaseAll();
    this.audio.playSfx('menu');
  }

  private resume(): void {
    this.state = 'playing';
    this.touch.menuMode = false;
    this.touch.visible = true;
    this.lastFrame = performance.now();
  }

  private onMenuTap(x: number, y: number): void {
    this.audio.unlock();
    const id = this.menus.hit(x, y);
    if (!id) return;
    this.audio.playSfx('menu');

    if (this.state === 'title') {
      if (id.startsWith('erase')) {
        const slot = Number(id.slice(5));
        this.saves.erase(slot);
        return;
      }
      if (id.startsWith('slot')) {
        const slot = Number(id.slice(4));
        const existing = this.saves.load(slot);
        if (existing) this.loadGame(slot);
        else this.startNewGame(slot);
      }
      return;
    }

    if (this.state === 'gameover') {
      if (id === 'retry') this.respawn();
      if (id === 'title') this.enterTitle();
      return;
    }

    if (this.state === 'ending') {
      if (id === 'title') this.enterTitle();
      return;
    }

    if (this.state === 'paused') {
      switch (id) {
        case 'resume':
          this.resume();
          break;
        case 'inventory':
          this.state = 'inventory';
          break;
        case 'settings':
          this.state = 'settings';
          break;
        case 'save':
          this.hud.toast(this.saveGame(this.slot) ? 'PARTIE SAUVEGARDÉE' : 'SAUVEGARDE IMPOSSIBLE');
          break;
        case 'title':
          this.saveGame(this.slot);
          this.enterTitle();
          break;
      }
      return;
    }

    if (this.state === 'inventory') {
      if (id === 'close') {
        this.state = 'paused';
        return;
      }
      if (id.startsWith('use:')) this.useItem(id.slice(4));
      return;
    }

    if (this.state === 'settings') {
      if (id === 'close') {
        this.state = 'paused';
        return;
      }
      const [key, dir] = id.split(':');
      const delta = dir === 'up' ? 0.1 : -0.1;
      if (key === 'music') this.settings.musicVolume = clamp(this.settings.musicVolume + delta, 0, 1);
      if (key === 'sfx') this.settings.sfxVolume = clamp(this.settings.sfxVolume + delta, 0, 1);
      if (key === 'shake') this.settings.screenShake = !this.settings.screenShake;
      if (key === 'hand') this.settings.leftHanded = !this.settings.leftHanded;
      this.applySettings();
      this.saves.saveSettings(this.settings);
    }
  }

  private applySettings(): void {
    this.audio.setVolumes(this.settings.musicVolume, this.settings.sfxVolume);
    this.touch.leftHanded = this.settings.leftHanded;
    this.touch.layout();
  }

  private useItem(itemId: string): void {
    const item = ITEMS[itemId];
    const player = this.player;
    if (!item || !player || !this.consumeItem(itemId)) return;
    if (item.healHp) {
      player.heal(item.healHp);
      this.audio.playSfx('heal');
    }
    if (item.healMp) {
      player.restoreMp(item.healMp);
      for (const c of this.companions) c.restoreMp(item.healMp);
      this.audio.playSfx('magic');
    }
    this.hud.toast(`${item.name.toUpperCase()} UTILISÉ`);
  }

  private respawn(): void {
    const player = this.player;
    if (!player) {
      this.enterTitle();
      return;
    }
    player.hp = Math.round(player.maxHp * 0.6);
    player.mp = Math.round(player.maxMp * 0.5);
    player.state = 'idle';
    player.invuln = 1.2;
    player.x = this.lastCheckpoint.x;
    player.y = this.lastCheckpoint.y;
    player.alive = true;
    this.world.add(player);
    this.trail.reset(player.x, player.y);
    for (const companion of this.companions) {
      companion.hp = Math.round(companion.maxHp * 0.6);
      companion.state = 'idle';
      companion.x = player.x;
      companion.y = player.y;
      if (!companion.alive) {
        companion.alive = true;
        this.world.add(companion);
      }
    }
    this.camera.snapTo(player.x, player.y);
    this.audio.playMusic(this.currentLevel.music);
    this.resume();
  }

  private saveGame(slot: number): boolean {
    const player = this.player;
    if (!player) return false;
    const princess = this.companions.find((c) => c.charId === 'princess');
    const wizard = this.companions.find((c) => c.charId === 'wizard');
    return this.saves.save(slot, {
      world: this.currentWorld,
      zone: this.camera.activeZoneId ?? 'A',
      x: player.x,
      y: player.y,
      playTime: this.playTime,
      knight: { level: player.level, xp: player.xp, hp: player.hp, mp: player.mp },
      princess: princess ? { level: princess.level, xp: princess.xp, hp: princess.hp, mp: princess.mp } : null,
      wizard: wizard ? { level: wizard.level, xp: wizard.xp, hp: wizard.hp, mp: wizard.mp } : null,
      inventory: { ...this.inventory },
      flags: this.quests.serialize(),
    });
  }

  /* ------------------------------------------------------------- rendering */

  private draw(): void {
    const ctx = this.renderer.ctx;
    ctx.imageSmoothingEnabled = false;

    if (this.state === 'title') {
      this.menus.drawTitle(ctx, this.saves.listSlots(), this.clock);
      this.touch.draw(ctx);
      this.renderer.present();
      return;
    }
    if (this.state === 'ending') {
      this.menus.drawEnding(ctx, this.clock, { level: this.player?.level ?? 1, playTime: this.playTime });
      this.renderer.present();
      return;
    }

    this.drawWorld(ctx);

    const player = this.player;
    if (player) {
      this.hud.draw(ctx, player, this.companions, this.engagedBoss(), countItems(this.inventory));
    }

    if (this.state === 'playing' || this.state === 'transition') {
      this.touch.visible = !this.dialogue.active;
      this.touch.draw(ctx, player?.chargeRatio ?? 0, (player?.skillCooldownRatio ?? 0) <= 0);
      this.dialogue.draw(ctx);
    }

    switch (this.state) {
      case 'paused':
        this.menus.drawPause(ctx, this.currentLevel.subtitle, this.quests.currentObjective(this.currentWorld));
        break;
      case 'inventory':
        this.menus.drawInventory(ctx, this.inventory, this.questLines());
        break;
      case 'settings':
        this.menus.drawSettings(ctx, this.settings);
        break;
      case 'gameover':
        this.menus.drawGameOver(ctx);
        break;
      case 'transition': {
        const t = this.transition.time / this.transition.duration;
        const alpha = t < 0.5 ? Math.min(1, t * 3) : Math.max(0, 1 - (t - 0.5) * 3);
        this.menus.drawWorldCard(ctx, this.currentLevel.title, this.currentLevel.subtitle, alpha);
        break;
      }
      default:
        break;
    }

    this.renderer.present();
  }

  private drawWorld(ctx: CanvasRenderingContext2D): void {
    const camX = this.settings.screenShake ? this.camera.renderX : Math.round(this.camera.x);
    const camY = this.settings.screenShake ? this.camera.renderY : Math.round(this.camera.y);

    this.background.draw(ctx, camX, camY);
    this.world.tilemap.draw(ctx, camX, camY, GAME_WIDTH, GAME_HEIGHT);
    this.world.drawSorted(ctx, camX, camY);
    this.particles.draw(ctx, camX, camY);

    const lights = this.world.collectLights();
    const player = this.player;
    if (player) lights.push({ x: player.x, y: player.y - 10, radius: 92, color: '#ffe9c4', flicker: 0.02 });
    this.lighting.draw(ctx, lights, camX, camY);
  }

  private questLines(): string[] {
    const quest = QUESTS[Math.min(QUESTS.length - 1, this.currentWorld - 1)];
    return [quest.title.toUpperCase(), ...quest.steps.map((s) => `${this.quests.has(s.flag) ? '[x]' : '[ ]'} ${s.label}`)];
  }

  /* -------------------------------------------------------------- plumbing */

  handleResize(): void {
    this.touch.layout();
  }

  /**
   * Small debug surface used by `scripts/smoke.mjs` (and handy in the browser
   * console). It only exposes state and shortcuts - no gameplay depends on it.
   */
  private installDebugApi(): void {
    (window as unknown as { __quest?: unknown }).__quest = {
      debugState: () => ({
        state: this.state,
        world: this.currentWorld,
        zone: this.camera.activeZoneId,
        dialogue: this.dialogue.active,
        move: { x: Math.round(this.input.move.x * 100) / 100, y: Math.round(this.input.move.y * 100) / 100 },
        locked: this.player?.cutsceneLock ?? false,
        player: this.player
          ? { x: Math.round(this.player.x), y: Math.round(this.player.y), hp: Math.round(this.player.hp), level: this.player.level }
          : null,
        companions: this.companions.map((c) => ({
          id: c.charId,
          ai: c.aiState,
          hp: Math.round(c.hp),
          dist: this.player ? Math.round(dist(c.x, c.y, this.player.x, this.player.y)) : -1,
        })),
        enemies: this.world.entitiesOfKind('enemy').length,
        flags: this.quests.serialize().length,
      }),
      debugTeleport: (checkpoint: string) => {
        const spot = this.checkpoints[checkpoint];
        if (!spot || !this.player) return false;
        this.player.x = spot.x;
        this.player.y = spot.y;
        this.trail.reset(spot.x, spot.y);
        this.camera.snapTo(spot.x, spot.y);
        return true;
      },
      debugJoinPrincess: () => {
        if (this.quests.has('party.princess')) return false;
        this.setFlag('party.princess');
        this.joinPrincess(this.player?.x ?? 0, this.player?.y ?? 0);
        return true;
      },
      debugJoinWizard: () => {
        if (this.quests.has('party.wizard')) return false;
        this.setFlag('party.wizard');
        this.joinWizard(this.player?.x ?? 0, this.player?.y ?? 0);
        return true;
      },
      debugGoToWorld: (index: number) => this.goToWorld(index),
      debugGiveItem: (id: string) => this.giveItem(id),
    };
  }
}

function countItems(inventory: Record<string, number>): number {
  return Object.values(inventory).reduce((a, b) => a + b, 0);
}
