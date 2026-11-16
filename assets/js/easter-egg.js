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
  // Blurred, dimmed page behind the game screen and the hunt's cards. It only
  // blocks stray clicks; Escape or the close buttons close things.
  var backdrop = document.querySelector('[data-play-backdrop]');
  function backdropOn() { if (backdrop) { show(backdrop); } }
  function backdropOff() { if (backdrop) { hide(backdrop); } }

  // Leaving a game played in the dark turns the room's lights back on.
  function lightsOn() { if (hero) { hero.classList.remove('is-dark'); } }

  // A dust bunny, 10 x 8 pixels: # outline, a fuzz, K eyes.
  var DUST_SPRITE = ['..#.##.#..', '.#aaaaaa#.', '#aaaaaaaa#', '#aKaaaaKa#', '#aaaaaaaa#',
    '#aaa##aaa#', '.#aaaaaa#.', '..######..'];
  var touchFirst = window.matchMedia ?
    window.matchMedia('(hover: none) and (pointer: coarse)') : { matches: false };

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
    announce('The Big Move: coming in 2027.');
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
  var roomHint = document.querySelector('[data-room-hint]');
  var lamp = document.querySelector('[data-lamp]');
  if (hero && roomDark && lamp) {
    show(roomDark);
    if (roomHint) { show(roomHint); }
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
    var DUST = DUST_SPRITE;
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
      // Touch drags stay with the screen; a mouse is followed anywhere anyway,
      // and capturing it would hide the pointer's normal cursor elsewhere.
      if (event.pointerType !== 'mouse') {
        try { canvas.setPointerCapture(event.pointerId); } catch (e) { /* not needed */ }
      }
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
      backdropOn();
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
      backdropOff();
      lightsOn();
      announce('Game closed.');
    }

    return { start: start, isActive: function () { return state !== 'off'; } };
  }

  var game = createGame();
  var picture = document.querySelector('[data-picture]');
  if (game && picture) {
    picture.addEventListener('click', function () { if (!hunt || !hunt.isActive()) { game.start(); } });
    picture.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        if (!event.repeat) { game.start(); }
      }
    });
    show(picture);
  }

  /* ---- Dust Bunny Hunt (secret: only the cheat code opens it) ---------------- */

  function createHunt() {
    var root = document.querySelector('[data-hunt]');
    if (!hero || !root) { return null; }
    var field = root.querySelector('[data-hunt-field]');
    var card = root.querySelector('[data-hunt-card]');
    var kicker = root.querySelector('[data-hunt-kicker]');
    var title = root.querySelector('[data-hunt-title]');
    var blurb = root.querySelector('[data-hunt-text]');
    var go = root.querySelector('[data-hunt-go]');
    var closeButton = root.querySelector('[data-hunt-close]');
    var hud = root.querySelector('[data-hunt-hud]');
    var scoreText = root.querySelector('[data-hunt-score]');
    var timeText = root.querySelector('[data-hunt-time]');
    if (!field || !card || !go || !closeButton || !hud) { return null; }

    var SECONDS = 30;
    var SVG_NS = 'http://www.w3.org/2000/svg';
    // Hiding places in the 1280 x 720 picture: where a bunny's feet touch down.
    var SPOTS = [
      [42, 106], [378, 262], [232, 332], [352, 333], [110, 345], [330, 452], [914, 549], [812, 462],
      [852, 368], [930, 104], [1000, 448], [1182, 478], [1150, 600], [690, 40], [545, 400]
    ];
    var NORMAL = { '#': '#4A4540', a: '#A49F99', K: '#0B0D10' };
    var GOLDEN = { '#': '#8B6914', a: '#F5A623', K: '#0B0D10' };

    var state = 'off';
    var raf = 0;
    var lastTime = 0;
    var timeLeft = SECONDS;
    var spawnTimer = 0;
    var score = 0;
    var best = 0;
    var bunnies = [];
    var returnFocus = null;

    function verb() { return touchFirst.matches ? 'Tap' : 'Click'; }

    function bunnySvg(colors) {
      var svg = document.createElementNS(SVG_NS, 'svg');
      svg.setAttribute('viewBox', '0 0 10 8');
      svg.setAttribute('shape-rendering', 'crispEdges');
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('focusable', 'false');
      for (var r = 0; r < DUST_SPRITE.length; r++) {
        for (var c = 0; c < DUST_SPRITE[r].length; c++) {
          var color = colors[DUST_SPRITE[r].charAt(c)];
          if (color) {
            var px = document.createElementNS(SVG_NS, 'rect');
            px.setAttribute('x', c);
            px.setAttribute('y', r);
            px.setAttribute('width', 1);
            px.setAttribute('height', 1);
            px.setAttribute('fill', color);
            svg.appendChild(px);
          }
        }
      }
      return svg;
    }

    function place(el, x, y) {
      el.style.left = (x / 12.8) + '%';
      el.style.top = (y / 7.2) + '%';
    }

    function poof(bunny, points) {
      if (reducedMotion.matches) { return; }
      var p = document.createElement('span');
      p.className = 'hunt-poof';
      place(p, bunny.spot[0], bunny.spot[1] - 12);
      for (var i = 0; i < 8; i++) {
        var bit = document.createElement('i');
        var angle = (i / 8) * Math.PI * 2;
        bit.style.setProperty('--dx', Math.round(Math.cos(angle) * 26) + 'px');
        bit.style.setProperty('--dy', Math.round(Math.sin(angle) * 20) + 'px');
        p.appendChild(bit);
      }
      var label = document.createElement('b');
      label.textContent = '+' + points;
      p.appendChild(label);
      field.appendChild(p);
      window.setTimeout(function () { p.remove(); }, 650);
    }

    function removeBunny(bunny, delay) {
      if (document.activeElement === bunny.el) { root.focus({ preventScroll: true }); }
      window.setTimeout(function () { bunny.el.remove(); }, delay);
      bunnies.splice(bunnies.indexOf(bunny), 1);
    }

    function bust(bunny) {
      if (bunny.done || state !== 'play') { return; }
      bunny.done = true;
      var points = bunny.golden ? 3 : 1;
      score += points;
      poof(bunny, points);
      removeBunny(bunny, 0);
      updateHud();
    }

    function leave(bunny) {
      if (bunny.done) { return; }
      bunny.done = true;
      bunny.el.classList.add('is-leaving');
      removeBunny(bunny, reducedMotion.matches ? 0 : 160);
    }

    function spawn(progress) {
      var taken = bunnies.map(function (b) { return b.spot; });
      var free = SPOTS.filter(function (s) { return taken.indexOf(s) < 0; });
      if (!free.length) { return; }
      var spot = free[Math.floor(Math.random() * free.length)];
      var golden = Math.random() < 0.08;
      var el = document.createElement('button');
      el.type = 'button';
      el.className = 'hunt-bunny';
      el.setAttribute('aria-label', golden ? 'Golden dust bunny' : 'Dust bunny');
      el.appendChild(bunnySvg(golden ? GOLDEN : NORMAL));
      place(el, spot[0], spot[1]);
      var bunny = { el: el, spot: spot, golden: golden, done: false, life: (1.6 - 0.8 * progress) * (0.85 + Math.random() * 0.3) };
      el.addEventListener('pointerdown', function (event) { event.preventDefault(); bust(bunny); });
      el.addEventListener('click', function () { bust(bunny); }); // Keyboard: Enter or Space.
      field.appendChild(el);
      bunnies.push(bunny);
    }

    function updateHud() {
      scoreText.textContent = String(score);
      timeText.textContent = String(Math.max(0, Math.ceil(timeLeft)));
    }

    function showCard(top, heading, text, button) {
      kicker.textContent = top;
      title.textContent = heading;
      blurb.textContent = text;
      go.textContent = button;
      show(card);
      try { go.focus({ preventScroll: true }); } catch (e) { go.focus(); }
    }

    function frame(now) {
      raf = window.requestAnimationFrame(frame);
      var dt = lastTime ? Math.min(0.1, (now - lastTime) / 1000) : 0;
      lastTime = now;
      if (state !== 'play') { return; }
      timeLeft -= dt;
      var progress = clamp(1 - timeLeft / SECONDS, 0, 1);
      spawnTimer -= dt;
      if (spawnTimer <= 0 && bunnies.length < 1 + Math.floor(progress * 3)) {
        spawn(progress);
        spawnTimer = (0.8 - 0.4 * progress) * (0.8 + Math.random() * 0.4);
      }
      for (var i = bunnies.length - 1; i >= 0; i--) {
        bunnies[i].life -= dt;
        if (bunnies[i].life <= 0) { leave(bunnies[i]); }
      }
      if (timeLeft <= 0) { finish(); } else { updateHud(); }
    }

    function clearBunnies() {
      while (bunnies.length) { var b = bunnies[0]; b.done = true; removeBunny(b, 0); }
      field.textContent = '';
    }

    function play() {
      clearBunnies();
      score = 0;
      timeLeft = SECONDS;
      spawnTimer = 0.3;
      updateHud();
      hide(card);
      backdropOff();
      show(hud);
      state = 'play';
      root.setAttribute('data-state', 'play');
      try { root.focus({ preventScroll: true }); } catch (e) { root.focus(); }
      announce('Go! ' + verb() + ' the dust bunnies before they hide. Keyboard: Tab to a bunny and press Enter.');
    }

    function finish() {
      state = 'over';
      root.setAttribute('data-state', 'over');
      clearBunnies();
      best = Math.max(best, score);
      hide(hud);
      lightsOn();
      backdropOn();
      showCard('TIME!', score + ' BUSTED', 'Best this visit: ' + best + '. Thanks for finding the secret.', 'Play again');
      announce('Time! You busted ' + score + ' dust bunnies. Best this visit: ' + best + '.');
    }

    function onKey(event) {
      if (event.key === 'Escape') { event.preventDefault(); stop(); }
    }

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
      if (state !== 'off' || (game && game.isActive())) { return; }
      endAd();
      var active = document.activeElement;
      returnFocus = active && active !== document.body && !root.contains(active) ? active : null;
      backdropOn();
      show(root);
      hide(hud);
      state = 'intro';
      root.setAttribute('data-state', 'intro');
      var rect = hero.getBoundingClientRect();
      if (rect.top < 0 || rect.bottom > window.innerHeight) {
        hero.scrollIntoView({ block: 'center', behavior: reducedMotion.matches ? 'auto' : 'smooth' });
      }
      var text = verb() + ' the dust bunnies before they hide. You have ' + SECONDS + ' seconds.';
      showCard('SECRET UNLOCKED', 'DUST BUNNY HUNT', text, 'Start');
      announce('Secret unlocked: Dust Bunny Hunt. ' + text);
      document.addEventListener('keydown', onKey, true);
      document.addEventListener('visibilitychange', onVisibility);
      lastTime = 0;
      raf = window.requestAnimationFrame(frame);
    }

    function stop() {
      if (state === 'off') { return; }
      window.cancelAnimationFrame(raf);
      raf = 0;
      state = 'off';
      root.setAttribute('data-state', 'off');
      clearBunnies();
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('visibilitychange', onVisibility);
      if (root.contains(document.activeElement)) {
        if (returnFocus && document.contains(returnFocus)) { returnFocus.focus({ preventScroll: true }); } else { document.activeElement.blur(); }
      }
      returnFocus = null;
      hide(root);
      backdropOff();
      lightsOn();
      announce('Dust Bunny Hunt closed.');
    }

    go.addEventListener('click', function () { if (state === 'intro' || state === 'over') { play(); } });
    closeButton.addEventListener('click', stop);

    return { start: start, isActive: function () { return state !== 'off'; } };
  }

  var hunt = createHunt();

  /* ---- Yearbook and console: a product pop-up before leaving the site --------- */

  var modal = document.querySelector('[data-product-modal]');
  if (modal && typeof modal.showModal === 'function') {
    var modalName = modal.querySelector('[data-modal-name]');
    var modalTagline = modal.querySelector('[data-modal-tagline]');
    var modalBlurb = modal.querySelector('[data-modal-blurb]');
    var modalRelease = modal.querySelector('[data-modal-release]');
    var modalLink = modal.querySelector('[data-modal-link]');
    var modalLinkNote = modal.querySelector('[data-modal-link-note]');
    var links = document.querySelectorAll('[data-product-link]');

    var openProduct = function (link) {
      var product = link.getAttribute('data-product-link');
      var source = document.querySelector('.product-card[data-product="' + product + '"]');
      if (!source) { return false; }
      var name = source.querySelector('.product-name');
      modalName.className = name.className + ' product-modal-name';
      modalName.textContent = '';
      for (var n = 0; n < name.childNodes.length; n++) { modalName.appendChild(name.childNodes[n].cloneNode(true)); }
      modalTagline.textContent = source.querySelector('.product-tagline').textContent;
      modalBlurb.textContent = source.querySelector('.product-description').textContent;
      modalRelease.textContent = source.querySelector('.product-release').textContent;
      var href = link.getAttribute('href');
      modalLink.setAttribute('href', href);
      modalLinkNote.textContent = ' (opens ' + href.replace(/^https?:\/\//, '').replace(/\/$/, '') + ' in a new tab)';
      modal.setAttribute('data-theme', product);
      endAd();
      modal.showModal();
      return true;
    };

    for (var l = 0; l < links.length; l++) {
      var label = links[l].getAttribute('aria-label') || '';
      links[l].setAttribute('aria-label', label.replace(/\s*\(opens in a new tab\)$/, ''));
      links[l].setAttribute('aria-haspopup', 'dialog');
      links[l].addEventListener('click', function (event) {
        if (openProduct(this)) { event.preventDefault(); }
      });
    }
    modal.addEventListener('click', function (event) {
      // The backdrop and the close button close it; the pill opens the site and closes it too.
      if (event.target === modal || event.target.closest('[data-modal-close]') || event.target.closest('[data-modal-link]')) {
        modal.close();
      }
    });
  }

  /* ---- The classic cheat code (keyboard) and its swipe version (touch) ------ */

  // Returns a function that takes one input at a time and reports when the
  // whole sequence has just been entered. A prefix table (Knuth–Morris–Pratt)
  // means a mistaken or overlapping attempt, such as an extra Up at the
  // start, still matches correctly.
  function sequenceMatcher(sequence) {
    var fallback = [0];
    for (var i = 1, k = 0; i < sequence.length; i++) {
      while (k > 0 && sequence[i] !== sequence[k]) { k = fallback[k - 1]; }
      if (sequence[i] === sequence[k]) { k++; }
      fallback[i] = k;
    }
    var matched = 0;
    var next = function (input) {
      while (matched > 0 && sequence[matched] !== input) { matched = fallback[matched - 1]; }
      if (sequence[matched] === input) { matched++; }
      if (matched === sequence.length) { matched = 0; return true; }
      return false;
    };
    next.reset = function () { matched = 0; };
    return next;
  }

  var keyCode = sequenceMatcher(['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
    'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']);
  var swipeCode = sequenceMatcher(['up', 'up', 'down', 'down', 'left', 'right', 'left', 'right']);

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
    if (!hunt || hunt.isActive() || (game && game.isActive())) { keyCode.reset(); return; }
    if (typeof key !== 'string' || event.repeat || event.isComposing) { return; }
    if (event.ctrlKey || event.altKey || event.metaKey || modifierOnly[key]) { return; }
    if (key === ' ' || key === 'Enter') { return; } // "B space A" or a final Enter still count.
    if (isEditable(event.target)) { return; }
    if (key.length === 1) {
      key = key.toLowerCase();
    } else if (event.shiftKey) {
      return; // Shift with a navigation key is a selection shortcut.
    }
    if (keyCode(key)) { hunt.start(); }
  });

  // Touch screens: with the lights out, swipe the arrows on the room. Taps
  // are ignored here, so they keep working as usual. (While the room is dark
  // the picture does not scroll the page; see styles.css.)
  var swipeStart = null;
  if (hero && hunt) {
    hero.addEventListener('pointerdown', function (event) {
      swipeStart = null;
      if (event.pointerType === 'mouse' || !touchFirst.matches || !hero.classList.contains('is-dark') ||
        hunt.isActive() || (game && game.isActive())) { return; }
      swipeStart = { x: event.clientX, y: event.clientY, id: event.pointerId };
    });
    hero.addEventListener('pointerup', function (event) {
      if (!swipeStart || event.pointerId !== swipeStart.id) { return; }
      var dx = event.clientX - swipeStart.x;
      var dy = event.clientY - swipeStart.y;
      swipeStart = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) { return; } // A tap, not a swipe.
      var direction = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      if (swipeCode(direction)) { hunt.start(); }
    });
    hero.addEventListener('pointercancel', function () { swipeStart = null; });
  }
}());
