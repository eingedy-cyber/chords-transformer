'use strict';

const express = require('express');
const path = require('path');
const { scrapeSong } = require('./scraper');
const { transposeLines } = require('./transposer');
const { renderSong } = require('./renderer');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// POST /transpose — used by the UI form
app.post('/transpose', async (req, res) => {
  const { url, targetKey } = req.body;

  if (!url || !targetKey) {
    return res.status(400).json({ error: 'Missing url or targetKey' });
  }

  try {
    const song = await scrapeSong(url);
    const transposedLines = transposeLines(song.lines, song.originalKey || targetKey, targetKey);
    const html = renderSong({ ...song, lines: transposedLines, targetKey });
    res.send(html);
  } catch (err) {
    console.error('Transpose error:', err.message);
    res.status(500).send(errorPage(err.message));
  }
});

// GET /song?url=...&key=... — shareable link
app.get('/song', async (req, res) => {
  const { url, key } = req.query;

  if (!url || !key) {
    return res.status(400).send(errorPage('Missing url or key parameter'));
  }

  try {
    const song = await scrapeSong(url);
    const transposedLines = transposeLines(song.lines, song.originalKey || key, key);
    const html = renderSong({ ...song, lines: transposedLines, targetKey: key });
    res.send(html);
  } catch (err) {
    console.error('Song error:', err.message);
    res.status(500).send(errorPage(err.message));
  }
});

function errorPage(message) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Error</title>
<style>body{font-family:sans-serif;padding:2rem;max-width:600px;margin:0 auto}
.error{background:#fff3f3;border:1px solid #f5a5a5;border-radius:6px;padding:1.5rem}
h2{color:#c0392b;margin-bottom:1rem}
a{color:#1a6fa8}</style>
</head>
<body>
<div class="error">
  <h2>Error</h2>
  <p>${message}</p>
  <p style="margin-top:1rem"><a href="/">← Back</a></p>
</div>
</body>
</html>`;
}

app.listen(PORT, () => {
  console.log(`Chords Transformer running at http://localhost:${PORT}`);
});
