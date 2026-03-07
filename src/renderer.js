'use strict';

function renderSong({ title, artist, originalKey, targetKey, isRTL, lines }) {
  const dir = isRTL ? 'rtl' : 'ltr';
  const langAttr = isRTL ? 'he' : 'en';

  const linesHtml = lines.map(line => {
    if (line.length === 1 && !line[0].chord && !line[0].lyric.trim()) {
      return '<div class="spacer"></div>';
    }

    const segmentsHtml = line.map(seg => {
      const chordHtml = seg.chord
        ? `<div class="chord">${escHtml(seg.chord)}</div>`
        : `<div class="chord empty"></div>`;
      const lyricHtml = `<div class="lyric">${escHtml(seg.lyric) || '&nbsp;'}</div>`;
      return `<span class="segment">${chordHtml}${lyricHtml}</span>`;
    }).join('');

    return `<div class="line">${segmentsHtml}</div>`;
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

    .song-body {
      line-height: 1;
    }

    .spacer {
      height: 1.4em;
    }

    .line {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      margin-bottom: 0.1em;
    }

    /* RTL: flex-direction:row already flows right-to-left in a dir=rtl container.
       No row-reverse needed — that would double-flip back to LTR. */

    .segment {
      display: inline-flex;
      flex-direction: column;
      align-items: flex-start;
      margin-right: 2px;
    }

    /* In RTL column-flex, flex-start = right (inline-start), which is correct:
       chord aligns above the start (right edge) of the Hebrew lyric. */
    [dir="rtl"] .segment {
      margin-right: 0;
      margin-left: 2px;
    }

    .chord {
      font-size: 1.15rem;
      font-weight: bold;
      color: #1a6fa8;
      min-height: 1.4em;
      white-space: nowrap;
      line-height: 1.3;
    }

    .chord.empty {
      visibility: hidden;
    }

    .lyric {
      font-size: 1rem;
      white-space: pre;
      line-height: 1.6;
    }

    /* Print styles */
    @media print {
      body {
        background: white;
        padding: 1cm;
        max-width: 100%;
        font-size: 12pt;
      }

      header {
        margin-bottom: 1cm;
      }

      header h1 { font-size: 16pt; }
      header .artist { font-size: 12pt; }
      .key-info { font-size: 10pt; }

      .chord { font-size: 11pt; }
      .lyric { font-size: 10pt; }

      .spacer { height: 0.6cm; }

      .line { page-break-inside: avoid; }

      /* Ensure good page breaks */
      .song-body { orphans: 3; widows: 3; }
    }

    @media (max-width: 600px) {
      body { padding: 1rem; }
      header h1 { font-size: 1.3rem; }
      .chord { font-size: 1rem; }
      .lyric { font-size: 0.9rem; }
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

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = { renderSong };
