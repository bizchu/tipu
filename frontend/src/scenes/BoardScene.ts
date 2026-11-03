import Phaser from 'phaser';
import { Board, OPP_HOLES, PLAYER_HOLES, PLAYER_HOUSE, OPP_HOUSE, makeBoard, previewLastSeed, getSeedPath, SeedStep } from '../logic/congkak';

// ---------------------------------------------------------------------------
// RoundConfig — passed via scene.start('BoardScene', config)
// ---------------------------------------------------------------------------

export interface RoundConfig {
  /** 1 = room / Wan Mahora, 2 = outside / village chief */
  round: 1 | 2;
  /** Seeds per hole at game start. Falls back to round-derived default if absent/invalid. */
  seedsPerHole?: number;
  /** Background asset key. */
  background?: 'room' | 'outside';
  /** Opponent character. */
  opponent?: 'wan_mahora' | 'village_chief';
}

/** Fully-resolved config with all defaults applied. */
export interface ResolvedConfig {
  round: 1 | 2;
  seedsPerHole: number;        // always a positive integer
  background: 'room' | 'outside';
  opponent: 'wan_mahora' | 'village_chief';
}

// ---------------------------------------------------------------------------
// parseRoundConfig — validates and resolves raw scene data into ResolvedConfig
// ---------------------------------------------------------------------------

/**
 * Accepts any unknown value (passed via `scene.start('BoardScene', rawData)`)
 * and returns a fully-resolved {@link ResolvedConfig}.
 *
 * Rules:
 * - If `raw` is not a non-null object, all values default to round 1 values.
 * - `round`: 1 or 2 only; anything else → 1.
 * - `background`: 'room' | 'outside' → kept; else derived from round.
 * - `opponent`: 'wan_mahora' | 'village_chief' → kept; else derived from round.
 * - `seedsPerHole`: positive integer → kept; else derived from round (1→3, 2→4).
 */
export function parseRoundConfig(raw: unknown): ResolvedConfig {
  // Treat non-object / null as missing config
  const obj = (raw !== null && typeof raw === 'object') ? raw as Record<string, unknown> : {};

  // --- round ---
  const round: 1 | 2 = (obj['round'] === 2) ? 2 : 1;

  // --- background ---
  let background: 'room' | 'outside';
  if (obj['background'] === 'room' || obj['background'] === 'outside') {
    background = obj['background'];
  } else {
    background = round === 2 ? 'outside' : 'room';
  }

  // --- opponent ---
  let opponent: 'wan_mahora' | 'village_chief';
  if (obj['opponent'] === 'wan_mahora' || obj['opponent'] === 'village_chief') {
    opponent = obj['opponent'];
  } else {
    opponent = round === 2 ? 'village_chief' : 'wan_mahora';
  }

  // --- seedsPerHole ---
  const rawSeeds = obj['seedsPerHole'];
  let seedsPerHole: number;
  if (rawSeeds !== undefined && Number.isInteger(rawSeeds) && (rawSeeds as number) > 0) {
    seedsPerHole = rawSeeds as number;
  } else {
    seedsPerHole = round === 2 ? 4 : 3;
  }

  return { round, seedsPerHole, background, opponent };
}

// ---------------------------------------------------------------------------
// SceneState — drives which interaction guards are active
// ---------------------------------------------------------------------------

export enum SceneState {
  PLAYER_TURN = 'PLAYER_TURN',  // awaiting hole click
  OPP_TURN    = 'OPP_TURN',     // opponent AI delay + animation
  ANIMATING   = 'ANIMATING',    // seed animation running (either side)
  GAME_OVER   = 'GAME_OVER',    // overlay shown, only RETRY active
}

// ---------------------------------------------------------------------------
// Seed colour constants
// ---------------------------------------------------------------------------

export const SEED_COLOURS = [
  'black', 'blue', 'green', 'red', 'white', 'yellow',
] as const;
export type SeedColour = typeof SEED_COLOURS[number];

