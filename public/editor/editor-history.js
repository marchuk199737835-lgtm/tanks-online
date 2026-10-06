/* editor-history.js — Ctrl+Z / Ctrl+Y: історія змін (об'єкти, контур, налаштування) */
const HIST = (function () {
    let stack = [], idx = -1, lock = false;
    const snapshot = () => JSON.stringify({ o: ED.objects, s: ED.shape, set: ED.settings }, (k, v) => (k && k[0] === '_') ? undefined : v);   // службові поля (_open) в історію не потрапляють
    function restore(str) {
        const d = JSON.parse(str);
        ED.objects = d.o; ED.shape = d.s; ED.settings = d.set; ED.selected = null; ED.draftShape = null;
        if (typeof onHistoryRestored === 'function') onHistoryRestored();
    }
    return {
        reset() { stack = [snapshot()]; idx = 0; },
        commit() {                    // викликати ПІСЛЯ кожної завершеної зміни
            if (lock) return; const s = snapshot();
            if (stack[idx] === s) return;
            stack = stack.slice(0, idx + 1); stack.push(s); if (stack.length > 150) stack.shift(); idx = stack.length - 1; ED.dirty = true;
            if (typeof updateTopbar === 'function') updateTopbar();
        },
        undo() { if (idx <= 0) return false; idx--; restore(stack[idx]); ED.dirty = true; return true; },
        redo() { if (idx >= stack.length - 1) return false; idx++; restore(stack[idx]); ED.dirty = true; return true; },
        canUndo: () => idx > 0, canRedo: () => idx < stack.length - 1
    };
})();
