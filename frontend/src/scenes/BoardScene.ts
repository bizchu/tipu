import Phaser from 'phaser';
import {
  Board,
  FullMoveResult,
  OPP_HOLES,
  PLAYER_HOLES,
  SeedStep,
  applyFullMove,
  getSeedPath,
  getWinner,
  hasLegalMove,
  makeBoard,
  previewLastSeed,
  totalSeeds,
  GameResult,
} from '../logic/congkak';
import {
  HOLE_POSITIONS,
  ResolvedConfig,
  SEED_COLOURS,
  SeedColour,
  getSeedColour,
  labelPosition,
  parseRoundConfig,
  resultMessage,
  seedOffset,
  selectOpponentHole,
} from './boardScene.helpers';
import { TAPE_HUD_ASSETS, TapeHud } from '../ui/TapeHud';
import { addAmbience, preloadAmbience } from '../ui/Ambience';
import { HelpButton } from '../ui/HelpButton';
import { CHEAT_TELLS, CheatPlan, CheatedMove, TAPE, damage, planCheats, playOpponentMove } from '../logic/cheats';
import { REPLAY_ASSETS, ReplayMove, playReplay } from '../ui/Replay';
import { Sound } from '../audio/Sound';
import { VhsFilter } from '../ui/VhsFilter';

export * from './boardScene.helpers';

// ---------------------------------------------------------------------------
// SceneState — drives which interaction guards are active
// ---------------------------------------------------------------------------

export enum SceneState {
  PLAYER_TURN = 'PLAYER_TURN',
  OPP_TURN = 'OPP_TURN',
  ANIMATING = 'ANIMATING',
  GAME_OVER = 'GAME_OVER',
}

export interface HoleData {
  index: number;
  x: number;
  y: number;
  zone: Phaser.GameObjects.Zone;
  label: Phaser.GameObjects.Text;
  badge: Phaser.GameObjects.Graphics;
  restingSeeds: Phaser.GameObjects.Image[];
  isGlowing: boolean;
  glowTweens: Phaser.Tweens.Tween[];
}

export interface SeedPool {
  acquire(colour: SeedColour): Phaser.GameObjects.Image;
  release(img: Phaser.GameObjects.Image): void;
}

const NAMES: Record<ResolvedConfig['opponent'], string> = {
  wan_mahora: 'Wan Mahora',
  village_chief: 'Village Chief',
};

/** Short scripted reactions (the AI taunt hook can replace these later). */
const LINES = {
  wan_mahora: {
    start: 'Go on, sayang. You go first.',
    myTurn: ['My turn, sayang...', 'Watch closely now.', 'Hmm... let me see.'],
    extra: ['Again? How lucky for me.', 'One more, sayang.'],
    captured: ['Tch... you took those?', 'Cheeky girl.'],
    capturing: ['Mine now, sayang.', 'Did you see that coming?'],
    caught: ['Tch... clever girl.', 'Such sharp eyes, sayang.', 'Hmph. Lucky guess.'],
    clean: ['Accusing me? How rude, sayang.', 'Nothing there, sayang.'],
  },
  village_chief: {
    start: 'Sit. The game begins. You move first.',
    myTurn: ['My move.', 'Observe.', 'The court proceeds.'],
    extra: ['Again.', 'The law favours me.'],
    captured: ['...Noted.', 'You overstep.'],
    capturing: ['Confiscated.', 'As judged.'],
    caught: ['You dare accuse me?', '...Very well. Continue.', 'Impertinent.'],
    clean: ['Baseless accusations.', 'The court finds nothing.'],
  },
} as const;

const SEED_SIZE = 40;
const ARC = 70;
const SOW_MS = 210;
const MAX_OPP_EXTRA_TURNS = 5;

export default class BoardScene extends Phaser.Scene {
  resolvedConfig!: ResolvedConfig;
  portraitSprite!: Phaser.GameObjects.Image;
  holes!: HoleData[];
  board!: Board;
  pool!: SeedPool;
  sceneState!: SceneState;
  tapeHud!: TapeHud;

  private initialSeedCount = 0;
  private oppExtraTurnCount = 0;
  private wrongClicks = 0;
  private dialogueName!: Phaser.GameObjects.Text;
  private dialogueText!: Phaser.GameObjects.Text;
  private handSprite!: Phaser.GameObjects.Image;
  private glowOverlays: Phaser.GameObjects.Graphics[] = [];
  private previewGfx: Phaser.GameObjects.Graphics | null = null;
  private seedPoolImages: Phaser.GameObjects.Image[] = [];

