/*
 * A small hidden detail. Reveals two static decorations once per page load.
 * Runs only in the browser: keystrokes are compared against a fixed sequence
 * one at a time and are never recorded, stored or sent anywhere. Only the
 * current match position (a number) is kept.
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

  function isEditable(node) {
    if (!node || node.nodeType !== 1) { return false; }
    if (node.isContentEditable) { return true; }
    return Boolean(node.closest &&
      node.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])'));
  }

  function reveal() {
    document.removeEventListener('keydown', onKeyDown);
    var marks = document.querySelectorAll('[data-egg]');
    for (var j = 0; j < marks.length; j++) { marks[j].removeAttribute('hidden'); }
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
}());