/** Pure helper — exported for unit testing. */
export function getSeedColour(seedIndex: number): SeedColour {
  return SEED_COLOURS[seedIndex % SEED_COLOURS.length];
}

// ---------------------------------------------------------------------------
// HoleData — one entry per board index (0–7)
// ---------------------------------------------------------------------------

export interface HoleData {
  /** Board index (0–7). */
  index: number;
  /** Centre x in base canvas coordinates. */
  x: number;
  /** Centre y in base canvas coordinates. */
  y: number;
  /** Phaser Zone used for pointer interaction. */
  zone: Phaser.GameObjects.Zone;
  /** Text object showing seed count. */
  label: Phaser.GameObjects.Text;
  /** Resting seed sprites currently visible in this hole. */
  restingSeeds: Phaser.GameObjects.Image[];
  /** True when GlowState is active. */
  isGlowing: boolean;
  /** Tweens that form the glow pulse (stored so they can be stopped). */
  glowTweens: Phaser.Tweens.Tween[];
}

// ---------------------------------------------------------------------------
// HOLE_POSITIONS — pixel coordinates for the 8 board positions
// Board image anchored at (960, 900) in the 1920×1080 canvas.
// TODO: tune these against the actual pixel content of congkak_board.png
// ---------------------------------------------------------------------------

export const HOLE_POSITIONS: ReadonlyArray<{ x: number; y: number }> = [
  { x: 710,  y: 890 },  // 0  player hole 0 (left)
  { x: 860,  y: 900 },  // 1  player hole 1 (centre)
  { x: 1010, y: 890 },  // 2  player hole 2 (right)
  { x: 1160, y: 870 },  // 3  player house
  { x: 1010, y: 820 },  // 4  opp hole 0 (right)
  { x: 860,  y: 810 },  // 5  opp hole 1 (centre)
  { x: 710,  y: 820 },  // 6  opp hole 2 (left)
  { x: 560,  y: 840 },  // 7  opp house
] as const; // TODO: tune

// ---------------------------------------------------------------------------
// selectOpponentHole — pure AI move selector (no Phaser imports)
// ---------------------------------------------------------------------------

/**
 * Chooses which opponent hole to play from, in priority order:
 *  1. A hole whose move earns an extra turn.
 *  2. A hole whose move results in a tembak capture.
 *  3. A uniformly random legal hole (using Math.random()).
 *
 * Uses only `Math.random()` so this function stays pure and fully testable
 * without Phaser.
 *
 * @param board Current board state (not mutated).
 * @returns Board index of the chosen hole (4, 5, or 6).
 * @throws RangeError if there are no legal opponent moves.
 */
export function selectOpponentHole(board: Board): number {
  // Collect all legal opponent holes (non-empty)
  const legal = (OPP_HOLES as readonly number[]).filter(h => board[h] > 0);

  if (legal.length === 0) {
    throw new RangeError('selectOpponentHole: no legal opponent moves available');
  }

  const previews = legal.map(h => ({
    hole: h,
    preview: previewLastSeed(board, h, false),
  }));

  // Priority 1: extra turn
  const extraTurn = previews.find(p => p.preview.willExtraTurn);
  if (extraTurn !== undefined) return extraTurn.hole;

  // Priority 2: capture (tembak)
  const capture = previews.find(p => p.preview.willCapture);
  if (capture !== undefined) return capture.hole;

  // Priority 3: random from remaining legal holes
  const randomIndex = Math.floor(Math.random() * legal.length);
  return legal[randomIndex];
}

// ---------------------------------------------------------------------------
// SeedPool — object-pool for seed Image sprites (task 5.1)
// ---------------------------------------------------------------------------

export interface SeedPool {
  acquire(colour: SeedColour): Phaser.GameObjects.Image;
  release(img: Phaser.GameObjects.Image): void;
}