  // cheats + rewind
  private cheatPlan: CheatPlan = new Map();
  private oppMoveCount = 0;
  private turnMoves: ReplayMove[] = [];
  private lastOppTurn: ReplayMove[] = [];
  private rewinds = 3;
  private health: number = TAPE.start;
  private cheatsSeen = 0;
  private caughtCount = 0;
  /** consecutive failed attempts (wrong taps or missed cheats); 3 → show where to tap */
  private failStreak = 0;
  private portraitPose = 'calm';
  /** how many times the opponent has lost their temper this round (drives the music) */
  private angerLevel = 0;
  private rewindCallout: Phaser.GameObjects.Container | null = null;

  constructor() {
    super({ key: 'BoardScene' });
  }

  // --------------------------------------------------------------------------
  // preload
  // --------------------------------------------------------------------------

  preload(): void {

    for (const pose of ['calm', 'annoyed', 'angry']) {
      this.load.image(`wan_mahora_${pose}`, `game/wan_mahora_${pose}.png`);
    }
    for (const pose of ['calm', 'angry']) {
      this.load.image(`village_chief_${pose}`, `game/village_chief_${pose}.png`);
    }

    this.load.image('board_angled', 'board/congkak_board.png');
    this.load.image('textbox_gameplay', 'ui/textbox_gameplay.png');
    this.load.image('nametag', 'ui/nametag.png');

    for (const c of SEED_COLOURS) this.load.image(`seed_${c}`, `game/seed_${c}.png`);
    for (const h of ['fist', 'open']) {
      this.load.image(`hand_${h}_up`, `game/hand_${h}_up.png`);
      this.load.image(`hand_${h}_down`, `game/hand_${h}_down.png`);
    }
    for (const [key, path] of TAPE_HUD_ASSETS) this.load.image(key, path);
    for (const [key, path] of REPLAY_ASSETS) this.load.image(key, path);
    preloadAmbience(this);
  }

  // --------------------------------------------------------------------------
  // create
  // --------------------------------------------------------------------------

