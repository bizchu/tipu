import Phaser from 'phaser';

/** Always-on "?" button (bottom-left) that opens the How to Play slides over the current scene. */
export const HelpButton = {
  el: null as HTMLButtonElement | null,

  show(game: Phaser.Game): void {
    if (!this.el) {
      const style = document.createElement('style');
      style.textContent = `
        #help-btn{position:fixed;left:max(16px,2vw);bottom:max(16px,3vh);z-index:15;width:56px;height:56px;border-radius:50%;
          background:#1a100c;color:#f6e2b4;border:3px solid #d9a54e;font:bold 30px Georgia,serif;cursor:pointer;
          box-shadow:0 4px 14px rgba(0,0,0,.6)}
        #help-btn:hover{background:#2a1a12}
        #help-btn:focus-visible{outline:3px solid #fff;outline-offset:3px}
        #help-btn.pulse{animation:helpPulse 1s ease-in-out infinite}
        @keyframes helpPulse{0%,100%{transform:scale(1);box-shadow:0 0 0 0 rgba(217,165,78,.7)}50%{transform:scale(1.15);box-shadow:0 0 0 14px rgba(217,165,78,0)}}
        @media (prefers-reduced-motion:reduce){#help-btn.pulse{animation:none;border-color:#ff5a3a}}`;
      document.head.appendChild(style);
      const b = document.createElement('button');
      b.id = 'help-btn';
      b.textContent = '?';
      b.setAttribute('aria-label', 'How to play');
      b.addEventListener('click', () => {
        this.stopPulse();
        if (game.scene.isActive('HowTo')) return;
        const current = game.scene.getScenes(true)[0];
        if (!current) return;
        current.scene.pause();
        game.scene.run('HowTo', { returnTo: current.scene.key });
        game.scene.bringToTop('HowTo');
      });
      document.body.appendChild(b);
      this.el = b;
    }
    this.el.style.display = 'block';
  },

  hide(): void {
    if (this.el) this.el.style.display = 'none';
  },

  pulse(): void {
    this.el?.classList.add('pulse');
  },

  stopPulse(): void {
    this.el?.classList.remove('pulse');
  },
};