// ---------------------------------------------------------------------------
// BoardScene
// ---------------------------------------------------------------------------

export default class BoardScene extends Phaser.Scene {
  // ---- task 3.1 ----
  resolvedConfig!: ResolvedConfig;

  // ---- task 3.2 ----
  portraitSprite!: Phaser.GameObjects.Image;

  // ---- task 3.3 ----
  holes!: HoleData[];
  board!: Board;

  // ---- task 3.4 ----
  textboxSprite!: Phaser.GameObjects.Image;

  // ---- task 5.1 ----
  pool!: SeedPool;
  seedPoolImages: Phaser.GameObjects.Image[] = [];

  // ---- task 6.1 ----
  private glowOverlays: Phaser.GameObjects.Graphics[] = [];

  // ---- task 6.3 ----
  private previewHighlightGfx: Phaser.GameObjects.Graphics | null = null;

  // ---- task 7.4 ----
  private gameplayText!: Phaser.GameObjects.Text;

  // ---- task 7.6 ----
  private handSprite!: Phaser.GameObjects.Image;

  // ---- task 8.1 ----
  sceneState!: SceneState;

  constructor() {
    super({ key: 'BoardScene' });
  }

  preload(): void {
    // Backgrounds
    this.load.image('bg_room',    'backgrounds/room/room_preview.png');
    this.load.image('bg_outside', 'backgrounds/outside/outside_preview.png');

    // Wan Mahora portraits
    this.load.image('wan_mahora_calm',    'characters/wan_mahora/wan_mahora_calm.png');
    this.load.image('wan_mahora_annoyed', 'characters/wan_mahora/wan_mahora_annoyed.png');
    this.load.image('wan_mahora_angry',   'characters/wan_mahora/wan_mahora_angry.png');

    // Village chief portraits
    this.load.image('village_chief_calm',     'characters/village_chief/village_chief_calm.png');
    this.load.image('village_chief_angry',    'characters/village_chief/village_chief_angry.png');
    this.load.image('village_chief_dead',     'characters/village_chief/village_chief_dead.png');
    this.load.image('village_chief_dead_grey','characters/village_chief/village_chief_dead_grey.png');

    // Board images and gameplay textbox
    this.load.image('board_angled',      'board/congkak_board.png');
    this.load.image('board_flat',        'board/congkak_board_flat.png');
    this.load.image('textbox_gameplay',  'ui/textbox_gameplay.png');

    // Seed images
    this.load.image('seed_black',  'board/seeds/seed_black.png');
    this.load.image('seed_blue',   'board/seeds/seed_blue.png');
    this.load.image('seed_green',  'board/seeds/seed_green.png');
    this.load.image('seed_red',    'board/seeds/seed_red.png');
    this.load.image('seed_white',  'board/seeds/seed_white.png');
    this.load.image('seed_yellow', 'board/seeds/seed_yellow.png');

    // Hand images
    this.load.image('hand_fist',  'ui/hands/hand_fist.png');
    this.load.image('hand_open',  'ui/hands/hand_open.png');
    this.load.image('hand_claw',  'ui/hands/hand_claw.png');
    this.load.image('hand_grab',  'ui/hands/hand_grab.png');
    this.load.image('hand_reach', 'ui/hands/hand_reach.png');
  }

  // --------------------------------------------------------------------------
  // create
  // --------------------------------------------------------------------------

