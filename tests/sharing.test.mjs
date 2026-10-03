import test from 'node:test';
import assert from 'node:assert/strict';
import { dailyConfig, createCustomConfig, newGame, targetsFor, scoreGuess, shareText, parseCode } from '../dist/engine.js';
import { whatsappURL, resultImage } from '../dist/sharing.js';

const BASE = 'https://example.github.io/woerdel/?old=1#discard';
const symbols = { correct: '🟩', present: '🟨', absent: '⬛️' };
const segmenter = new Intl.Segmenter('de', { granularity: 'grapheme' });
const blocks = text => [...text.matchAll(/```\n([^`]+?)\n```/g)].map(match => match[1].split('\n'));
const decoded = (game, config) => new URL(whatsappURL(game, config, BASE)).searchParams.get('text');
const configFor = extra => ({ ...dailyConfig(), daily: false, seed: 'SHARE-TEST', ...extra });

function complete(config, guesses = targetsFor(config)) {
  const game = newGame(config);
  game.guesses = [...guesses];
  game.startedAt = 1000;
  game.finishedAt = 3000;
  return game;
}

test('WhatsApp URL uses one encoded parameter and preserves text, lines and challenge link', () => {
  const config = configFor({ seed: 'GRÜẞE-42', length: 6 });
  const game = complete(config);
  const url = new URL(whatsappURL(game, config, BASE));
  assert.equal(url.origin, 'https://wa.me');
  assert.equal(url.pathname, '/');
  assert.deepEqual([...url.searchParams.keys()], ['text']);
  const text = url.searchParams.get('text');
  const unformatted = text.replace(/^```\n|\n```$/gm, '').replace(/⬛\uFE0F/gu, '⬛');
  assert.equal(unformatted, shareText(game, config, BASE));
  assert.ok(url.href.includes('%0A'));
  assert.ok(!text.includes('\\n'));
  assert.ok(text.includes('GRÜẞE-42'));
  const link = new URL(text.split('\n').at(-1));
  assert.equal(link.pathname, '/woerdel/');
  assert.equal(link.search, '');
  assert.deepEqual(parseCode(new URLSearchParams(link.hash.slice(1)).get('spiel')), config);
});

test('every 4–8 tile row remains contiguous and has exactly the configured grapheme count', () => {
  for (const mode of ['classic', 'duet', 'sprint']) for (let length = 4; length <= 8; length++) {
    const config = configFor({ mode, length, attempts: 15 });
    const game = complete(config);
    const text = decoded(game, config);
    const grids = blocks(text);
    assert.equal(grids.length, mode === 'duet' ? 2 : 1);
    for (const row of grids.flat()) {
      const graphemes = [...segmenter.segment(row)].map(s => s.segment);
      assert.equal(graphemes.length, length);
      assert.ok(graphemes.every(g => Object.values(symbols).includes(g)));
      assert.ok(!/\s/u.test(row));
    }
    for (const target of targetsFor(config)) assert.ok(!text.includes(target));
  }
});

test('duplicate letters preserve exact feedback and use emoji presentation for absent tiles', () => {
  const config = createCustomConfig({ words: ['BALL'], attempts: 6 });
  const game = complete(config, ['LALL', 'AAAA', 'BALL']);
  const [grid] = blocks(decoded(game, config));
  assert.deepEqual(grid, ['⬛️🟩🟩🟩', '⬛️🟩⬛️⬛️', '🟩🟩🟩🟩']);
  assert.deepEqual(grid, game.guesses.map(guess => scoreGuess(guess, 'BALL').map(state => symbols[state]).join('')));
  for (const row of grid) assert.ok(!/⬛(?!\uFE0F)/u.test(row));
});

test('duet blocks stop independently when each board is solved', () => {
  const config = createCustomConfig({ words: ['BALL', 'FALL'], mode: 'duet', attempts: 15 });
  const game = complete(config, ['LALL', 'BALL', 'FALL']);
  const grids = blocks(decoded(game, config));
  assert.deepEqual(grids.map(grid => grid.length), [2, 3]);
  assert.equal(grids[0].at(-1), '🟩'.repeat(4));
  assert.equal(grids[1].at(-1), '🟩'.repeat(4));
  assert.equal(grids[1][1], '⬛️🟩🟩🟩');
  const text = decoded(game, config);
  for (const word of game.guesses) assert.ok(!text.includes(word));
  assert.ok(text.includes('Eigene Wörter'));
});

test('a maximum-size unsolved board preserves all fifteen eight-tile rows', () => {
  const config = createCustomConfig({ words: ['HANDTUCH'], attempts: 15 });
  // Formatting consumes engine-validated game state; the repeated fixture isolates
  // the largest supported grid without coupling this test to dictionary entries.
  const game = complete(config, Array(15).fill('AAAAAAAA'));
  const [grid] = blocks(decoded(game, config));
  assert.equal(grid.length, 15);
  assert.ok(grid.every(row => [...segmenter.segment(row)].length === 8));
  assert.ok(decoded(game, config).includes('X/15'));
});

test('zero-guess expiry produces no empty code block', () => {
  const config = configFor({ mode: 'sprint' });
  const game = complete(config, []);
  game.reason = 'time';
  assert.equal(blocks(decoded(game, config)).length, 0);
  assert.ok(!decoded(game, config).includes('```'));
});

