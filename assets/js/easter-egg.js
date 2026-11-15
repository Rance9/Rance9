/*
 * Small interactive extras on the home page. Everything runs in the browser:
 * keystrokes and clicks only drive the effects below. Nothing is recorded,
 * stored or sent anywhere; a best score is kept in memory until the page
 * is closed or reloaded.
 *
 * - Lamp: lights out / lights on.
 * - TV screen: a few seconds of "coming soon" for The Big Move.
 * - Picture on the wall, or the classic cheat code: the TV zooms up into
 *   Cartridge Catch. Blow the dust out of the cartridge, then catch falling
 *   cartridges and dodge the dust bunnies.
 * The clickable parts need this script, so they stay hidden without it.
 */
(function () {
  'use strict';

  var hero = document.querySelector('.hero');
  var status = document.querySelector('[data-tv-status]');
  var reducedMotion = window.matchMedia ?
    window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  function show(el) { el.removeAttribute('hidden'); }
  function hide(el) { el.setAttribute('hidden', ''); }
  function announce(text) { if (status) { status.textContent = text; } }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  /* ---- TV screen: "coming soon" ----------------------------------------- */

  var tv = document.querySelector('[data-tv-trigger]');
  var ad = document.querySelector('[data-tv-ad]');
  var adTimer = 0;
  var AD_MS = 4500; // Matches the tv-ad animation in styles.css.

  function endAd() {
    window.clearTimeout(adTimer);
    if (ad && !ad.hasAttribute('hidden')) { hide(ad); announce(''); }
  }

  function playAd() {
    window.clearTimeout(adTimer);
    hide(ad);
    void ad.offsetWidth; // Restart the animation if it is already playing.
    show(ad);
    announce('TheBigMove.tv: coming in 2027.');
    adTimer = window.setTimeout(endAd, AD_MS);
  }

  if (tv && ad) {
    tv.addEventListener('click', playAd);
    tv.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        if (!event.repeat) { playAd(); }
      }
    });
    show(tv);
  }

  /* ---- Lamp: lights out ---------------------------------------------------- */

  var roomDark = document.querySelector('[data-room-dark]');
  var lamp = document.querySelector('[data-lamp]');
  if (hero && roomDark && lamp) {
    show(roomDark);
    lamp.addEventListener('click', function () {
      announce(hero.classList.toggle('is-dark') ? 'Lights out.' : 'Lights on.');
    });
    show(lamp);
  }

  /* ---- Cartridge Catch ------------------------------------------------------ */

  function createGame() {
    var root = document.querySelector('[data-game]');
    if (!hero || !root) { return null; }
    var canvas = root.querySelector('canvas');
    var ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
    var closeButton = root.querySelector('[data-game-close]');
    if (!ctx || !closeButton) { return null; }

    var W = 160;
    var H = 130;
    var PLAY_SECONDS = 45;
    var CATCHER_Y = H - 13;
    var FONT = 'px "Press Start 2P", monospace';
    var C = {
      bg: '#181D24', line: '#3A3F47', ink: '#2B2D26', cream: '#F7E2CA', red: '#D63B32',
      teal: '#4DB6A9', tealDark: '#2B6E69', gold: '#F5A623', goldDark: '#B97A10',
      grey: '#9BA0A6', greyDark: '#6E737A', dust: '#8A8580', dustDark: '#4A4540', black: '#0B0D10'
    };
    var CART = ['##########', '#oooooooo#', '#oLLLLLLo#', '#oLLLLLLo#', '#oLLLLLLo#',
      '#oLLLLLLo#', '#oooooooo#', '#o-o-o-oo#', '#oooooooo#', '#oo####oo#', '#oo#..#oo#', '####..####'];
    var CART_UP = CART.slice().reverse();
    var DUST = ['..#.##.#..', '.#aaaaaa#.', '#aaaaaaaa#', '#aKaaaaKa#', '#aaaaaaaa#',
      '#aaa##aaa#', '.#aaaaaa#.', '..######..'];
    var CONSOLE = ['....############....', '...#cccccccccccc#...', '..#ccccc####ccccc#..',
      '.#cccccc#..#cccccc#.', '#cccccccccccccccccc#', '#cRcccccccccccTcTcc#',
      '#cccccccccccccccccc#', '####################'];
    var HEART = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'];
    var LABELS = [C.red, C.tealDark, C.teal, C.cream];
    var CONSOLE_COLORS = { '#': C.ink, c: C.cream, R: C.red, T: C.greyDark };
    var DUST_COLORS = { '#': C.dustDark, a: C.dust, K: C.black };

    var state = 'off';
    var raf = 0;
    var lastTime = 0;
    var clock = 0;
    var clean = 0;
    var blowRound = 1;
    var bootTimer = 0;
    var bootWorks = false;
    var particles = [];
    var items = [];
    var catcherX = W / 2;
    var pointerTarget = null;
    var keyLeft = false;
    var keyRight = false;
    var spawnTimer = 0;
    var score = 0;
    var best = 0;
    var lives = 3;
    var timeLeft = PLAY_SECONDS;
    var shake = 0;
    var flash = 0;
    var overDelay = 0;
    var overTitle = '';
    var returnFocus = null;

    // On-screen prompts follow how the visitor is actually playing.
    var finePointer = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    var inputMode = finePointer ? 'mouse' : 'touch';
    var PROMPTS = {
      mouse: { blow: 'CLICK TO BLOW!', start: 'CLICK TO START', move: 'MOVE: MOUSE', again: 'CLICK TO PLAY' },
      touch: { blow: 'TAP TO BLOW!', start: 'TAP TO START', move: 'MOVE: DRAG', again: 'TAP TO PLAY' },
      keys: { blow: 'SPACE TO BLOW!', start: 'SPACE TO START', move: 'MOVE: ARROWS', again: 'SPACE TO PLAY' }
    };
    function prompt(name) { return PROMPTS[inputMode][name]; }

    function cartColors(label) { return { '#': C.ink, o: C.grey, L: label, '-': C.greyDark }; }
    var GOLD_COLORS = { '#': C.ink, o: C.gold, L: C.cream, '-': C.goldDark };

    function setState(next) { state = next; root.setAttribute('data-state', next); }

    /* Drawing helpers (the canvas is 160 x 130 "TV pixels"). */
    function sprite(map, x, y, colors, scale) {
      var s = scale || 1;
      for (var r = 0; r < map.length; r++) {
        for (var c = 0; c < map[r].length; c++) {
          var color = colors[map[r].charAt(c)];
          if (color) {
            ctx.fillStyle = color;
            ctx.fillRect(Math.round(x) + c * s, Math.round(y) + r * s, s, s);
          }
        }
      }
    }

    function text(str, x, y, color, size, align) {
      ctx.font = (size || 8) + FONT;
      ctx.textAlign = align || 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = color;
      ctx.fillText(str, Math.round(x), Math.round(y));
    }

    function blink(rate) { return reducedMotion.matches || Math.floor(clock * rate) % 2 === 0; }

    function staticNoise(count, alpha) {
      for (var i = 0; i < count; i++) {
        var v = 90 + Math.floor(Math.random() * 120);
        ctx.fillStyle = 'rgba(' + v + ',' + v + ',' + v + ',' + alpha + ')';
        ctx.fillRect(Math.floor(Math.random() * W), Math.floor(Math.random() * H), 1, 1);
      }
    }

    function burst(x, y, color, count, upward) {
      for (var i = 0; i < count; i++) {
        particles.push({
          x: x + (Math.random() - 0.5) * 8, y: y,
          vx: (Math.random() - 0.5) * 50,
          vy: upward ? -(20 + Math.random() * 45) : -(10 + Math.random() * 30),
          g: upward ? 25 : 90, life: 0.45 + Math.random() * 0.4,
          color: color, size: Math.random() < 0.3 ? 2 : 1
        });
      }
    }

    function popText(str, x, y, color) {
      particles.push({ text: str, x: x, y: y, vx: 0, vy: -18, g: 0, life: 0.7, color: color });
    }

    /* Placement: grow out of the TV into a playable screen on the page. */
    function tvBox() {
      var w = hero.clientWidth;
      var h = hero.clientHeight;
      return { x: w * 802 / 1280, y: h * 129 / 720, w: w * 171 / 1280, h: h * 139 / 720 };
    }

    function bigBox() {
      var rect = hero.getBoundingClientRect();
      var vw = document.documentElement.clientWidth;
      var margin = Math.min(16, vw * 0.04);
      var w = Math.min(vw - 2 * margin, 560);
      var h = w * 139 / 171;
      var tvb = tvBox();
      var x = clamp(tvb.x + tvb.w / 2 - w / 2, margin - rect.left, vw - margin - w - rect.left);
      return { x: x, y: (hero.clientHeight - h) / 2, w: w, h: h };
    }

    function place(box) {
      root.style.setProperty('--game-x', box.x + 'px');
      root.style.setProperty('--game-y', box.y + 'px');
      root.style.setProperty('--game-w', box.w + 'px');
      root.style.setProperty('--game-h', box.h + 'px');
    }

    function bringIntoView() {
      var top = hero.getBoundingClientRect().top + bigBox().y;
      var bottom = top + bigBox().h;
      var delta = 0;
      if (top < 8) { delta = top - 8; } else if (bottom > window.innerHeight - 8) { delta = Math.min(top - 8, bottom - window.innerHeight + 8); }
      if (delta) { window.scrollBy({ top: delta, behavior: reducedMotion.matches ? 'auto' : 'smooth' }); }
    }

    /* Game flow. */
    function resetBlow(round) {
      blowRound = round;
      clean = round === 1 ? 0 : 0.35;
      particles.length = 0;
      setState('blow');
    }

    function blow() {
      clean = Math.min(1, clean + 0.085);
      shake = Math.max(shake, 0.08);
      burst(80, 34, Math.random() < 0.5 ? C.dust : C.greyDark, 7, true);
      if (clean >= 1) {
        // The first attempt never works. Nobody knows why.
        bootWorks = blowRound > 1;
        bootTimer = bootWorks ? 0.9 : 1.4;
        if (bootWorks) { flash = 0.35; }
        setState('boot');
      }
    }

    function startPlay() {
      score = 0;
      lives = 3;
      timeLeft = PLAY_SECONDS;
      items.length = 0;
      particles.length = 0;
      spawnTimer = 0.6;
      catcherX = W / 2;
      setState('play');
      announce('Go! Move with the mouse, a finger or the arrow keys. Catch the cartridges and dodge the dust bunnies.');
    }

    function gameOver(title) {
      overTitle = title;
      best = Math.max(best, score);
      overDelay = 0.9;
      pointerTarget = null;
      setState('over');
      announce((title === 'TIME!' ? 'Time is up.' : 'Game over.') + ' You scored ' + score +
        '. Best this visit: ' + best + '. Click, tap or press Space to play again, or Escape to leave.');
    }

    function action() {
      if (state === 'blow') { blow(); } else if (state === 'title') { startPlay(); } else if (state === 'over' && overDelay <= 0) { startPlay(); }
    }

    function spawn(progress) {
      var roll = Math.random();
      var kind = roll < 0.05 ? 'gold' : (roll < 0.25 + 0.15 * progress ? 'dust' : 'cart');
      var h = kind === 'dust' ? 8 : 12;
      items.push({
        kind: kind, x: 2 + Math.random() * (W - 14), y: -h, w: 10, h: h,
        vy: (34 + 50 * progress) * (0.9 + Math.random() * 0.25) * (kind === 'dust' ? 0.85 : 1),
        phase: Math.random() * 6.28, label: LABELS[Math.floor(Math.random() * LABELS.length)]
      });
    }

    function catchItem(it) {
      if (it.kind === 'dust') {
        lives -= 1;
        shake = 0.3;
        burst(it.x + 5, CATCHER_Y, C.dust, 12, false);
        popText('ACHOO', it.x + 5, CATCHER_Y - 12, C.grey);
      } else {
        var points = it.kind === 'gold' ? 5 : 1;
        score += points;
        burst(it.x + 5, CATCHER_Y, it.kind === 'gold' ? C.gold : C.cream, 6, false);
        popText('+' + points, it.x + 5, CATCHER_Y - 12, it.kind === 'gold' ? C.gold : C.cream);
      }
    }

    function updatePlay(dt) {
      timeLeft -= dt;
      var progress = clamp(1 - timeLeft / PLAY_SECONDS, 0, 1);
      if (keyLeft !== keyRight) {
        catcherX += (keyRight ? 1 : -1) * 120 * dt;
      } else if (pointerTarget !== null) {
        var d = pointerTarget - catcherX;
        var step = 260 * dt;
        catcherX += Math.abs(d) <= step ? d : (d > 0 ? step : -step);
      }
      catcherX = clamp(catcherX, 10, W - 10);

      spawnTimer -= dt;
      if (spawnTimer <= 0) {
        spawn(progress);
        spawnTimer = (0.85 - 0.45 * progress) * (0.8 + Math.random() * 0.4);
      }

      for (var i = items.length - 1; i >= 0; i--) {
        var it = items[i];
        it.y += it.vy * dt;
        if (it.kind === 'dust') { it.x = clamp(it.x + Math.sin(clock * 3 + it.phase) * 14 * dt, 1, W - it.w - 1); }
        var bottom = it.y + it.h;
        if (bottom >= CATCHER_Y + 1 && bottom <= CATCHER_Y + 7 && Math.abs(it.x + it.w / 2 - catcherX) <= 11) {
          catchItem(it);
          items.splice(i, 1);
        } else if (it.y > H) {
          items.splice(i, 1);
        }
      }

      if (lives <= 0) { gameOver('GAME OVER'); } else if (timeLeft <= 0) { timeLeft = 0; gameOver('TIME!'); }
    }

    function update(dt) {
      shake = Math.max(0, shake - dt);
      flash = Math.max(0, flash - dt);
      for (var i = particles.length - 1; i >= 0; i--) {
        var p = particles[i];
        p.life -= dt;
        if (p.life <= 0) { particles.splice(i, 1); continue; }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += p.g * dt;
      }
      if (state === 'blow') {
        clean = Math.max(0, clean - 0.1 * dt);
      } else if (state === 'boot') {
        bootTimer -= dt;
        if (bootTimer <= 0) {
          if (bootWorks) {
            setState('title');
            announce('It works! Click, tap or press Space to start.');
          } else {
            resetBlow(2);
            announce('Still dusty. Blow again!');
          }
        }
      } else if (state === 'play') {
        updatePlay(dt);
      } else if (state === 'over') {
        overDelay -= dt;
      }
    }

    function drawBlow() {
      staticNoise(reducedMotion.matches ? 40 : 160, 0.35);
      for (var i = 0; i < 16; i++) { // Dust still stuck in the connector.
        if (i / 16 >= clean) { ctx.fillStyle = i % 2 ? C.dust : C.greyDark; ctx.fillRect(68 + (i * 7) % 24, 30 + (i * 3) % 5, 2, 2); }
      }
      sprite(CART_UP, 65, 34, cartColors(C.red), 3);
      ctx.fillStyle = C.cream;
      ctx.fillRect(40, 74, 80, 7);
      ctx.fillStyle = C.bg;
      ctx.fillRect(41, 75, 78, 5);
      ctx.fillStyle = C.teal;
      ctx.fillRect(41, 75, Math.round(78 * clean), 5);
      text(blowRound === 1 ? 'DUSTY CARTRIDGE' : 'STILL DUSTY!', 80, 88, C.cream);
      if (blink(2.5)) { text(prompt('blow'), 80, 104, C.gold); }
    }

    function drawGlitch() {
      staticNoise(260, 0.5);
      for (var band = 0; band < 6; band++) {
        var y = 10 + band * 19;
        var off = reducedMotion.matches ? (band * 7) % 13 - 6 : Math.round((Math.random() - 0.5) * 24);
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, y, W, 10);
        ctx.clip();
        text(band % 2 ? 'CARTRIDGE' : 'C#TR!DG3', 80 + off, y - 3, band % 3 ? C.red : C.teal, 16);
        ctx.restore();
      }
    }

    function drawTitle() {
      text('CARTRIDGE', 80, 12, C.cream, 16);
      text('CATCH', 80, 32, C.red, 16);
      var bob = reducedMotion.matches ? 0 : Math.round(Math.sin(clock * 3) * 2);
      sprite(CART, 75, 54 + bob, cartColors(C.teal));
      sprite(CONSOLE, 70, 70, CONSOLE_COLORS);
      if (blink(2)) { text(prompt('start'), 80, 88, C.gold); }
      text(prompt('move'), 80, 102, C.grey);
      if (best > 0) { text('BEST ' + best, 80, 116, C.teal); }
    }

    function drawPlay() {
      ctx.fillStyle = C.line;
      ctx.fillRect(0, H - 4, W, 1);
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        if (it.kind === 'dust') { sprite(DUST, it.x, it.y, DUST_COLORS); } else { sprite(CART, it.x, it.y, it.kind === 'gold' ? GOLD_COLORS : cartColors(it.label)); }
      }
      sprite(CONSOLE, catcherX - 10, CATCHER_Y, CONSOLE_COLORS);
      text(String(score), 4, 4, C.cream, 8, 'left');
      text(String(Math.ceil(timeLeft)), 80, 4, timeLeft < 10 ? C.red : C.grey);
      // Lives sit left of the close button in the top-right corner.
      for (var h = 0; h < 3; h++) { sprite(HEART, W - 56 + h * 9, 5, { '#': h < lives ? C.red : C.line }); }
    }

    function drawOver() {
      text(overTitle, 80, 18, overTitle === 'TIME!' ? C.gold : C.red, 16);
      text('SCORE ' + score, 80, 48, C.cream);
      text('BEST ' + best, 80, 62, C.teal);
      if (overDelay <= 0 && blink(2)) {
        text(prompt('again'), 80, 90, C.gold);
        text('AGAIN', 80, 102, C.grey);
      }
    }

    function draw() {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, W, H);
      if (shake > 0 && !reducedMotion.matches) {
        ctx.translate(Math.round((Math.random() - 0.5) * 3), Math.round((Math.random() - 0.5) * 3));
      }
      if (state === 'blow') { drawBlow(); } else if (state === 'boot') { if (bootWorks) { drawTitle(); } else { drawGlitch(); } } else if (state === 'title') { drawTitle(); } else if (state === 'play') { drawPlay(); } else if (state === 'over') { drawOver(); }
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        ctx.globalAlpha = Math.min(1, p.life * 2);
        if (p.text) { text(p.text, p.x, p.y, p.color); } else { ctx.fillStyle = p.color; ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size); }
      }
      ctx.globalAlpha = 1;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (flash > 0) {
        ctx.fillStyle = 'rgba(247, 226, 202, ' + (flash / 0.35 * 0.6).toFixed(3) + ')';
        ctx.fillRect(0, 0, W, H);
      }
      ctx.fillStyle = 'rgba(0, 0, 0, 0.12)'; // Scanlines.
      for (var y = 1; y < H; y += 2) { ctx.fillRect(0, y, W, 1); }
    }

    function frame(now) {
      raf = window.requestAnimationFrame(frame);
      var dt = lastTime ? Math.min(1 / 30, (now - lastTime) / 1000) : 0;
      lastTime = now;
      clock += dt;
      update(dt);
      draw();
    }

    /* Input. */
    function inGame(target) {
      return root.contains(target) || target === document.body || target === document.documentElement;
    }

    function onKey(event) {
      var key = event.key;
      if (key === 'Escape') { event.preventDefault(); stop(); return; }
      if (key === 'Tab' || event.ctrlKey || event.altKey || event.metaKey || !inGame(event.target)) { return; }
      if (event.target === closeButton && (key === 'Enter' || key === ' ')) { return; }
      if (key === 'ArrowLeft' || key === 'a' || key === 'A') {
        keyLeft = true; pointerTarget = null; inputMode = 'keys'; event.preventDefault();
      } else if (key === 'ArrowRight' || key === 'd' || key === 'D') {
        keyRight = true; pointerTarget = null; inputMode = 'keys'; event.preventDefault();
      } else if (key === ' ' || key === 'Enter') {
        event.preventDefault();
        inputMode = 'keys';
        if (!event.repeat) { action(); }
      } else if (key === 'ArrowUp' || key === 'ArrowDown' || key === 'PageUp' || key === 'PageDown' || key === 'Home' || key === 'End') {
        event.preventDefault();
      }
    }

    function onKeyUp(event) {
      var key = event.key;
      if (key === 'ArrowLeft' || key === 'a' || key === 'A') { keyLeft = false; }
      if (key === 'ArrowRight' || key === 'd' || key === 'D') { keyRight = false; }
    }

    function aimAt(event) {
      var r = canvas.getBoundingClientRect();
      pointerTarget = (event.clientX - r.left) / r.width * W;
    }

    function pointerMode(event) { inputMode = event.pointerType === 'mouse' ? 'mouse' : 'touch'; }

    canvas.addEventListener('pointerdown', function (event) {
      if (state === 'off') { return; }
      event.preventDefault();
      pointerMode(event);
      try { canvas.setPointerCapture(event.pointerId); } catch (e) { /* not needed */ }
      aimAt(event);
      if (state !== 'play') { action(); }
    });

    // While playing, the console follows the mouse anywhere on the page, and a
    // finger anywhere on the game screen.
    function onPointerMove(event) {
      var isMouse = event.pointerType === 'mouse';
      if (!isMouse && !root.contains(event.target)) { return; }
      inputMode = isMouse ? 'mouse' : 'touch';
      if (state === 'play') { aimAt(event); }
    }
    closeButton.addEventListener('click', function () { stop(); });

    function onResize() { place(bigBox()); }

    function onVisibility() {
      if (document.hidden) {
        window.cancelAnimationFrame(raf);
        raf = 0;
      } else if (state !== 'off' && !raf) {
        lastTime = 0;
        raf = window.requestAnimationFrame(frame);
      }
    }

    function start() {
      if (state !== 'off') { return; }
      endAd();
      if (document.fonts && document.fonts.load) { document.fonts.load('8px "Press Start 2P"'); }
      var active = document.activeElement;
      returnFocus = active && active !== document.body && !root.contains(active) ? active : null;
      place(tvBox());
      show(root);
      void root.offsetWidth; // Let the screen grow from the TV.
      place(bigBox());
      try { root.focus({ preventScroll: true }); } catch (e) { root.focus(); }
      bringIntoView();
      resetBlow(1);
      announce('Cartridge Catch. The cartridge is dusty: click, tap or press Space quickly to blow it clean. Press Escape to leave.');
      document.addEventListener('keydown', onKey, true);
      document.addEventListener('keyup', onKeyUp, true);
      document.addEventListener('pointermove', onPointerMove);
      window.addEventListener('resize', onResize);
      document.addEventListener('visibilitychange', onVisibility);
      lastTime = 0;
      raf = window.requestAnimationFrame(frame);
    }

    function stop() {
      if (state === 'off') { return; }
      window.cancelAnimationFrame(raf);
      raf = 0;
      setState('off');
      keyLeft = false;
      keyRight = false;
      pointerTarget = null;
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('keyup', onKeyUp, true);
      document.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      if (root.contains(document.activeElement)) {
        if (returnFocus && document.contains(returnFocus)) { returnFocus.focus({ preventScroll: true }); } else { document.activeElement.blur(); }
      }
      returnFocus = null;
      place(tvBox());
      window.setTimeout(function () { if (state === 'off') { hide(root); } }, reducedMotion.matches ? 0 : 360);
      announce('Game closed.');
    }

    return { start: start, isActive: function () { return state !== 'off'; } };
  }

  var game = createGame();
  var picture = document.querySelector('[data-picture]');
  if (game && picture) {
    picture.addEventListener('click', function () { game.start(); });
    show(picture);
  }

  /* ---- The classic cheat code ----------------------------------------------- */

  var sequence = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
    'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

  // Prefix table (Knuth–Morris–Pratt) so a mistaken or overlapping attempt,
  // such as an extra ArrowUp at the start, still matches correctly.
  var fallback = [0];
  for (var i = 1, k = 0; i < sequence.length; i++) {
    while (k > 0 && sequence[i] !== sequence[k]) { k = fallback[k - 1]; }
    if (sequence[i] === sequence[k]) { k++; }
    fallback[i] = k;
  }

  var matched = 0;
  var modifierOnly = {
    Shift: true, Control: true, Alt: true, AltGraph: true, Meta: true,
    OS: true, CapsLock: true, Fn: true, FnLock: true, Hyper: true, Super: true
  };

  function isEditable(node) {
    if (!node || node.nodeType !== 1) { return false; }
    if (node.isContentEditable) { return true; }
    return Boolean(node.closest &&
      node.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])'));
  }

  document.addEventListener('keydown', function (event) {
    var key = event.key;
    if (!game || game.isActive()) { matched = 0; return; }
    if (typeof key !== 'string' || event.repeat || event.isComposing) { return; }
    if (event.ctrlKey || event.altKey || event.metaKey || modifierOnly[key]) { return; }
    if (isEditable(event.target)) { return; }
    if (key.length === 1) {
      key = key.toLowerCase();
    } else if (event.shiftKey) {
      return; // Shift with a navigation key is a selection shortcut.
    }

    while (matched > 0 && sequence[matched] !== key) { matched = fallback[matched - 1]; }
    if (sequence[matched] === key) { matched++; }
    if (matched === sequence.length) {
      matched = 0;
      game.start();
    }
  });
}());