  create(data: unknown): void {
    // ---- 3.1: resolve config ----
    this.resolvedConfig = parseRoundConfig(data);
    const { background, opponent, seedsPerHole } = this.resolvedConfig;

    // ---- 3.1: background + board image ----
    this.add
      .image(960, 540, 'bg_' + background)
      .setDisplaySize(1920, 1080)
      .setDepth(0);

    this.add
      .image(960, 900, 'board_angled')
      .setDepth(10);

    // ---- 3.2: opponent portrait (calm pose, depth 5 — behind board at 10) ----
    // NEVER call setTint or modify alpha on this sprite
    this.portraitSprite = this.add
      .image(960, 350, opponent + '_calm')
      .setDepth(5);

    // ---- 3.3: initialise board logic + hole zones ----
    this.board = makeBoard(seedsPerHole);

    // Placeholder text objects for labels (depth 30). Will be set in task 4.1.
    const houseIndices = new Set([PLAYER_HOUSE, OPP_HOUSE]);
    this.holes = HOLE_POSITIONS.map((pos, index) => {
      const zone = this.add.zone(pos.x, pos.y, 80, 80);
      if (!houseIndices.has(index)) {
        zone.setInteractive();
      }

      // Label centred above the hole, initialised with actual board value (task 4.1)
      const label = this.add
        .text(pos.x, pos.y - 20, String(this.board[index]), { fontSize: '18px', color: '#ffffff' })
        .setOrigin(0.5, 0.5)
        .setDepth(30);

      return {
        index,
        x: pos.x,
        y: pos.y,
        zone,
        label,
        restingSeeds: [],
        isGlowing: false,
        glowTweens: [],
      } satisfies HoleData;
    });

    // ---- 3.4: gameplay textbox — top-left anchor at (40, 740) ----
    this.textboxSprite = this.add
      .image(40, 740, 'textbox_gameplay')
      .setOrigin(0, 0)
      .setDepth(20);

    // ---- 5.1: seed object pool — pre-create 30 hidden seed images ----
    this.seedPoolImages = [];
    for (let i = 0; i < 30; i++) {
      const img = this.add
        .image(0, 0, 'seed_black')
        .setVisible(false)
        .setActive(false)
        .setDepth(25);
      this.seedPoolImages.push(img);
    }

    const poolImages = this.seedPoolImages;
    const scene = this;
    this.pool = {
      acquire(colour: SeedColour): Phaser.GameObjects.Image {
        // Find the first inactive image in the pool
        const img = poolImages.find(i => !i.active);
        if (img !== undefined) {
          img.setTexture('seed_' + colour).setVisible(true).setActive(true);
          return img;
        }
        // Pool exhausted — create a new image dynamically
        const fresh = scene.add
          .image(0, 0, 'seed_' + colour)
          .setVisible(true)
          .setActive(true)
          .setDepth(25);
        poolImages.push(fresh);
        return fresh;
      },
      release(img: Phaser.GameObjects.Image): void {
        img.setVisible(false).setActive(false);
      },
    };

    // ---- task 7.4: gameplay status text ----
    this.gameplayText = this.add
      .text(200, 790, '', { fontSize: '20px', color: '#ffe566' })
      .setOrigin(0.5, 0.5)
      .setDepth(21)
      .setVisible(false);

    // ---- task 7.6: hand sprite ----
    this.handSprite = this.add
      .image(0, 0, 'hand_fist')
      .setVisible(false)
      .setDepth(26);

    // ---- populate resting seeds for initial board state (task 5.2) ----
    this.holes.forEach(holeData => {
      this.populateRestingSeeds(holeData, this.board[holeData.index]);
    });

    // ---- initial scene state ----
    this.sceneState = SceneState.PLAYER_TURN;

    // ---- 6.1/6.2: glow player holes on first turn ----
    this.applyGlowsForPlayerTurn();

    // ---- 6.3: hover preview — light blue landing-hole indicator ----
    // ---- 6.4: click handler — begin player move animation ----
    (PLAYER_HOLES as readonly number[]).forEach(index => {
      const zone = this.holes[index].zone;

      // Hover: preview where the last seed will land
      zone.on('pointerover', () => {
        if (this.previewHighlightGfx) {
          this.previewHighlightGfx.destroy();
          this.previewHighlightGfx = null;
        }
        if (this.board[index] === 0) return;
        const result = previewLastSeed(this.board, index, true);
        const target = this.holes[result.landingHole];
        const gfx = this.add.graphics();
        gfx.fillStyle(0x88ddff, 0.5);
        gfx.fillCircle(target.x, target.y, 40);
        gfx.setDepth(13);
        this.previewHighlightGfx = gfx;
      });

      // Hover out: remove preview
      zone.on('pointerout', () => {
        if (this.previewHighlightGfx) {
          this.previewHighlightGfx.destroy();
          this.previewHighlightGfx = null;
        }
      });

      // Click: commit the move
      zone.on('pointerup', () => {
        if (this.sceneState !== SceneState.PLAYER_TURN) return;
        if (this.board[index] === 0) return;

        // Remove glows
        this.removeAllGlows();

        // Remove hover preview
        if (this.previewHighlightGfx) {
          this.previewHighlightGfx.destroy();
          this.previewHighlightGfx = null;
        }

        // Disable all player hole zones while animating
        (PLAYER_HOLES as readonly number[]).forEach(pi => {
          this.holes[pi].zone.disableInteractive();
        });

        // Start move animation
        this.sceneState = SceneState.ANIMATING;
        this.animateMove(index, true).catch(err => console.error('animateMove error', err));
      });
    });
  }

