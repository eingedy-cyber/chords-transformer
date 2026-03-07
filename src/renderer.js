'use strict';

function renderSong({ title, artist, originalKey, targetKey, isRTL, lines }) {
  const dir = isRTL ? 'rtl' : 'ltr';
  const langAttr = isRTL ? 'he' : 'en';

  const linesHtml = lines.map(line => renderLine(line, isRTL)).join('\n');

  const keyInfo = originalKey
    ? `<span class="key-info">Original key: <strong>${escHtml(originalKey)}</strong> → Transposed to: <strong>${escHtml(targetKey)}</strong></span>`
    : `<span class="key-info">Key: <strong>${escHtml(targetKey)}</strong></span>`;

  return `<!DOCTYPE html>
<html lang="${langAttr}" dir="${dir}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escHtml(title || 'Song')} — ${escHtml(targetKey)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Courier New', Courier, monospace;
      background: #fafaf8;
      color: #222;
      padding: 2rem;
      max-width: 960px;
      margin: 0 auto;
    }

    header {
      margin-bottom: 2rem;
      border-bottom: 2px solid #ddd;
      padding-bottom: 1rem;
    }

    header h1 {
      font-size: 1.8rem;
      margin-bottom: 0.3rem;
    }

    header .artist {
      font-size: 1.1rem;
      color: #555;
      margin-bottom: 0.5rem;
    }

    .key-info {
      display: inline-block;
      background: #e8f4fd;
      border: 1px solid #b3d7f0;
      border-radius: 4px;
      padding: 0.3rem 0.7rem;
      font-size: 0.95rem;
      font-family: sans-serif;
    }

    .song-body { line-height: 1; }

    .spacer { height: 1.4em; }

    /* ── LTR layout: flex segments ── */
    .line {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      margin-bottom: 0.1em;
    }

    .segment {
      display: inline-flex;
      flex-direction: column;
      align-items: flex-start;
      margin-right: 2px;
    }

    .chord {
      font-size: 1.15rem;
      font-weight: bold;
      color: #1a6fa8;
      min-height: 1.4em;
      white-space: nowrap;
      line-height: 1.3;
    }

    .chord.empty { visibility: hidden; }

    .lyric {
      font-size: 1rem;
      white-space: pre;
      line-height: 1.6;
    }

    /* ── RTL layout: two pre-formatted rows ──
       Both chord-row and lyric-row share dir="rtl" on the parent,
       so string position 0 maps to the same visual position (far right)
       in both rows — giving correct chord-above-lyric alignment. */
    .rtl-line {
      direction: rtl;
      margin-bottom: 0.1em;
      overflow-x: auto;
    }

    .chord-row {
      white-space: pre;
      font-size: 1.15rem;
      font-weight: bold;
      color: #1a6fa8;
      min-height: 1.4em;
      line-height: 1.3;
    }

    .lyric-row {
      white-space: pre;
      font-size: 1rem;
      line-height: 1.6;
    }

    /* lyric-only line inside RTL song */
    .rtl-lyric-only {
      direction: rtl;
      font-size: 1rem;
      line-height: 1.6;
      margin-bottom: 0.1em;
    }

    /* Print styles */
    @media print {
      body {
        background: white;
        padding: 1cm;
        max-width: 100%;
        font-size: 12pt;
      }

      header { margin-bottom: 1cm; }
      header h1 { font-size: 16pt; }
      header .artist { font-size: 12pt; }
      .key-info { font-size: 10pt; }

      .chord, .chord-row { font-size: 11pt; }
      .lyric, .lyric-row { font-size: 10pt; }

      .spacer { height: 0.6cm; }

      .line, .rtl-line { page-break-inside: avoid; }

      .song-body { orphans: 3; widows: 3; }
    }

    @media (max-width: 600px) {
      body { padding: 1rem; }
      header h1 { font-size: 1.3rem; }
      .chord, .chord-row { font-size: 1rem; }
      .lyric, .lyric-row { font-size: 0.9rem; }
    }
  </style>
</head>
<body>
  <header>
    <h1>${escHtml(title || 'Unknown Song')}</h1>
    ${artist ? `<div class="artist">${escHtml(artist)}</div>` : ''}
    <div>${keyInfo}</div>
  </header>

  <main class="song-body">
${linesHtml}
  </main>
</body>
</html>`;
}

function renderLine(line, isRTL) {
  // Empty / spacer line
  if (line.length === 1 && !line[0].chord && !line[0].lyric.trim()) {
    return '<div class="spacer"></div>';
  }

  const hasChords = line.some(s => s.chord);

  if (isRTL) {
    return renderRTLLine(line, hasChords);
  }

  // LTR: flex segment layout
  const segmentsHtml = line.map(seg => {
    const chordHtml = seg.chord
      ? `<div class="chord">${escHtml(seg.chord)}</div>`
      : `<div class="chord empty"></div>`;
    // For chord-only segments, add padding so chords don't run together
    const lyricText = seg.lyric || (seg.chord ? '    ' : '');
    const lyricHtml = `<div class="lyric">${escHtml(lyricText) || '&nbsp;'}</div>`;
    return `<span class="segment">${chordHtml}${lyricHtml}</span>`;
  }).join('');

  return `<div class="line">${segmentsHtml}</div>`;
}

/**
 * RTL two-row rendering.
 *
 * Build a chord string and a lyric string where each segment occupies
 * the same number of characters in both strings (padded with spaces).
 * With dir="rtl" on the parent, string position 0 = rightmost visual
 * position in BOTH rows — so chords align above their lyrics.
 */
function renderRTLLine(line, hasChords) {
  if (!hasChords) {
    // Lyric-only line (section label, etc.)
    const text = line.map(s => s.lyric).join('').trim();
    return `<div class="rtl-lyric-only">${escHtml(text)}</div>`;
  }

  let chordStr = '';
  let lyricStr = '';

  for (const seg of line) {
    const chord = seg.chord || '';
    const lyric = seg.lyric || '';
    // When no lyric, add 2 spaces after the chord so chords don't run together
    const minWidth = lyric.trim().length === 0 ? chord.length + 4 : chord.length;
    const width = Math.max(minWidth, lyric.length);
    chordStr += chord.padEnd(width);
    lyricStr += lyric.padEnd(width);
  }

  // Trim trailing spaces (cosmetic)
  chordStr = chordStr.trimEnd();
  lyricStr = lyricStr.trimEnd();

  return `<div class="rtl-line">
  <div class="chord-row">${escHtml(chordStr)}</div>
  <div class="lyric-row">${escHtml(lyricStr)}</div>
</div>`;
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = { renderSong };
