import Phaser from "phaser";
import { Boot } from "./scenes/Boot";

/**
 * Entry point. Base resolution 1920×1080, scales to fit the browser window
 * (letterboxed), centred. VHS scanline / grain post-processing is added later
 * via a pipeline; this file only concerns itself with the Phaser config.
 */
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 1920,
  height: 1080,
  backgroundColor: "#000000",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [Boot],
};

new Phaser.Game(config);