  // --------------------------------------------------------------------------
  // animateMove — orchestrates one full turn's animation pipeline (task 7.1)
  // --------------------------------------------------------------------------

  protected async animateMove(holeIndex: number, isPlayer: boolean): Promise<void> {
    this.sceneState = SceneState.ANIMATING;

    // Enumerate every seed-movement event for this turn.
    const steps = getSeedPath(this.board, holeIndex, isPlayer);

    // Sync labels to the current board state before the first arc.
    this.updateLabels(this.board);

    // Remove resting seed sprites from the source hole so they don't overlap arcs.
    this.clearSourceHoleSeeds(holeIndex);

    // Track whether we've already cleared the tembak holes so we don't double-clear.
    let tembakCleared = false;

    for (const step of steps) {
      switch (step.type) {
        case 'sow':
          await this.animateSowStep(step);
          break;

        case 'keepSowing':
          await this.animateKeepSowingStep(step);
          break;

        case 'extraTurn':
          await this.animateExtraTurnStep(step);
          break;

        case 'tembak': {
          // The first tembak step has fromHole === landing hole.
          // Subsequent tembak steps have fromHole === opposite hole.
          // We clear both holes exactly once, on the first tembak step.
          if (!tembakCleared) {
            // Find the opposite hole: it's the fromHole of any tembak step
            // where fromHole !== the landing hole (i.e. the second+ steps).
            const firstTembak = step;
            const oppStep = steps.find(
              s => s.type === 'tembak' && s.fromHole !== firstTembak.fromHole,
            );
            const oppositeHole = oppStep?.fromHole ?? -1;
            if (oppositeHole !== -1) {
              this.clearTembakSeeds(firstTembak.fromHole, oppositeHole);
            }
            tembakCleared = true;
          }
          await this.animateTembakStep(step);
          break;
        }
      }
    }

    await this.finalizeMoveBoard(holeIndex, isPlayer);

    // Hide the hand sprite after the full move completes
    this.handSprite.setVisible(false);
  }

  // --------------------------------------------------------------------------
  // animateSowArc — shared parabolic-arc helper (tasks 7.2, 7.4, 7.5)
  //
  // Tweens `sprite` from (fromX, fromY) to (toX, toY) along a parabola with the
  // midpoint lifted by ARC px. The hand sprite follows every frame.
  // After the tween completes, the hand texture swaps to 'hand_open'.
  // --------------------------------------------------------------------------