test('result-image API reports a clear error outside the browser', async () => {
  const config = configFor({});
  await assert.rejects(resultImage(complete(config), config, BASE), /Browser/);
});

// Record renderer output without pretending to rasterize fonts or PNG data.
// The conservative mock metrics exercise fitting; real-font appearance is checked
// in the browser. The encoder's fixture blob is only used to verify the API path.
function recordCanvas(t, { failFonts = false, failEncoding = false, missingContext = false } = {}) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const records = { shapes: [], text: [], fonts: [], encodings: [] };
  let points = [];
  const size = font => Number(/([\d.]+)px/u.exec(font)?.[1] ?? 16);
  const measure = (value, font) => [...String(value)].reduce((sum, char) => sum + (/[MWÖ]/u.test(char) ? 0.84 : /[il.,: ]/u.test(char) ? 0.3 : 0.58) * size(font), 0);
  const context = {
    font: '16px sans-serif', textAlign: 'left', fillStyle: '',
    beginPath() { points = []; },
    moveTo(x, y) { points.push([x, y]); },
    arcTo(x1, y1, x2, y2) { points.push([x1, y1], [x2, y2]); },
    closePath() {},
    fill() {
      const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
      records.shapes.push({ x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys), color: this.fillStyle });
    },
    stroke() {},
    fillRect(x, y, width, height) { records.shapes.push({ x, y, width, height, color: this.fillStyle }); },
    createRadialGradient() { return { addColorStop() {} }; },
    measureText(value) { return { width: measure(value, this.font) }; },
    fillText(value, x, y) {
      const width = measure(value, this.font), fontSize = size(this.font);
      const left = this.textAlign === 'right' ? x - width : this.textAlign === 'center' ? x - width / 2 : x;
      records.text.push({ value: String(value), x, y, left, right: left + width, top: y - fontSize, bottom: y + fontSize * 0.22, color: this.fillStyle });
    },
  };
  const encoded = new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], { type: 'image/png' });
  const canvas = {
    width: 0, height: 0,
    getContext(type) { assert.equal(type, '2d'); return missingContext ? null : context; },
    toBlob(callback, type) { records.encodings.push(type); queueMicrotask(() => callback(failEncoding ? null : encoded)); },
  };
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    fonts: {
      load(font) { records.fonts.push(font); return failFonts ? Promise.reject(new Error('font unavailable')) : Promise.resolve([]); },
      ready: Promise.resolve(),
    },
    createElement(tag) { assert.equal(tag, 'canvas'); return canvas; },
  } });
  t.after(() => original ? Object.defineProperty(globalThis, 'document', original) : delete globalThis.document);
  return { canvas, records, encoded, tiles: () => records.shapes.filter(shape => shape.width === shape.height && shape.width >= 50) };
}

function assertDrawingInside(canvas, records) {
  for (const shape of records.shapes) {
    assert.ok(shape.x >= 0 && shape.y >= 0, 'shape starts inside canvas');
    assert.ok(shape.x + shape.width <= canvas.width, 'shape stays inside right edge');
    assert.ok(shape.y + shape.height <= canvas.height, 'shape stays inside bottom edge');
  }
  for (const text of records.text) {
    assert.ok(text.left >= 0 && text.right <= canvas.width, `text fits horizontally: ${text.value}`);
    assert.ok(text.top >= 0 && text.bottom <= canvas.height, `text fits vertically: ${text.value}`);
  }
}

