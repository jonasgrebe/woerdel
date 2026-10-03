import { MODES, CUSTOM_VERSION, normalizeWord, targetsFor, scoreGuess, solvedAt, outcome, shareText } from './engine.js';

/**
 * Build a WhatsApp click-to-chat URL without opening or sending anything.
 * Text comes from the engine; only emoji-only grid blocks get monospace markup.
 * Keep ordinary shareText for the clipboard/native text-share path.
 */
export function whatsappURL(game, config, base) {
  const text = shareText(game, config, base).replace(/\r\n?/g, '\n');
  const gridRow = /^(?:🟩\uFE0F?|🟨\uFE0F?|⬛\uFE0F?)+$/u;
  const output = [];
  let inGrid = false;
  for (const line of text.split('\n')) {
    const isGrid = gridRow.test(line);
    if (isGrid && !inGrid) output.push('```');
    if (!isGrid && inGrid) output.push('```');
    output.push(isGrid ? line.replace(/⬛\uFE0F?/gu, '⬛\uFE0F') : line);
    inGrid = isGrid;
  }
  if (inGrid) output.push('```');
  return 'https://wa.me/?text=' + encodeURIComponent(output.join('\n'));
}

const COLORS = Object.freeze({
  background: '#101E17', surface: '#16291E', border: '#3B5240',
  text: '#F6F4E6', muted: '#AFBEA8', correct: '#158E45', accent: '#FCDD09',
  present: '#FCDD09', absent: '#354238', ink: '#172315',
});
const WIDTH = 1080, MARGIN = 72, TILE = 100, GAP = 12;
const DISPLAY_FONT = '"Space Grotesk", Arial, sans-serif';
const BODY_FONT = '"DM Sans", Arial, sans-serif';

function roundedRect(context, x, y, width, height, radius, color, stroke) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
  context.fillStyle = color;
  context.fill();
  if (stroke) {
    context.strokeStyle = stroke;
    context.lineWidth = 2;
    context.stroke();
  }
}

function drawText(context, text, x, y, { size = 28, weight = 400, color = COLORS.text, font = BODY_FONT, align = 'left', width } = {}) {
  context.font = `${weight} ${size}px ${font}`;
  context.fillStyle = color;
  context.textAlign = align;
  context.textBaseline = 'alphabetic';
  let fitted = String(text);
  // Avoid distorted type and prevent long repository paths/seeds crossing margins.
  if (width && context.measureText(fitted).width > width) {
    while (fitted.length && context.measureText(fitted + '…').width > width) fitted = fitted.slice(0, -1);
    fitted += '…';
  }
  context.fillText(fitted, x, y);
}

function safeEdition(game, config, targets) {
  if (config.version === CUSTOM_VERSION) return targets.length === 2 ? 'Eigene Wörter' : 'Eigenes Wort';
  if (config.daily) {
    const date = new Date(config.seed + 'T12:00:00Z');
    return 'Tageswort · ' + new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
  }
  const seed = normalizeWord(config.seed);
  // An author can name a seed after a word. Do not accidentally print a guess
  // or the solution as the exported card's edition label.
  return [...targets, ...game.guesses].some(word => seed.includes(normalizeWord(word)))
    ? 'Deine Herausforderung'
    : '#' + config.seed;
}

function imageModel(game, config, base) {
  const targets = targetsFor(config), solved = solvedAt(game, targets), state = outcome(game, config);
  const boards = targets.map((target, index) => {
    const guesses = game.guesses.slice(0, solved[index] < 0 ? undefined : solved[index] + 1);
    return { rows: guesses.map(guess => scoreGuess(guess, target)), solved: solved[index] };
  });
  const url = new URL(base);
  return {
    boards, state, edition: safeEdition(game, config, targets),
    site: url.origin + url.pathname,
    score: state === 'won' ? `${game.guesses.length}/${config.attempts}` : state === 'playing' ? `${game.guesses.length}/${config.attempts}` : `X/${config.attempts}`,
    title: state === 'won' ? (boards.length === 2 ? 'Doppelt gut.' : 'Wort gefunden.') : state === 'playing' ? 'Noch im Spiel.' : 'Gut geknobelt.',
  };
}

/**
 * Render a spoiler-free 1080px-wide result card and return an image/png Blob.
 * Browser-only; requires a DOM canvas. No HTML, answer letters, guessed words,
 * URL query, or challenge hash are drawn. Boards are stacked and each stops at
 * its own solved row. The caller supplies the clickable link as separate text,
 * then chooses native file sharing or a download fallback. No external action
 * occurs here. Canvas/PNG errors reject so the UI can offer a retry; missing fonts use a fallback.
 */