  private animateSowArc(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    sprite: Phaser.GameObjects.Image,
  ): Promise<void> {
    const ARC = 80;
    const DURATION = 200;

    sprite.setPosition(fromX, fromY).setVisible(true).setActive(true).setDepth(25);

    return new Promise<void>(resolve => {
      this.tweens.add({
        targets: sprite,
        x: toX,
        duration: DURATION,
        ease: 'Linear',
        onUpdate: (tween) => {
          const t = tween.progress; // 0 → 1
          const y = fromY + (toY - fromY) * t - ARC * Math.sin(Math.PI * t);
          sprite.setY(y);
          // Move hand to match seed position
          this.handSprite.setPosition(sprite.x, sprite.y);
        },
        onComplete: () => {
          // Drop: swap hand to open
          this.handSprite.setTexture('hand_open').setPosition(toX, toY);
          resolve();
        },
      });
    });
  }

  // --------------------------------------------------------------------------
  // animateSowStep — arc one seed into its destination hole (task 7.2)
  // --------------------------------------------------------------------------

  private async animateSowStep(step: SeedStep): Promise<void> {
    const from = this.holes[step.fromHole];
    const to   = this.holes[step.toHole];

    const seed = this.pool.acquire(getSeedColour(step.seedIndex));

    // Show hand at pick-up point for the very first sow in a move
    if (!this.handSprite.visible) {
      this.handSprite
        .setTexture('hand_fist')
        .setPosition(from.x, from.y)
        .setVisible(true)
        .setDepth(26);
    }

    await this.animateSowArc(from.x, from.y, to.x, to.y, seed);

    this.pool.release(seed);
    this.populateRestingSeeds(this.holes[step.toHole], this.board[step.toHole] + 1);
  }

  // --------------------------------------------------------------------------
  // animateKeepSowingStep — brief pause + move hand to new source hole (task 7.3)
  // --------------------------------------------------------------------------

  private async animateKeepSowingStep(step: SeedStep): Promise<void> {
    // Reposition hand back to fist at the keep-sow source hole
    const src = this.holes[step.fromHole];
    this.handSprite.setTexture('hand_fist').setPosition(src.x, src.y).setVisible(true);

    return new Promise<void>(resolve => {
      this.time.delayedCall(150, resolve);
    });
  }

  // --------------------------------------------------------------------------
  // animateExtraTurnStep — arc final seed into house, show "Your turn again!" (task 7.4)
  // --------------------------------------------------------------------------

  private async animateExtraTurnStep(step: SeedStep): Promise<void> {
    const from = this.holes[step.fromHole];
    const to   = this.holes[step.toHole];

    const seed = this.pool.acquire(getSeedColour(step.seedIndex));
    await this.animateSowArc(from.x, from.y, to.x, to.y, seed);
    this.pool.release(seed);

    // Hide hand after the drop
    this.handSprite.setVisible(false);

    // Display "Your turn again!" for 800 ms
    this.gameplayText.setText('Your turn again!').setVisible(true);
    await new Promise<void>(resolve => this.time.delayedCall(800, resolve));
    this.gameplayText.setVisible(false);
  }

  // --------------------------------------------------------------------------
  // animateTembakStep — arc a captured seed into the mover's house (task 7.5)
  // --------------------------------------------------------------------------

  private async animateTembakStep(step: SeedStep): Promise<void> {
    const from = this.holes[step.fromHole];
    const to   = this.holes[step.toHole];

    const seed = this.pool.acquire(getSeedColour(step.seedIndex));

    // Show hand at pick-up point for the first tembak seed
    if (!this.handSprite.visible) {
      this.handSprite
        .setTexture('hand_fist')
        .setPosition(from.x, from.y)
        .setVisible(true)
        .setDepth(26);
    }

    await this.animateSowArc(from.x, from.y, to.x, to.y, seed);
    this.pool.release(seed);
  }

  // --------------------------------------------------------------------------
  // finalizeMoveBoard — apply the completed move to the board state (task 7.7)
  // --------------------------------------------------------------------------

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected async finalizeMoveBoard(_holeIndex: number, _isPlayer: boolean): Promise<void> {}

