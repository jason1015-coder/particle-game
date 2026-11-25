/*
 * Particle — chain reaction on a 7x7 board.
 *
 * Two players share one board. A cell has 2, 3 or 4 capacity depending on
 * whether it sits in a corner, on an edge or inside. Playing a particle into
 * a cell that reaches capacity makes it split: it loses its particles and
 * fires one into each orthogonal neighbour, recolouring them for the splitter.
 * Neighbours that fill up in the same wave split in turn, which is the chain
 * reaction. The resolving waves are replayed as frames so you can watch it.
 */
(() => {
  'use strict';

  const N = 7;
  const NAMES = { 1: 'Cyan', 2: 'Amber' };

  const gridEl = document.getElementById('grid');
  const p1El = document.getElementById('player-1');
  const p2El = document.getElementById('player-2');
  const p1CountEl = document.getElementById('p1-count');
  const p2CountEl = document.getElementById('p2-count');
  const turnEl = document.getElementById('turn');
  const resetEl = document.getElementById('reset');
  const overlayEl = document.getElementById('overlay');
  const winnerEl = document.getElementById('winner-text');
  const againEl = document.getElementById('again');

  let board;
  let cells = [];
  let current = 1;
  let winner = 0;
  let locked = false;
  let hasMoved = { 1: false, 2: false };
  let timers = [];

  const SLOTS = {
    1: ['s1'],
    2: ['s2', 's5'],
    3: ['s2', 's3', 's4'],
  };

  function slotsFor(count) {
    if (count <= 1) return SLOTS[1];
    if (count === 2) return SLOTS[2];
    if (count === 3) return SLOTS[3];
    return ['s2', 's3', 's6', 's5'];
  }

  function capacity(r, c) {
    const edges = (r === 0 || r === N - 1 ? 1 : 0) + (c === 0 || c === N - 1 ? 1 : 0);
    return 4 - edges;
  }

  function neighbours(r, c) {
    const out = [];
    if (r > 0) out.push([r - 1, c]);
    if (r < N - 1) out.push([r + 1, c]);
    if (c > 0) out.push([r, c - 1]);
    if (c < N - 1) out.push([r, c + 1]);
    return out;
  }

  function newBoard() {
    return Array.from({ length: N }, () =>
      Array.from({ length: N }, () => ({ owner: 0, count: 0 }))
    );
  }

  function snapshot() {
    return board.map((row) => row.map((cell) => ({ owner: cell.owner, count: cell.count })));
  }

  function tally(snap) {
    let a = 0;
    let b = 0;
    for (const row of snap) {
      for (const cell of row) {
        if (cell.owner === 1) a += cell.count;
        else if (cell.owner === 2) b += cell.count;
      }
    }
    return { 1: a, 2: b };
  }

  function build() {
    gridEl.innerHTML = '';
    cells = [];
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'cell';
        cell.dataset.index = String(r * N + c);
        cell.setAttribute('aria-label', 'row ' + (r + 1) + ', column ' + (c + 1));
        cell.addEventListener('click', () => play(r, c));
        gridEl.appendChild(cell);
        cells.push(cell);
      }
    }
  }

  function render(snap, boom) {
    const burning = new Set((boom || []).map(([r, c]) => r * N + c));
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const index = r * N + c;
        const cellEl = cells[index];
        const cell = snap[r][c];
        cellEl.className = 'cell' + (cell.count > 0 ? ' p' + cell.owner : '');
        cellEl.innerHTML = '';
        if (cell.count > 0) {
          for (const slot of slotsFor(cell.count)) {
            const orb = document.createElement('span');
            orb.className = 'orb ' + slot;
            cellEl.appendChild(orb);
          }
        }
        if (burning.has(index)) {
          const burst = document.createElement('span');
          burst.className = 'burst p' + (cell.owner || current);
          cellEl.appendChild(burst);
        }
      }
    }
    updateStatus(snap);
  }

  function updateStatus(snap) {
    const counts = tally(snap);
    p1CountEl.textContent = String(counts[1]);
    p2CountEl.textContent = String(counts[2]);
    p1El.classList.toggle('active', !winner && current === 1);
    p2El.classList.toggle('active', !winner && current === 2);
    turnEl.textContent = winner ? NAMES[winner] + ' wins' : NAMES[current] + ' to move';
  }

  /*
   * Resolve one placement, returning the board after each wave of splits.
   * Mutates `board`, so the last frame is the live state.
   */
  function simulate(r, c, player) {
    const frames = [];
    board[r][c].owner = player;
    board[r][c].count += 1;
    frames.push({ snap: snapshot(), boom: [] });

    let wave = [[r, c]];
    let guard = 0;

    while (wave.length > 0 && guard < 500) {
      guard += 1;
      const next = [];
      const boom = [];

      for (const [cr, cc] of wave) {
        const cell = board[cr][cc];
        const cap = capacity(cr, cc);
        if (cell.count < cap) continue;
        const owner = cell.owner || player;
        let fired = false;

        while (cell.count >= cap) {
          cell.count -= cap;
          if (cell.count === 0) cell.owner = 0;
          for (const [nr, nc] of neighbours(cr, cc)) {
            const nb = board[nr][nc];
            nb.count += 1;
            nb.owner = owner;
            if (nb.count >= capacity(nr, nc)) next.push([nr, nc]);
          }
          fired = true;
        }

        if (fired) boom.push([cr, cc, owner]);
      }

      if (boom.length > 0) frames.push({ snap: snapshot(), boom });
      wave = next;
    }

    return frames;
  }

  function replay(frames, done) {
    let i = 0;
    const step = () => {
      const frame = frames[i];
      render(frame.snap, frame.boom);
      i += 1;
      if (i < frames.length) {
        schedule(step, Math.max(75, 240 - i * 14));
      } else {
        schedule(done, 170);
      }
    };
    step();
  }

  function schedule(fn, ms) {
    timers.push(setTimeout(fn, ms));
  }

  function play(r, c) {
    if (locked || winner) return;
    const cell = board[r][c];
    if (cell.count > 0 && cell.owner !== current) return;

    locked = true;
    hasMoved[current] = true;

    replay(simulate(r, c, current), () => {
      const result = checkWinner();
      if (result) {
        winner = result;
        render(board, []);
        updateStatus(board);
        showOverlay(NAMES[result] + ' wins');
        locked = false;
        return;
      }
      current = current === 1 ? 2 : 1;
      locked = false;
      render(board, []);
    });
  }

  function checkWinner() {
    const counts = tally(board);
    if (hasMoved[1] && counts[1] === 0) return 2;
    if (hasMoved[2] && counts[2] === 0) return 1;
    return 0;
  }

  function showOverlay(text) {
    winnerEl.textContent = text;
    overlayEl.classList.remove('hidden');
  }

  function reset() {
    for (const id of timers) clearTimeout(id);
    timers = [];
    board = newBoard();
    current = 1;
    winner = 0;
    locked = false;
    hasMoved = { 1: false, 2: false };
    overlayEl.classList.add('hidden');
    render(board, []);
  }

  resetEl.addEventListener('click', reset);
  againEl.addEventListener('click', reset);

  build();
  reset();
})();