export async function resultImage(game, config, base) {
  if (typeof document === 'undefined') throw new Error('Die Ergebnisgrafik benötigt einen Browser.');
  const model = imageModel(game, config, base);
  if (document.fonts) {
    try {
      await Promise.all([
        document.fonts.load(`600 72px ${DISPLAY_FONT}`),
        document.fonts.load(`500 28px ${BODY_FONT}`),
      ]);
      await document.fonts.ready;
    } catch {
      // Browser fallbacks remain readable if a local font cannot be loaded.
    }
  }
  const boardHeights = model.boards.map(board => 116 + Math.max(1, board.rows.length) * TILE + Math.max(0, board.rows.length - 1) * GAP);
  const boardTop = 370, boardGap = 34;
  const boardEnd = boardTop + boardHeights.reduce((a, b) => a + b, 0) + (boardHeights.length - 1) * boardGap;
  const height = boardEnd + 278;
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Die Ergebnisgrafik konnte nicht erstellt werden.');

  context.fillStyle = COLORS.background;
  context.fillRect(0, 0, WIDTH, height);
  const wash = context.createRadialGradient(930, 30, 10, 930, 30, 520);
  wash.addColorStop(0, '#FCDD0912');
  wash.addColorStop(1, '#FCDD0900');
  context.fillStyle = wash;
  context.fillRect(0, 0, WIDTH, 450);

  // A geometric brand mark drawn as vectors; no remote resources needed.
  roundedRect(context, MARGIN, 61, 26, 26, 5, COLORS.correct);
  roundedRect(context, MARGIN + 33, 61, 26, 26, 5, COLORS.present);
  roundedRect(context, MARGIN, 94, 26, 26, 5, COLORS.absent);
  roundedRect(context, MARGIN + 33, 94, 26, 26, 5, COLORS.correct);
  drawText(context, 'WÖRDEL', MARGIN + 78, 111, { size: 58, weight: 700, font: DISPLAY_FONT });
  drawText(context, 'DEIN ERGEBNIS', WIDTH - MARGIN, 101, { size: 18, weight: 600, color: COLORS.muted, font: DISPLAY_FONT, align: 'right' });
  context.fillStyle = COLORS.border;
  context.fillRect(MARGIN, 151, WIDTH - MARGIN * 2, 1);

  drawText(context, model.edition, MARGIN, 201, { size: 23, weight: 500, color: COLORS.accent, width: WIDTH - MARGIN * 2 });
  drawText(context, model.title, MARGIN, 278, { size: 62, weight: 500, font: DISPLAY_FONT, width: 716 });
  drawText(context, model.score, WIDTH - MARGIN, 278, { size: 68, weight: 600, font: DISPLAY_FONT, color: COLORS.accent, align: 'right' });
  const rules = `${MODES[config.mode]} · ${config.length} Buchstaben${config.hard ? ' · Knobelmodus' : ''}`;
  drawText(context, rules, MARGIN, 325, { size: 26, color: COLORS.muted, width: WIDTH - MARGIN * 2 });

  let y = boardTop;
  for (let n = 0; n < model.boards.length; n++) {
    const board = model.boards[n], boardHeight = boardHeights[n];
    roundedRect(context, MARGIN, y, WIDTH - MARGIN * 2, boardHeight, 22, COLORS.surface, COLORS.border);
    drawText(context, model.boards.length > 1 ? `WORT ${String(n + 1).padStart(2, '0')}` : 'DEIN RASTER', MARGIN + 28, y + 42, { size: 18, weight: 600, font: DISPLAY_FONT, color: COLORS.muted });
    const solvedText = board.solved >= 0 ? `Gelöst in ${board.solved + 1} ${board.solved === 0 ? 'Versuch' : 'Versuchen'}` : model.state === 'playing' ? 'Noch offen' : 'Nicht gelöst';
    drawText(context, solvedText, WIDTH - MARGIN - 28, y + 42, { size: 20, weight: 500, color: board.solved >= 0 ? COLORS.accent : COLORS.muted, align: 'right' });
    const gridWidth = config.length * TILE + (config.length - 1) * GAP;
    const gridX = (WIDTH - gridWidth) / 2;
    if (board.rows.length) {
      board.rows.forEach((row, r) => row.forEach((status, c) => {
        roundedRect(context, gridX + c * (TILE + GAP), y + 72 + r * (TILE + GAP), TILE, TILE, 10, COLORS[status]);
      }));
    } else {
      drawText(context, 'Noch kein Versuch abgegeben.', WIDTH / 2, y + 133, { size: 25, color: COLORS.muted, align: 'center' });
    }
    y += boardHeight + boardGap;
  }

  const legend = [{ x: MARGIN + 32, state: 'correct', label: 'Richtiger Platz' }, { x: MARGIN + 354, state: 'present', label: 'Im Wort' }, { x: MARGIN + 605, state: 'absent', label: 'Nicht im Wort' }];
  legend.forEach(item => {
    roundedRect(context, item.x, boardEnd + 38, 20, 20, 4, COLORS[item.state]);
    drawText(context, item.label, item.x + 32, boardEnd + 55, { size: 21, color: COLORS.muted });
  });
  context.fillStyle = COLORS.border;
  context.fillRect(MARGIN, boardEnd + 98, WIDTH - MARGIN * 2, 1);
  drawText(context, model.boards.length > 1 ? 'Und du? Zwei Wörter warten auf dich.' : 'Und du? Das gleiche Wort wartet.', MARGIN, boardEnd + 151, { size: 29, weight: 500, font: DISPLAY_FONT, width: WIDTH - MARGIN * 2 });
  drawText(context, model.site, MARGIN, boardEnd + 196, { size: 22, color: COLORS.muted, width: WIDTH - MARGIN * 2 - 50 });
  drawText(context, '↗', WIDTH - MARGIN, boardEnd + 194, { size: 34, color: COLORS.accent, align: 'right' });

  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Die Ergebnisgrafik konnte nicht als PNG gespeichert werden.')), 'image/png');
  });
}
