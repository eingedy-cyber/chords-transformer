'use strict';

function renderSong({ title, artist, originalKey, targetKey, isRTL, lines }) {
  const dir = isRTL ? 'rtl' : 'ltr';
  const langAttr = isRTL ? 'he' : 'en';

  const linesHtml = lines.map((line, i) => {
    if (line.isTabBlock) return renderTabBlock(line);

    const isEmptyLine = line.length === 1 && !line[0].chord && !line[0].lyric.trim();
    const hasLyric = !isEmptyLine && line.some(s => s.lyric && s.lyric.trim());
    const isSectionLabel = line.length === 1 && !line[0].chord && isSectionLabelText(line[0].lyric);
    const prevLine = i > 0 ? lines[i - 1] : null;
    const prevIsTabBlock = prevLine && prevLine.isTabBlock;
    const prevIsEmpty = !prevIsTabBlock && prevLine && prevLine.length === 1 && !prevLine[0].chord && !prevLine[0].lyric.trim();
    const prevIsSectionLabel = !prevIsTabBlock && prevLine && prevLine.length === 1 && !prevLine[0].chord && isSectionLabelText(prevLine[0].lyric);

    if (isSectionLabel) {
      const spacer = (prevLine && !prevIsEmpty) ? '<div class="spacer"></div>\n' : '';
      return spacer + renderLine(line, isRTL);
    }

    if (prevIsSectionLabel) {
      return renderLine(line, isRTL);
    }

    const prevHasLyric = !prevIsTabBlock && prevLine && !prevIsEmpty && prevLine.some(s => s.lyric && s.lyric.trim());
    const needsSpacer = prevLine && !prevIsEmpty && !prevIsTabBlock && !isEmptyLine && hasLyric !== prevHasLyric;
    return (needsSpacer ? '<div class="spacer"></div>\n' : '') + renderLine(line, isRTL);
  }).join('\n');

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

    header h1 { font-size: 1.8rem; margin-bottom: 0.3rem; }
    header .artist { font-size: 1.1rem; color: #555; margin-bottom: 0.5rem; }

    .key-info {
      display: inline-block;
      background: #e8f4fd;
      border: 1px solid #b3d7f0;
      border-radius: 4px;
      padding: 0.3rem 0.7rem;
      font-size: 0.95rem;
      font-family: sans-serif;
    }

    .song-body { line-height: 1; overflow-x: auto; }

    .spacer { height: 1.4em; }

    /* ── LTR chord+lyric lines ── pre-formatted two-row approach */
    .ltr-line {
      margin-bottom: 0.15em;
      overflow-x: auto;
    }

    .chord-row {
      display: block;
      font-size: 1rem;
      font-weight: bold;
      min-height: 1.6em;
      line-height: 1.4;
      white-space: pre;
      margin-bottom: 2px;
    }

    .chord-badge {
      display: inline;
      border-radius: 4px;
      padding: 0px 3px;
      margin: 0px -3px;
      color: #2566F1;
      background: #DFE8FE;
      font-weight: bold;
    }

    .lyric-row {
      display: block;
      font-size: 1rem;
      line-height: 1.6;
      white-space: pre;
    }

    /* ── RTL chord+lyric lines ──
       The lyric row renders Hebrew text normally with direction:rtl.
       The chord row uses position:relative so each chord badge can be
       placed with position:absolute; right:Xch matching the cumulative
       lyric character offset — segment[0] is at the visual right edge. */
    .rtl-line {
      direction: rtl;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      margin-bottom: 0.15em;
    }

    .rtl-chord-row {
      position: relative;
      min-height: 1.6em;
      font-size: 1rem;
      font-weight: bold;
      line-height: 1.4;
      margin-bottom: 2px;
    }

    .rtl-chord-row .chord-badge {
      position: absolute;
      top: 0;
    }

    .rtl-lyric-row {
      white-space: pre;
      font-size: 1rem;
      line-height: 1.6;
    }

    .ltr-lyric-only {
      white-space: pre;
      font-size: 1rem;
      line-height: 1.6;
      margin-bottom: 0.15em;
    }

    .rtl-lyric-only {
      direction: rtl;
      font-size: 1rem;
      line-height: 1.6;
      margin-bottom: 0.15em;
    }

    /* ── Tab blocks ── always LTR regardless of song direction */
    .tab-block {
      font-family: 'Courier New', Courier, monospace;
      font-size: 0.92rem;
      margin-bottom: 1em;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      direction: ltr;
      text-align: left;
    }

    .tab-chord-row {
      white-space: pre;
      font-size: 1rem;
      font-weight: bold;
      min-height: 1.6em;
      line-height: 1.4;
    }

    .tab-string {
      white-space: pre;
      color: #333;
      line-height: 1.5;
    }

    @media print {
      body { background: white; padding: 1cm; max-width: 100%; font-size: 12pt; }
      header { margin-bottom: 1cm; }
      header h1 { font-size: 16pt; }
      header .artist { font-size: 12pt; }
      .key-info { font-size: 10pt; }
      .chord-row, .rtl-chord-row, .tab-chord-row { font-size: 9pt; }
      .lyric-row, .rtl-lyric-row, .ltr-lyric-only, .rtl-lyric-only { font-size: 10pt; }
      .spacer { height: 0.6cm; }
      .ltr-line, .rtl-line { page-break-inside: avoid; }
      .song-body { orphans: 3; widows: 3; }
    }

    @media (max-width: 600px) {
      body { padding: 0.75rem; }
      header h1 { font-size: 1.3rem; }
      .chord-row, .rtl-chord-row, .tab-chord-row { font-size: 0.8rem; }
      .lyric-row, .rtl-lyric-row, .ltr-lyric-only, .rtl-lyric-only { font-size: 0.75rem; }
      .ltr-line, .rtl-line { overflow-x: auto; -webkit-overflow-scrolling: touch; }
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

function isSectionLabelText(text) {
  if (!text) return false;
  const t = text.trim();
  return t.length < 25 && t.endsWith(':');
}

/**
 * Normalize all strings in a tab block to the same length by inserting
 * dashes before the trailing | (or appending dashes if no trailing |).
 * Transposing can change individual string lengths when fret digit counts
 * change (e.g. 9→10), so we re-equalize here.
 */
function normalizeTabStrings(strings) {
  if (strings.length === 0) return strings;
  const maxLen = Math.max(...strings.map(s => s.length));
  return strings.map(s => {
    const needed = maxLen - s.length;
    if (needed <= 0) return s;
    if (s.endsWith('|')) {
      return s.slice(0, -1) + '-'.repeat(needed) + '|';
    }
    return s + '-'.repeat(needed);
  });
}

function renderTabBlock(block) {
  let html = '<div class="tab-block">';

  if (block.chordsAbove.length > 0) {
    // Build a character-grid string with chords at their scraped positions,
    // then wrap each chord token in a badge span.
    const tabWidth = block.strings.length > 0 ? block.strings[0].length : 50;
    const arr = new Array(Math.max(tabWidth + 10, 60)).fill(' ');
    for (const { chord, pos } of block.chordsAbove) {
      for (let j = 0; j < chord.length && pos + j < arr.length; j++) {
        arr[pos + j] = chord[j];
      }
    }
    html += `<div class="tab-chord-row">${badgeHtml(arr.join('').trimEnd())}</div>`;
  }

  const strings = normalizeTabStrings(block.strings);
  for (const str of strings) {
    html += `<div class="tab-string">${escHtml(str)}</div>`;
  }

  html += '</div>';
  return html;
}

function renderLine(line, isRTL) {
  if (line.length === 1 && !line[0].chord && !line[0].lyric.trim()) {
    return '<div class="spacer"></div>';
  }

  const hasChords = line.some(s => s.chord);

  if (!hasChords) {
    const text = line.map(s => s.lyric).join('');
    const cls = isRTL ? 'rtl-lyric-only' : 'ltr-lyric-only';
    return `<div class="${cls}">${escHtml(text)}</div>`;
  }

  if (isRTL) {
    // RTL songs: lyric row uses direction:rtl (natural Hebrew flow).
    // Chord badges are positioned absolutely at `right:Xch` where X is the
    // cumulative lyric character offset — segment[0] (offset 0) lands at
    // the visual right edge, matching the first Hebrew character.
    let lyricStr = '';
    const badges = [];
    let cumPos = 0;
    for (const seg of line) {
      const chord = seg.chord || '';
      const lyric = seg.lyric || '';
      const width = !lyric.trim() && chord
        ? Math.max(chord.length + 2, lyric.length)
        : Math.max(chord.length, lyric.length);
      if (chord) {
        badges.push(`<span class="chord-badge" style="position:absolute;right:${cumPos}ch;top:0">${escHtml(chord)}</span>`);
      }
      lyricStr += lyric.padEnd(width);
      cumPos += width;
    }
    const chordRow = `<div class="rtl-chord-row" style="width:${cumPos}ch">${badges.join('')}</div>`;
    return `<div class="rtl-line">${chordRow}<div class="rtl-lyric-row">${escHtml(lyricStr)}</div></div>`;
  }

  // LTR songs: pre-formatted two-row approach.
  let chordStr = '';
  let lyricStr = '';
  for (const seg of line) {
    const chord = seg.chord || '';
    const lyric = seg.lyric || '';
    // Chord-only segments get extra padding so adjacent chords stay separated.
    const width = !lyric.trim() && chord
      ? Math.max(chord.length + 2, lyric.length)
      : Math.max(chord.length, lyric.length);
    chordStr += chord.padEnd(width);
    lyricStr += lyric.padEnd(width);
  }

  return `<div class="ltr-line"><div class="chord-row">${badgeHtml(chordStr)}</div><div class="lyric-row">${escHtml(lyricStr)}</div></div>`;
}

/**
 * Wrap each non-space run in the pre-formatted chord string with a badge
 * span. Uses display:inline so character widths are not affected and the
 * white-space:pre grid stays intact.
 */
function badgeHtml(chordStr) {
  return chordStr.replace(/([^ ]+)/g, m => `<span class="chord-badge">${escHtml(m)}</span>`);
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