test('PNG renderer requests PNG encoding and gives every tile room in a maximum 15×8 duet', async t => {
  const capture = recordCanvas(t);
  const config = createCustomConfig({ words: ['HANDTUCH', 'GESCHENK'], mode: 'duet', attempts: 15 });
  const guesses = ['BADEHOSE', 'BACKOFEN', 'BAUMHAUS', 'BÜCHEREI', 'COMPUTER', 'DIENSTAG', 'EIDECHSE', 'EINDRUCK', 'EINGRIFF', 'ERDBEERE', 'FAHRBAHN', 'FAHRGAST', 'FLUGZEUG', 'HALSTUCH', 'HAUSHALT'];
  const game = complete(config, guesses);
  const secret = 'do-not-draw-this-secret';
  const longBase = `https://example.github.io/${'long-project-path-'.repeat(12)}/?private=${secret}#${secret}`;
  const blob = await resultImage(game, config, longBase);
  assert.equal(blob, capture.encoded);
  assert.equal(blob.type, 'image/png');
  assert.deepEqual(capture.records.encodings, ['image/png']);
  assert.equal(capture.canvas.width, 1080);
  assert.ok(capture.canvas.height > 3000, 'height grows to hold both long boards');
  assert.equal(capture.tiles().length, 2 * 15 * 8);
  assertDrawingInside(capture.canvas, capture.records);
  const drawn = capture.records.text.map(text => text.value);
  for (const word of [...guesses, ...config.customTargets, secret]) assert.ok(!drawn.some(text => text.includes(word)), `does not draw ${word}`);
  assert.ok(drawn.includes('Eigene Wörter'));
  assert.ok(drawn.includes('WORT 01'));
  assert.ok(drawn.includes('WORT 02'));
  assert.ok(drawn.includes('X/15'));
  assert.ok(drawn.some(text => text.startsWith('https://example.github.io/') && text.endsWith('…')), 'long base URL is fitted');
  const score = capture.records.text.find(text => text.value === 'X/15');
  const title = capture.records.text.find(text => text.value === 'Gut geknobelt.');
  assert.ok(title.right < score.left, 'title and score do not collide');
  const rows = new Map();
  for (const tile of capture.tiles()) {
    const row = rows.get(tile.y) ?? [];
    row.push(tile);
    rows.set(tile.y, row);
  }
  assert.equal(rows.size, 30);
  for (const row of rows.values()) {
    assert.equal(row.length, 8);
    row.sort((a, b) => a.x - b.x);
    for (let i = 1; i < row.length; i++) assert.ok(row[i - 1].x + row[i - 1].width < row[i].x, 'square tiles do not overlap');
  }
});

test('PNG tile colors retain duplicate-letter feedback without drawing any letters', async t => {
  const capture = recordCanvas(t);
  const config = createCustomConfig({ words: ['BALLET'], attempts: 6, seed: 'BALLET-ALLEEN' });
  const game = complete(config, ['ALLEEN', 'BALLET']);
  await resultImage(game, config, BASE);
  const green = '#158E45', yellow = '#FCDD09', absent = '#354238';
  assert.deepEqual(capture.tiles().map(tile => tile.color), [yellow, yellow, green, absent, green, absent, ...Array(6).fill(green)]);
  const drawn = capture.records.text.map(text => text.value);
  assert.ok(drawn.includes('Eigenes Wort'));
  assert.ok(drawn.includes('2/6'));
  assert.ok(drawn.includes('Gelöst in 2 Versuchen'));
  assert.ok(!drawn.some(text => /BALLET|ALLEEN|#discard|old=1/u.test(text)));
  assertDrawingInside(capture.canvas, capture.records);
});

test('PNG duet renders only each board’s submitted rows through its solution', async t => {
  const capture = recordCanvas(t);
  const config = createCustomConfig({ words: ['BALL', 'FALL'], mode: 'duet', attempts: 15 });
  await resultImage(complete(config, ['LALL', 'BALL', 'FALL']), config, BASE);
  assert.equal(capture.tiles().length, (2 + 3) * 4);
  const boardTitles = capture.records.text.filter(text => /^WORT 0[12]$/u.test(text.value));
  assert.equal(boardTitles.length, 2);
  assert.equal(capture.tiles().filter(tile => tile.y < boardTitles[1].y).length, 2 * 4);
  assert.equal(capture.tiles().filter(tile => tile.y > boardTitles[1].y).length, 3 * 4);
  const drawn = capture.records.text.map(text => text.value);
  assert.ok(drawn.includes('Gelöst in 2 Versuchen'));
  assert.ok(drawn.includes('Gelöst in 3 Versuchen'));
  assert.ok(drawn.includes('3/15'));
  assert.ok(!drawn.some(text => /BALL|FALL|LALL/u.test(text)));
});

test('PNG renderer tolerates missing fonts but reports failed encoding', async t => {
  const capture = recordCanvas(t, { failFonts: true, failEncoding: true });
  const config = configFor({ length: 4 });
  await assert.rejects(resultImage(complete(config), config, BASE), /PNG gespeichert/u);
  assert.ok(capture.tiles().length > 0, 'font fallback still draws the board');
  assert.deepEqual(capture.records.encodings, ['image/png']);
});

test('PNG renderer reports unavailable canvas contexts before encoding', async t => {
  const capture = recordCanvas(t, { missingContext: true });
  const config = configFor({ length: 4 });
  await assert.rejects(resultImage(complete(config), config, BASE), /nicht erstellt/u);
  assert.deepEqual(capture.records.encodings, []);
});
