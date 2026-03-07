'use strict';

const axios = require('axios');
const cheerio = require('cheerio');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'he,en;q=0.9',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

function detectHebrew(text) {
  return /[\u0590-\u05FF]/.test(text);
}

async function scrapeSong(url) {
  const response = await axios.get(url, { headers: HEADERS, timeout: 15000 });
  const $ = cheerio.load(response.data);

  const title = extractTitle($);
  const artist = extractArtist($);
  const { lines, originalKey } = extractSongContent($);

  const allText = lines.flat().map(s => s.lyric).join('');
  const isRTL = detectHebrew(allText);

  return { title, artist, originalKey, isRTL, lines };
}

function extractTitle($) {
  return (
    $('h1.song-title, .song_header h1, [itemprop="name"]').first().text().trim() ||
    $('title').text().replace(/\s*[-|].*$/, '').trim() ||
    'Unknown Song'
  );
}

function extractArtist($) {
  return $('[itemprop="byArtist"], .artist-name, .artist_name').first().text().trim();
}

function extractSongContent($) {
  const container = $('#songContentTPL');
  if (!container.length) {
    throw new Error('Could not find song content on page. Make sure this is a tab4u.com song URL.');
  }

  const rows = container.find('tr');
  if (rows.length === 0) {
    return { lines: parsePlainText(container.text()), originalKey: null };
  }

  return parseTab4uTable($, rows);
}

/**
 * Tab4u table structure:
 *   <tr><td class="chords"><span class="c_C">Am</span> ... </td></tr>
 *   <tr><td class="song">lyric text</td></tr>
 *
 * Chords come BEFORE their corresponding lyric row.
 * Character positions in the chord td align with character positions in the song td.
 */