  // --------------------------------------------------------------------------
  // updateLabels — refresh seed-count text for every hole (task 4.2)
  // Wired to move animations in task 7.1; declared here so the method exists.
  // --------------------------------------------------------------------------

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected updateLabels(board: Board): void {
    this.holes.forEach((holeData, i) => {
      holeData.label.setText(String(board[i]));
    });
  }

  // --------------------------------------------------------------------------
  // populateRestingSeeds — sync visible seed sprites in a hole to a count (task 5.2)
  // --------------------------------------------------------------------------

  private populateRestingSeeds(holeData: HoleData, count: number): void {
    // Release all existing resting seeds back to the pool
    holeData.restingSeeds.forEach(img => this.pool.release(img));
    holeData.restingSeeds = [];

    // Acquire fresh seeds and scatter them in a small cluster around the hole centre
    for (let i = 0; i < count; i++) {
      const img = this.pool.acquire(getSeedColour(i));
      const offsetX = (Math.random() - 0.5) * 30; // ±15 px
      const offsetY = (Math.random() - 0.5) * 20; // ±10 px
      img
        .setPosition(holeData.x + offsetX, holeData.y + offsetY)
        .setDepth(15);
      holeData.restingSeeds.push(img);
    }
  }

  // --------------------------------------------------------------------------
  // clearSourceHoleSeeds — release all resting sprites for the picked hole (task 5.3)
  // Called from animateMove (task 7.1) before the first arc animation.
  // --------------------------------------------------------------------------

  protected clearSourceHoleSeeds(holeIndex: number): void {
    const holeData = this.holes[holeIndex];
    holeData.restingSeeds.forEach(img => this.pool.release(img));
    holeData.restingSeeds = [];
  }

  // --------------------------------------------------------------------------
  // clearTembakSeeds — release resting sprites from both holes in a capture (task 5.4)
  // Called from the tembak step in animateMove (task 7.5).
  // --------------------------------------------------------------------------

  protected clearTembakSeeds(landingHoleIndex: number, oppositeHoleIndex: number): void {
    for (const idx of [landingHoleIndex, oppositeHoleIndex]) {
      const holeData = this.holes[idx];
      holeData.restingSeeds.forEach(img => this.pool.release(img));
      holeData.restingSeeds = [];
    }
  }

  // --------------------------------------------------------------------------
  // applyGlow — add a pulsing gold glow overlay to a single hole (task 6.1)
  // --------------------------------------------------------------------------

  private applyGlow(holeData: HoleData): void {
    const gfx = this.add.graphics();
    gfx.fillStyle(0xffd700, 0.4);
    gfx.fillCircle(holeData.x, holeData.y, 40);
    gfx.setDepth(12);

    const tween = this.tweens.add({
      targets: gfx,
      alpha: { from: 0.15, to: 0.55 },
      yoyo: true,
      loop: -1,
      duration: 600,
      ease: 'Sine.easeInOut',
    });

    holeData.glowTweens.push(tween);
    this.glowOverlays.push(gfx);
    holeData.isGlowing = true;
  }

  // --------------------------------------------------------------------------
  // removeAllGlows — stop and tear down every active glow (task 6.2)
  // --------------------------------------------------------------------------

  private removeAllGlows(): void {
    this.holes.forEach(holeData => {
      holeData.glowTweens.forEach(t => t.stop());
      holeData.glowTweens = [];
      holeData.isGlowing = false;
    });
    this.glowOverlays.forEach(g => g.destroy());
    this.glowOverlays = [];
  }

  // --------------------------------------------------------------------------
  // applyGlowsForPlayerTurn — glow every non-empty player hole (task 6.2)
  // Called at the end of create() and again from the turn state machine.
  // --------------------------------------------------------------------------

  private applyGlowsForPlayerTurn(): void {
    this.removeAllGlows();
    (PLAYER_HOLES as readonly number[]).forEach(i => {
      if (this.board[i] > 0) {
        this.applyGlow(this.holes[i]);
      }
    });
  }
}
