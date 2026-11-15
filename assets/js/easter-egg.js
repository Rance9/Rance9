/*
 * Small hidden details on the home page. Everything runs in the browser:
 * keystrokes are compared against a fixed sequence one at a time and clicks
 * only trigger the effects below. Nothing is recorded, stored or sent
 * anywhere; only the current match position (a number) is kept.
 *
 * - The classic cheat code, or choosing the lamp or the picture on the wall,
 *   reveals two static decorations once per page load.
 * - Choosing the TV screen plays a short "coming soon" message on it.
 * The clickable parts need this script, so they stay hidden without it.
 */
(function () {
  'use strict';

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
  var eggTriggers = document.querySelectorAll('[data-egg-trigger]');

  function setHidden(nodes, hidden) {
    for (var n = 0; n < nodes.length; n++) {
      if (hidden) { nodes[n].setAttribute('hidden', ''); } else { nodes[n].removeAttribute('hidden'); }
    }
  }

  function isEditable(node) {
    if (!node || node.nodeType !== 1) { return false; }
    if (node.isContentEditable) { return true; }
    return Boolean(node.closest &&
      node.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])'));
  }

  function reveal() {
    document.removeEventListener('keydown', onKeyDown);
    setHidden(document.querySelectorAll('[data-egg]'), false);
    setHidden(eggTriggers, true); // Nothing more to find once revealed.
  }

  function onKeyDown(event) {
    var key = event.key;
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
    if (matched === sequence.length) { reveal(); }
  }

  document.addEventListener('keydown', onKeyDown);

  for (var t = 0; t < eggTriggers.length; t++) {
    eggTriggers[t].addEventListener('click', reveal);
  }
  setHidden(eggTriggers, false);

  // TV screen: a few seconds of "coming soon", then back to the picture.
  var tv = document.querySelector('[data-tv-trigger]');
  var ad = document.querySelector('[data-tv-ad]');
  var status = document.querySelector('[data-tv-status]');
  var adTimer = 0;
  var AD_MS = 4500; // Matches the tv-ad animation in styles.css.

  function endAd() {
    ad.setAttribute('hidden', '');
    if (status) { status.textContent = ''; }
  }

  function playAd() {
    window.clearTimeout(adTimer);
    ad.setAttribute('hidden', '');
    void ad.offsetWidth; // Restart the animation if it is already playing.
    ad.removeAttribute('hidden');
    if (status) { status.textContent = 'TheBigMove.tv: coming in 2027.'; }
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
    tv.removeAttribute('hidden');
  }
}());