function parseTab4uTable($, rows) {
  const rowData = [];

  rows.each((_, tr) => {
    const td = $(tr).find('td').first();
    const cls = td.attr('class') || '';
    if (cls === 'chords' || cls === 'chords_en') {
      rowData.push({ type: 'chords', cls, chords: extractChordSpans($, td) });
    } else if (cls === 'song') {
      rowData.push({ type: 'song', text: td.text() });
    }
  });

  const lines = [];
  let originalKey = null;

  for (let i = 0; i < rowData.length; i++) {
    const row = rowData[i];

    if (row.type === 'chords' && row.cls === 'chords') {
      // Hebrew style: td.chords comes BEFORE its lyric row (td.song follows)
      if (!originalKey && row.chords.length > 0) {
        const m = row.chords[0].chord.match(/^([A-G][b#]?m?)/);
        if (m) originalKey = m[1];
      }

      if (i + 1 < rowData.length && rowData[i + 1].type === 'song') {
        const line = buildChordLyricLine(row.chords, rowData[i + 1].text);
        if (line.length > 0) lines.push(line);
        i++; // consume the song row
      } else {
        // Chord-only line
        const line = row.chords.map(c => ({ chord: c.chord, lyric: '' }));
        if (line.length > 0) lines.push(line);
      }

    } else if (row.type === 'song') {
      // English style: td.song comes BEFORE its chord row (td.chords_en follows)
      // Hebrew style: td.song with no preceding chords → section label / lyric-only
      const isSectionLabel = isSectionLabelText(row.text);
      if (!isSectionLabel && i + 1 < rowData.length && rowData[i + 1].type === 'chords' && rowData[i + 1].cls === 'chords_en') {
        const chordRow = rowData[i + 1];
        if (!originalKey && chordRow.chords.length > 0) {
          const m = chordRow.chords[0].chord.match(/^([A-G][b#]?m?)/);
          if (m) originalKey = m[1];
        }
        const line = buildChordLyricLine(chordRow.chords, row.text);
        if (line.length > 0) lines.push(line);
        i++; // consume the chords_en row
      } else {
        const text = row.text.trim();
        lines.push([{ chord: null, lyric: text }]);
      }

    } else {
      // chords_en not directly after a song row.
      // Try pairing with the following song row (Hebrew-like ordering within English songs)
      const next = i + 1 < rowData.length ? rowData[i + 1] : null;
      if (next && next.type === 'song' && !isSectionLabelText(next.text)) {
        if (!originalKey && row.chords.length > 0) {
          const m = row.chords[0].chord.match(/^([A-G][b#]?m?)/);
          if (m) originalKey = m[1];
        }
        const line = buildChordLyricLine(row.chords, next.text);
        if (line.length > 0) lines.push(line);
        i++; // consume the song row
      } else {
        // Truly chord-only line (intro, interlude, etc.)
        const line = row.chords.map(c => ({ chord: c.chord, lyric: '' }));
        if (line.length > 0) lines.push(line);
      }
    }
  }

  return { lines, originalKey };
}

/**
 * Extract chord spans from a <td class="chords"> element.
 * Returns [{chord, pos}] where pos is the character offset of the span
 * within the td's text content — aligns with the same offset in the paired song td.
 */
function extractChordSpans($, td) {
  const chords = [];
  let offset = 0;
  const el = td.get(0);

  el.childNodes.forEach(node => {
    if (node.type === 'text') {
      offset += node.data.length;
    } else if (node.type === 'tag') {
      const text = $(node).text();
      const trimmed = text.trim();
      // Only capture if it looks like a chord (starts with A-G)
      if (trimmed && /^[A-G]/.test(trimmed)) {
        chords.push({ chord: trimmed, pos: offset });
      }
      offset += text.length;
    }
  });

  return chords;
}

/**
 * Section labels like "Intro:", "Chorus:", "פזמון:", "פתיחה:" should not be
 * paired with chord rows — they're headers, not singable lyrics.
 */
function isSectionLabelText(text) {
  const t = text.trim();
  return t.length < 25 && t.endsWith(':');
}

/**
 * Build segments for one line by matching chord positions to lyric character positions.
 * Both the chord td and song td share the same character-offset coordinate space.
 */
function buildChordLyricLine(chords, songText) {
  if (chords.length === 0) {
    const text = songText.trim();
    return text ? [{ chord: null, lyric: text }] : [];
  }

  const segments = [];

  // Any lyric text before the first chord position
  const prefix = songText.slice(0, chords[0].pos).trimStart();
  if (prefix) {
    segments.push({ chord: null, lyric: prefix });
  }

  for (let i = 0; i < chords.length; i++) {
    const { chord, pos } = chords[i];
    const nextPos = i + 1 < chords.length ? chords[i + 1].pos : undefined;

    let lyric;
    if (nextPos !== undefined) {
      lyric = songText.slice(pos, nextPos);
    } else {
      // Last segment: trim trailing whitespace/newlines
      lyric = songText.slice(pos).replace(/[\s\n\t]+$/, '');
    }

    segments.push({ chord, lyric });
  }

  return segments;
}

// ---------------------------------------------------------------------------
// Plain-text fallback (for non-tab4u or unsupported pages)
// ---------------------------------------------------------------------------

const CHORD_REGEX = /^[A-G][b#]?(?:m|maj|min|dim|aug|sus|add|M|maj7|m7|7|9|11|13|6|5|4|2)?[0-9]?(?:\/[A-G][b#]?)?$/;

function isChordToken(token) {
  return CHORD_REGEX.test(token);
}

function isChordLine(line) {
  const tokens = line.trim().split(/\s+/);
  if (tokens.length === 0) return false;
  const chordCount = tokens.filter(t => isChordToken(t)).length;
  return chordCount > 0 && chordCount / tokens.length >= 0.6;
}

function parsePlainText(text) {
  const rawLines = text.split('\n');
  const result = [];
  let i = 0;

  while (i < rawLines.length) {
    const line = rawLines[i].trimEnd();

    if (!line.trim()) {
      result.push([{ chord: null, lyric: '' }]);
      i++;
      continue;
    }

    if (isChordLine(line)) {
      const nextLine = i + 1 < rawLines.length ? rawLines[i + 1] : '';
      if (nextLine && !isChordLine(nextLine) && nextLine.trim()) {
        result.push(mergeChordAndLyricLine(line, nextLine));
        i += 2;
      } else {
        result.push(line.trim().split(/\s+/).map(token => ({
          chord: isChordToken(token) ? token : null,
          lyric: isChordToken(token) ? '' : token,
        })));
        i++;
      }
    } else {
      result.push([{ chord: null, lyric: line }]);
      i++;
    }
  }

  return result;
}

function mergeChordAndLyricLine(chordLine, lyricLine) {
  const chords = [];
  const chordPattern = /([A-G][b#]?(?:m|maj|min|dim|aug|sus|add|M|maj7|m7|7|9|11|13|6|5|4|2)?[0-9]?(?:\/[A-G][b#]?)?)/g;
  let match;
  while ((match = chordPattern.exec(chordLine)) !== null) {
    chords.push({ chord: match[1], pos: match.index });
  }
  if (chords.length === 0) return [{ chord: null, lyric: lyricLine }];

  const segments = [];
  for (let i = 0; i < chords.length; i++) {
    const { chord, pos } = chords[i];
    const nextPos = i + 1 < chords.length ? chords[i + 1].pos : undefined;
    const lyric = nextPos !== undefined ? lyricLine.slice(pos, nextPos) : lyricLine.slice(pos);
    segments.push({ chord, lyric });
  }
  if (chords[0].pos > 0) {
    const prefix = lyricLine.slice(0, chords[0].pos).trim();
    if (prefix) segments.unshift({ chord: null, lyric: prefix });
  }
  return segments;
}

module.exports = { scrapeSong };