  create(data: unknown): void {
    this.resolvedConfig = parseRoundConfig(data);
    const { background, opponent, seedsPerHole } = this.resolvedConfig;
    this.glowOverlays = [];
    this.previewGfx = null;
    this.oppExtraTurnCount = 0;
    this.wrongClicks = 0;
    this.cheatPlan = planCheats(this.resolvedConfig.round);
    this.oppMoveCount = 0;
    this.turnMoves = [];
    this.lastOppTurn = [];
    this.rewinds = 3;
    this.health = TAPE.start;
    this.cheatsSeen = 0;
    this.caughtCount = 0;
    this.failStreak = 0;
    HelpButton.show(this.game);

    // Background
    addAmbience(this, background);

    // Opponent portrait — behind the board. Never tinted or faded.
    this.portraitSprite = this.add
      .image(960, 1000, opponent + '_calm')
      .setOrigin(0.5, 1)
      .setDepth(5);

    // Board with a soft drop shadow
    const shadow = this.add.image(970, 1072, 'board_angled').setOrigin(0.5, 1).setDepth(9);
    shadow.setDisplaySize(1000, (1000 / 1220) * 186).setTintFill(0x000000).setAlpha(0.45);
    const boardImg = this.add.image(960, 1050, 'board_angled').setOrigin(0.5, 1).setDepth(10);
    boardImg.setDisplaySize(1000, (1000 / 1220) * 186);

    // Board state
    this.board = makeBoard(seedsPerHole);
    this.initialSeedCount = totalSeeds(this.board);

    // Seed pool
    this.seedPoolImages = [];
    const poolImages = this.seedPoolImages;
    const scene = this;
    this.pool = {
      acquire(colour) {
        const img = poolImages.find((i) => !i.active) ?? scene.add.image(0, 0, 'seed_' + colour);
        if (!poolImages.includes(img)) poolImages.push(img);
        return img.setTexture('seed_' + colour).setDisplaySize(SEED_SIZE, SEED_SIZE).setVisible(true).setActive(true);
      },
      release(img) {
        img.setVisible(false).setActive(false);
      },
    };

    // Holes, zones and count badges
    this.holes = HOLE_POSITIONS.map((pos, index) => {
      const isHouse = index === 3 || index === 7;
      const zone = this.add.zone(pos.x, pos.y, isHouse ? 200 : 130, isHouse ? 140 : 70);
      const lp = labelPosition(index);
      const badge = this.add.graphics().setDepth(29);
      badge.fillStyle(0x1a0f0a, 0.85).fillCircle(lp.x, lp.y, isHouse ? 22 : 17);
      badge.lineStyle(2, 0xd9a54e, 0.9).strokeCircle(lp.x, lp.y, isHouse ? 22 : 17);
      const label = this.add
        .text(lp.x, lp.y, String(this.board[index]), {
          fontFamily: 'Georgia, serif',
          fontSize: isHouse ? '24px' : '20px',
          color: '#f6e2b4',
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
        .setDepth(30);
      return { index, x: pos.x, y: pos.y, zone, label, badge, restingSeeds: [], isGlowing: false, glowTweens: [] };
    });
    this.holes.forEach((h) => this.populateRestingSeeds(h, this.board[h.index]));

    // Gameplay dialogue box (left side, board visible)
    this.add.image(50, 610, 'textbox_gameplay').setOrigin(0, 0).setDepth(40);
    this.add.image(170, 576, 'nametag').setOrigin(0, 0).setDepth(41);
    this.dialogueName = this.add
      .text(320, 606, NAMES[opponent], { fontFamily: 'Georgia, serif', fontSize: '26px', color: '#f6e2b4', fontStyle: 'bold' })
      .setOrigin(0.5)
      .setDepth(42);
    this.dialogueText = this.add
      .text(380, 715, '', {
        fontFamily: 'Georgia, serif',
        fontSize: '28px',
        color: '#f0e6d4',
        align: 'center',
        wordWrap: { width: 500 },
        lineSpacing: 6,
      })
      .setOrigin(0.5)
      .setDepth(42);

    // VHS look + sound mood (heavier and tenser in round 2)
    const round2 = this.resolvedConfig.round === 2;
    new VhsFilter(this, round2 ? 1 : 0);
    Sound.mood(round2 ? { crickets: 0.3, hum: 0.3, heartbeat: 0 } : { crickets: 0.5, hum: 0.2, heartbeat: 0 });
    Sound.setHeartbeatRate(1);
    this.angerLevel = 0;
    this.updateIntensity();

    // Tape health HUD (top-right) with ◀◀ REW chip
    this.tapeHud = new TapeHud(this, this.resolvedConfig.round);
    this.tapeHud.rewChip.setInteractive({ useHandCursor: true }).on('pointerup', () => this.onRewind());
    this.input.keyboard?.on('keydown-R', () => this.onRewind());

    // Hand
    this.handSprite = this.add.image(0, 0, 'hand_fist_up').setVisible(false).setDepth(35);

    // Hold Space to speed up sowing
    this.input.keyboard?.on('keydown-SPACE', () => (this.tweens.timeScale = this.time.timeScale = 2.5));
    this.input.keyboard?.on('keyup-SPACE', () => (this.tweens.timeScale = this.time.timeScale = 1));

    // Player hole interaction
    (PLAYER_HOLES as readonly number[]).forEach((index) => {
      const zone = this.holes[index].zone;
      zone.setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => this.showPreview(index));
      zone.on('pointerout', () => this.clearPreview());
      zone.on('pointerup', () => this.onPlayerPick(index));
    });

    (OPP_HOLES as readonly number[]).forEach((index) => {
      this.holes[index].zone.setInteractive();
      this.holes[index].zone.on('pointerup', () => this.onWrongClick('Those are her holes. Pick one of the glowing holes on your side.'));
    });

    this.say(NAMES[opponent], LINES[opponent].start);
    this.startPlayerTurn();
  }

  // --------------------------------------------------------------------------
  // Turn state machine
  // --------------------------------------------------------------------------

  private startPlayerTurn(): void {
    if (!hasLegalMove(this.board, true)) {
      this.endGame(getWinner(this.board));
      return;
    }
    this.sceneState = SceneState.PLAYER_TURN;
    this.applyGlowsForPlayerTurn();
  }

  private onWrongClick(tip: string): void {
    if (this.sceneState !== SceneState.PLAYER_TURN) return;
    this.wrongClicks++;
    this.say('???', tip);
    if (this.wrongClicks >= 2) {
      HelpButton.pulse();
      this.say('???', tip + ' Stuck? Press ? for help.');
    }
  }

  private onPlayerPick(index: number): void {
    if (this.sceneState !== SceneState.PLAYER_TURN) return;
    if (this.board[index] === 0) {
      this.onWrongClick('That hole is empty. Pick a glowing one.');
      return;
    }
    this.wrongClicks = 0;
    HelpButton.stopPulse();
    this.removeAllGlows();
    this.clearPreview();
    if (this.resolvedConfig.opponent === 'wan_mahora') this.setPortrait('annoyed');
    this.runMove(index, true).catch((err) => console.error('player move failed', err));
  }

  private async runMove(holeIndex: number, isPlayer: boolean): Promise<void> {
    this.sceneState = SceneState.ANIMATING;
    const result = applyFullMove(this.board, holeIndex, isPlayer);
    await this.animateMove(holeIndex, isPlayer);
    this.board = result.board;
    this.syncVisualsToBoard();
    this.checkInvariant();
    if (isPlayer) this.endPlayerTurn(result);
    else this.endOpponentTurn(result);
  }

  private endPlayerTurn(result: FullMoveResult): void {
    const { opponent } = this.resolvedConfig;
    if (result.captured && result.captureHole !== undefined && (OPP_HOLES as readonly number[]).includes(result.captureHole)) {
      this.setPortrait('angry');
      this.say(NAMES[opponent], pick(LINES[opponent].captured));
    }
    if (result.extraTurn) {
      this.say('???', 'Another turn!');
      this.startPlayerTurn();
      return;
    }
    this.triggerOpponentTurn();
  }

  private triggerOpponentTurn(): void {
    if (!hasLegalMove(this.board, false)) {
      this.endGame(getWinner(this.board));
      return;
    }
    this.sceneState = SceneState.OPP_TURN;
    const { opponent } = this.resolvedConfig;
    this.time.delayedCall(700, () => {
      this.setPortrait('calm');
      if (this.oppExtraTurnCount === 0) this.say(NAMES[opponent], pick(LINES[opponent].myTurn));
    });
    this.time.delayedCall(800 + Math.random() * 400 + 600, () => {
      const hole = selectOpponentHole(this.board);
      this.runOpponentMove(hole).catch((err) => console.error('opponent move failed', err));
    });
  }

  private async runOpponentMove(hole: number): Promise<void> {
    this.sceneState = SceneState.ANIMATING;
    const before = [...this.board] as Board;
    const planned = this.cheatPlan.get(this.oppMoveCount) ?? null;
    const move = playOpponentMove(this.board, hole, planned);
    // a cheat that couldn't happen on this board moves to her next turn
    if (planned && !move.cheat && !this.cheatPlan.has(this.oppMoveCount + 1)) this.cheatPlan.set(this.oppMoveCount + 1, planned);
    this.oppMoveCount++;

    await this.animateMove(hole, false, move);
    if (move.cheat && move.cheat.stepIndex < 0) await this.flicker(move.cheat.type === 'lightsOut' ? 0.92 : 0.6, move.cheat.type === 'lightsOut' ? 700 : 260);
    if (move.cheat?.type === 'extraSeed') this.initialSeedCount += 1;
    if (move.cheat) this.cheatsSeen++;
    this.board = move.finalBoard;
    this.syncVisualsToBoard();
    this.checkInvariant();
    this.turnMoves.push({ before, hole, move });
    this.endOpponentTurn({ board: move.finalBoard, extraTurn: move.extraTurn, captured: move.captured });
  }

  /** Lamp flicker: a quick dim of the whole scene (covers cheats in live play). */
  private flicker(alpha: number, ms: number): Promise<void> {
    Sound.flicker();
    const r = this.add.rectangle(960, 540, 1920, 1080, 0x000000, 0).setDepth(55);
    return new Promise((resolve) =>
      this.tweens.add({
        targets: r,
        fillAlpha: alpha,
        duration: ms / 2,
        yoyo: true,
        onComplete: () => {
          r.destroy();
          resolve();
        },
      }),
    );
  }

  // --------------------------------------------------------------------------
  // ◀◀ REW: replay her last turn and catch the cheat
  // --------------------------------------------------------------------------

  private async onRewind(): Promise<void> {
    if (this.sceneState !== SceneState.PLAYER_TURN) return;
    const { opponent, round, background } = this.resolvedConfig;
    if (this.rewinds <= 0) {
      this.say('???', 'No rewinds left this round.');
      return;
    }
    if (this.lastOppTurn.length === 0) {
      this.say('???', 'Nothing to rewind yet. Wait for her move.'.replace('her', opponent === 'wan_mahora' ? 'her' : 'his'));
      return;
    }
    this.sceneState = SceneState.ANIMATING;
    this.removeAllGlows();
    this.clearPreview();
    this.tweens.killTweensOf(this.tapeHud.rewChip);
    this.rewindCallout?.destroy();
    this.rewindCallout = null;
    this.tapeHud.rewChip.setScale(1);
    this.rewinds--;
    this.tapeHud.setRewinds(this.rewinds);
    const turn = this.lastOppTurn;
    this.lastOppTurn = [];

    HelpButton.hide();
    Sound.whirr(1.1);
    const result = await playReplay(this, turn, {
      background,
      slow: round === 1 ? 3 : 2,
      onWrongTap: () => {
        this.failStreak++;
        this.hurtTape(TAPE.wrongTap);
      },
      hint: () => (this.caughtCount === 0 && round === 1) || this.failStreak >= 3,
    });

    HelpButton.show(this.game);
    if (result === 'caught') {
      // undo every uncaught cheat in that turn
      for (const t of turn) {
        if (!t.move.cheat) continue;
        for (let i = 0; i < 8; i++) this.board[i] = Math.max(0, this.board[i] + (t.move.legalBoard[i] - t.move.finalBoard[i]));
        const type = t.move.cheat.type;
        this.say(NAMES[opponent], pick(LINES[opponent].caught));
        this.time.delayedCall(1800, () => this.say('???', CHEAT_TELLS[type] + ' Undone.'));
        t.move.cheat = null;
      }
      this.caughtCount++;
      this.failStreak = 0;
      this.initialSeedCount = totalSeeds(this.board);
      this.syncVisualsToBoard();
      this.setPortrait('angry');
    } else if (result === 'missed') {
      this.failStreak++;
      this.hurtTape(TAPE.missedWindow);
      if (this.rewinds > 0) {
        // let them try the same turn again
        this.lastOppTurn = turn;
        this.say('???', this.failStreak >= 3 ? 'I missed it again... Rewind once more. This time I\'ll watch the right spot.' : 'I missed it... Rewind and try again?');
      } else {
        this.say('???', 'I missed it... It happened too fast.');
      }
    } else {
      this.hurtTape(TAPE.cleanRewind);
      this.say(NAMES[opponent], pick(LINES[opponent].clean));
    }

    if (this.health <= 0) {
      await this.tapeSnap();
      return;
    }
    this.startPlayerTurn();
  }

  /** Big, obvious banner + arrow pointing at the REW chip (first cheat only). */
  private showRewindCallout(): void {
    const box = this.add.container(1180, 360).setDepth(70);
    const bg = this.add.rectangle(0, 0, 900, 280, 0x140608, 0.95).setStrokeStyle(6, 0xd8262b);
    const t1 = this.add
      .text(0, -88, 'Wait... what was that?', { fontFamily: 'Georgia, serif', fontSize: '52px', color: '#f6e2b4', fontStyle: 'bold' })
      .setOrigin(0.5);
    const t2 = this.add
      .text(0, -18, 'The lights went out... something suspicious happened.', {
        fontFamily: 'Georgia, serif',
        fontSize: '32px',
        color: '#e8dccb',
        align: 'center',
        wordWrap: { width: 820 },
      })
      .setOrigin(0.5);
    const t3 = this.add
      .text(0, 70, 'Press ◀◀ REW (or R) to rewind and find out!', { fontFamily: 'Courier New, monospace', fontSize: '30px', color: '#ff4a3a', fontStyle: 'bold' })
      .setOrigin(0.5);
    const arrow = this.add.text(380, -200, '⬈', { fontFamily: 'Arial', fontSize: '110px', color: '#ff4a3a' }).setOrigin(0.5);
    box.add([bg, t1, t2, t3, arrow]).setScale(0.6).setAlpha(0);
    this.tweens.add({ targets: box, scale: 1, alpha: 1, duration: 260, ease: 'Back.easeOut' });
    this.tweens.add({ targets: arrow, x: 400, y: -220, yoyo: true, repeat: -1, duration: 400 });
    this.tweens.add({ targets: this.tapeHud.rewChip, scale: 1.3, yoyo: true, repeat: -1, duration: 350 });
    this.rewindCallout = box;
  }

  /** horror music under the round: louder in round 2, as the opponent gets angrier and as the tape wears out */
  private updateIntensity(): void {
    const base = this.resolvedConfig.round === 2 ? 0.35 : 0.15;
    Sound.setIntensity(base + this.angerLevel * 0.12 + (1 - this.health) * 0.35);
  }

  private hurtTape(amount: number): void {
    this.health = damage(this.health, amount);
    this.tapeHud.setHealth(this.health);
    Sound.hurt();
    Sound.setHeartbeatRate(1 + (1 - this.health) * 1.2);
    Sound.heartbeatBurst(5);
    this.updateIntensity();
    this.cameras.main.shake(140, 0.006);
  }

  private async tapeSnap(): Promise<void> {
    this.sceneState = SceneState.GAME_OVER;
    Sound.glitch();
    Sound.whirr(2);
    const veil = this.add.rectangle(960, 540, 1920, 1080, 0x000000, 0).setDepth(300);
    await new Promise<void>((r) => this.tweens.add({ targets: veil, fillAlpha: 1, duration: 500, onComplete: () => r() }));
    const t1 = this.add
      .text(960, 480, 'The tape snapped...', { fontFamily: 'Georgia, serif', fontSize: '64px', color: '#ece2d2' })
      .setOrigin(0.5)
      .setDepth(301);
    const t2 = this.add
      .text(960, 580, '◀◀ REW', { fontFamily: 'Courier New, monospace', fontSize: '54px', color: '#ffffff', fontStyle: 'bold' })
      .setOrigin(0.5)
      .setDepth(301);
    this.tweens.add({ targets: t2, alpha: 0.2, yoyo: true, repeat: -1, duration: 350 });
    await this.delay(2200);
    t1.destroy();
    this.scene.restart(this.resolvedConfig);
  }

  private endOpponentTurn(result: FullMoveResult): void {
    const { opponent } = this.resolvedConfig;
    if (result.captured) this.say(NAMES[opponent], pick(LINES[opponent].capturing));
    if (result.extraTurn && this.oppExtraTurnCount < MAX_OPP_EXTRA_TURNS) {
      this.oppExtraTurnCount++;
      this.say(NAMES[opponent], pick(LINES[opponent].extra));
      this.triggerOpponentTurn();
      return;
    }
    this.oppExtraTurnCount = 0;
    this.lastOppTurn = this.turnMoves;
    this.turnMoves = [];
    const cheated = this.lastOppTurn.some((t) => t.move.cheat);
    if (cheated && this.cheatsSeen === 1) {
      // first cheat of the round: spell it out
      this.time.delayedCall(700, () => {
        this.say('???', 'Wait... what was that? Why did the lights go out?');
        this.showRewindCallout();
      });
    } else if (cheated) {
      this.time.delayedCall(700, () => {
        this.say('???', 'The lights flickered again... did something change? ◀◀ REW to check.');
        this.tweens.add({ targets: this.tapeHud.rewChip, scale: 1.3, yoyo: true, repeat: 7, duration: 300 });
      });
    }
    this.startPlayerTurn();
  }

  private endGame(result: GameResult): void {
    this.sceneState = SceneState.GAME_OVER;
    this.removeAllGlows();
    this.clearPreview();
    this.holes.forEach((h) => h.zone.disableInteractive());
    this.setPortrait(result === 'player' ? 'angry' : 'calm');

    const overlay = this.add.container(0, 0).setDepth(100);
    const dim = this.add.rectangle(960, 540, 1920, 1080, 0x000000, 0.55).setInteractive();
    const panel = this.add.rectangle(960, 540, 600, 300, 0x140c0a, 0.92).setStrokeStyle(3, 0xd9a54e);
    const text = this.add
      .text(960, 480, resultMessage(result), { fontFamily: 'Georgia, serif', fontSize: '56px', color: '#f6e2b4', fontStyle: 'bold' })
      .setOrigin(0.5);
    const score = this.add
      .text(960, 545, `Your house ${this.board[3]}  ·  ${NAMES[this.resolvedConfig.opponent]} ${this.board[7]}`, {
        fontFamily: 'Georgia, serif',
        fontSize: '24px',
        color: '#d8c8b0',
      })
      .setOrigin(0.5);
    const won = result === 'player';
    const retry = this.add
      .text(960, 620, won ? 'CONTINUE ▶' : '◀◀ REWIND & RETRY', {
        fontFamily: 'Courier New, monospace',
        fontSize: '34px',
        color: '#ffffff',
        backgroundColor: won ? '#3a5a2a' : '#b8231f',
        padding: { x: 28, y: 10 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    retry.on('pointerup', () => {
      if (!won) {
        this.scene.restart(this.resolvedConfig);
      } else {
        if (this.resolvedConfig.round === 2) this.scene.start('DeadStare');
        else this.scene.start('Memory', { set: 1 });
      }
    });
    overlay.add([dim, panel, text, score, retry]);
  }

  // --------------------------------------------------------------------------
  // Animation pipeline: SeedStep[] → sequential Promise chain
  // --------------------------------------------------------------------------

  protected async animateMove(holeIndex: number, isPlayer: boolean, cheated?: CheatedMove): Promise<void> {
    const steps = cheated?.steps ?? getSeedPath(this.board, holeIndex, isPlayer);
    const cheat = cheated?.cheat ?? null;
    const live: number[] = [...this.board];
    const dir = isPlayer ? 'up' : 'down';

    const pickUp = (hole: number) => {
      this.clearHoleSeeds(hole);
      live[hole] = 0;
      this.holes[hole].label.setText('0');
    };

    pickUp(holeIndex);
    await this.moveHandTo(this.holes[holeIndex], dir);

    let tembakCleared = false;
    let prev = holeIndex;
    for (let si = 0; si < steps.length; si++) {
      const step = steps[si];
      if (step.type === 'keepSowing') {
        this.showHand(step.fromHole, 'fist', dir);
        await this.delay(220);
        pickUp(step.fromHole);
        prev = step.fromHole;
        continue;
      }
      if (step.type === 'tembak' && !tembakCleared) {
        const opp = steps.find((s) => s.type === 'tembak' && s.fromHole !== step.fromHole)?.fromHole;
        this.clearHoleSeeds(step.fromHole);
        live[step.fromHole] = 0;
        this.holes[step.fromHole].label.setText('0');
        if (opp !== undefined) {
          this.clearHoleSeeds(opp);
          live[opp] = 0;
          this.holes[opp].label.setText('0');
        }
        tembakCleared = true;
        this.cameras.main.shake(120, 0.004);
      }
      if (step.type === 'extraTurn') continue; // marker only; the last 'sow' already landed in the house
      const from = step.type === 'tembak' ? step.fromHole : prev;
      if (cheat && cheat.stepIndex === si && cheat.type === 'skipHole') {
        // lamp flickers; the seed never lands in your hole
        const fl = this.flicker(0.6, 300);
        await this.animateSeed(step, from, live, dir, true);
        await fl;
        prev = step.toHole;
        continue;
      }
      await this.animateSeed(step, from, live, dir);
      if (step.type === 'sow') prev = step.toHole;
      if (cheat && cheat.stepIndex === si && cheat.type === 'extraSeed') {
        // lamp flickers; an extra seed appears
        const fl = this.flicker(0.6, 300);
        await this.delay(150);
        live[step.toHole]++;
        this.populateRestingSeeds(this.holes[step.toHole], live[step.toHole]);
        this.holes[step.toHole].label.setText(String(live[step.toHole]));
        await fl;
      }
    }

    this.tweens.add({ targets: this.handSprite, y: this.handSprite.y + (isPlayer ? 400 : -400), alpha: 0, duration: 260 });
    await this.delay(260);
    this.handSprite.setVisible(false).setAlpha(1);
  }

  private showHand(hole: number, pose: 'fist' | 'open', dir: 'up' | 'down'): void {
    const h = this.holes[hole];
    this.handSprite
      .setTexture(`hand_${pose}_${dir}`)
      .setOrigin(0.5, dir === 'up' ? 0.02 : 0.98)
      .setPosition(h.x, h.y)
      .setVisible(true);
  }

  private async moveHandTo(h: HoleData, dir: 'up' | 'down'): Promise<void> {
    const startY = dir === 'up' ? 1250 : -200;
    this.handSprite
      .setTexture(`hand_open_${dir}`)
      .setOrigin(0.5, dir === 'up' ? 0.02 : 0.98)
      .setPosition(h.x, startY)
      .setAlpha(1)
      .setVisible(true);
    await new Promise<void>((resolve) =>
      this.tweens.add({ targets: this.handSprite, y: h.y, duration: 300, ease: 'Quad.easeOut', onComplete: () => resolve() }),
    );
    this.handSprite.setTexture(`hand_fist_${dir}`);
    await this.delay(120);
  }

  private animateSeed(step: SeedStep, fromHole: number, live: number[], dir: 'up' | 'down', keep = false): Promise<void> {
    const from = this.holes[fromHole];
    const to = this.holes[step.toHole];
    const seed = this.pool.acquire(getSeedColour(step.seedIndex)).setDepth(34).setPosition(from.x, from.y);
    this.handSprite.setTexture(`hand_fist_${dir}`);

    return new Promise<void>((resolve) => {
      this.tweens.addCounter({
        from: 0,
        to: 1,
        duration: SOW_MS,
        onUpdate: (tw) => {
          const t = tw.getValue() ?? 0;
          const x = from.x + (to.x - from.x) * t;
          const y = from.y + (to.y - from.y) * t - ARC * Math.sin(Math.PI * t);
          seed.setPosition(x, y);
          this.handSprite.setPosition(x, y);
        },
        onComplete: () => {
          this.handSprite.setTexture(`hand_open_${dir}`).setPosition(to.x, to.y);
          this.pool.release(seed);
          Sound.tick();
          if (!keep) {
            live[step.toHole]++;
            this.populateRestingSeeds(to, live[step.toHole]);
            to.label.setText(String(live[step.toHole]));
          }
          this.time.delayedCall(40, resolve);
        },
      });
    });
  }

  protected delay(ms: number): Promise<void> {
    return new Promise<void>((resolve) => this.time.delayedCall(ms, resolve));
  }

  // --------------------------------------------------------------------------
  // Visual sync and invariant
  // --------------------------------------------------------------------------

  private syncVisualsToBoard(): void {
    this.holes.forEach((h) => {
      this.populateRestingSeeds(h, this.board[h.index]);
      h.label.setText(String(this.board[h.index]));
    });
  }

  private checkInvariant(): void {
    const total = totalSeeds(this.board);
    if (total !== this.initialSeedCount) {
      console.error('Board invariant failed: total', total, 'expected', this.initialSeedCount, [...this.board]);
    }
    this.holes.forEach((h, i) => {
      if (Number(h.label.text) !== this.board[i]) {
        console.error('Board invariant failed: label mismatch at index', i, [...this.board]);
      }
    });
  }

  private populateRestingSeeds(holeData: HoleData, count: number): void {
    holeData.restingSeeds.forEach((img) => this.pool.release(img));
    holeData.restingSeeds = [];
    for (let i = 0; i < count; i++) {
      const { dx, dy } = seedOffset(holeData.index, i);
      const img = this.pool.acquire(getSeedColour(i + holeData.index)).setPosition(holeData.x + dx, holeData.y + dy).setDepth(15 + dy / 100);
      holeData.restingSeeds.push(img);
    }
  }

  private clearHoleSeeds(holeIndex: number): void {
    const h = this.holes[holeIndex];
    h.restingSeeds.forEach((img) => this.pool.release(img));
    h.restingSeeds = [];
  }

  // --------------------------------------------------------------------------
  // Glow + hover preview
  // --------------------------------------------------------------------------

  private applyGlowsForPlayerTurn(): void {
    this.removeAllGlows();
    (PLAYER_HOLES as readonly number[]).forEach((i) => {
      if (this.board[i] === 0) return;
      const h = this.holes[i];
      const gfx = this.add.graphics().setDepth(12);
      gfx.lineStyle(5, 0xffd36b, 1).strokeEllipse(h.x, h.y, 150, 78);
      gfx.fillStyle(0xffd36b, 0.12).fillEllipse(h.x, h.y, 150, 78);
      const tween = this.tweens.add({ targets: gfx, alpha: { from: 0.35, to: 1 }, yoyo: true, loop: -1, duration: 650, ease: 'Sine.easeInOut' });
      h.glowTweens.push(tween);
      h.isGlowing = true;
      this.glowOverlays.push(gfx);
    });
  }

  private removeAllGlows(): void {
    this.holes.forEach((h) => {
      h.glowTweens.forEach((t) => t.stop());
      h.glowTweens = [];
      h.isGlowing = false;
    });
    this.glowOverlays.forEach((g) => g.destroy());
    this.glowOverlays = [];
  }

  private showPreview(index: number): void {
    this.clearPreview();
    if (this.sceneState !== SceneState.PLAYER_TURN || this.board[index] === 0) return;
    const result = previewLastSeed(this.board, index, true);
    const target = this.holes[result.landingHole];
    const isHouse = result.landingHole === 3 || result.landingHole === 7;
    const gfx = this.add.graphics().setDepth(13);
    gfx.lineStyle(4, 0x9fe6ff, 0.95).strokeEllipse(target.x, target.y, isHouse ? 230 : 140, isHouse ? 150 : 72);
    gfx.fillStyle(0x9fe6ff, 0.18).fillEllipse(target.x, target.y, isHouse ? 230 : 140, isHouse ? 150 : 72);
    this.previewGfx = gfx;
    const hint = result.willExtraTurn ? 'Lands in your house: extra turn!' : result.willCapture ? 'Lands in an empty hole: capture!' : 'Your last seed lands here.';
    this.say('???', hint);
  }

  private clearPreview(): void {
    this.previewGfx?.destroy();
    this.previewGfx = null;
  }

  // --------------------------------------------------------------------------
  // Portrait + dialogue
  // --------------------------------------------------------------------------

  private setPortrait(pose: 'calm' | 'annoyed' | 'angry'): void {
    if (pose === 'angry' && this.portraitPose !== 'angry') {
      Sound.angry();
      this.angerLevel = Math.min(4, this.angerLevel + 1);
      this.updateIntensity();
    }
    this.portraitPose = pose;
    const { opponent } = this.resolvedConfig;
    const key = `${opponent}_${pose}`;
    this.portraitSprite.setTexture(this.textures.exists(key) ? key : `${opponent}_calm`);
  }

  private say(name: string, text: string): void {
    this.dialogueName.setText(name);
    const size = name.length > 10 ? 22 : 26;
    this.dialogueName.setFontSize(size);
    this.dialogueText.setText(text);
  }
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
