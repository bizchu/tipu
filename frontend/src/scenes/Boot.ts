import Phaser from "phaser";

/**
 * Boot scene — preloads core assets and shows the room preview at full
 * 1920×1080 base resolution (Phaser.Scale.FIT keeps it letterboxed).
 *
 * Assets are served from repo-root assets/ via Vite's publicDir, so paths
 * are relative to that root (no /assets/ prefix needed).
 */
export class Boot extends Phaser.Scene {
  constructor() {
    super({ key: "Boot" });
  }

  preload(): void {
    this.load.image(
      "room_preview",
      "backgrounds/room/room_preview.png",
    );
  }

  create(): void {
    const { width, height } = this.scale;

    // Fill the canvas with the room background, centred and covering the
    // full base resolution.
    this.add
      .image(width / 2, height / 2, "room_preview")
      .setDisplaySize(width, height);
  }
}
