// Generate TTS audio files for all countries in World Explorer
// Usage: node generate-tts.js

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const LLM = process.env.HOME + '/.local/bin/llm.exe';
const AUDIO_DIR = path.join(__dirname, 'audio', 'countries');
const CONCURRENCY = 8;

// Load country data
const html = fs.readFileSync(path.join(__dirname, 'world-explorer.html'), 'utf8');
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
const js = scriptMatch[1];
const cdStart = js.indexOf('const CD={');
const cdDecl = js.substring(cdStart);
let depth = 0, end = 0;
for (let i = cdDecl.indexOf('{'); i < cdDecl.length; i++) {
  if (cdDecl[i] === '{') depth++;
  else if (cdDecl[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
}
const CD = new Function(cdDecl.substring(0, end).replace('const CD=', 'return '))();

// Build TTS tasks
const tasks = Object.entries(CD).map(([id, c]) => {
  const outFile = path.join(AUDIO_DIR, c.a2 + '.mp3');
  const text = [
    c.n + '.',
    'The capital is ' + c.cap + '.',
    'Languages spoken: ' + c.lang.join(', ') + '.',
    ...c.facts
  ].join(' ');
  return { a2: c.a2, name: c.n, outFile, text };
});

// Regenerate all files (pass --skip-existing to keep existing ones)
const skipExisting = process.argv.includes('--skip-existing');
const todo = skipExisting ? tasks.filter(t => !fs.existsSync(t.outFile)) : tasks;
console.log(`Total: ${tasks.length} countries, ${todo.length} to generate\n`);

if (todo.length === 0) { console.log('All done!'); process.exit(0); }

// Process sequentially (TTS API has rate limits)
let done = 0;
for (const t of todo) {
  done++;
  process.stdout.write(`[${done}/${todo.length}] ${t.name} (${t.a2})... `);
  try {
    execFileSync(LLM, ['tts', t.text, '--out', t.outFile, '--no-play'], { stdio: 'pipe' });
    const size = (fs.statSync(t.outFile).size / 1024).toFixed(0);
    console.log(`OK (${size} KB)`);
  } catch (e) {
    console.log('FAILED - ' + (e.stderr ? e.stderr.toString().trim() : e.message));
  }
}

console.log(`\nDone! Generated ${done} audio files.`);
