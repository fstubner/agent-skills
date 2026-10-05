'use strict';
// Reads the prose out of a markdown document, line by line, so the voice
// rules apply to what a person reads and never to code, tables, links or
// comments. Everything a rule should not see is removed here, once, instead of
// each rule carrying its own exemptions.
//
// What is not prose:
//   - fenced code blocks and inline code (a literal like `Developer: Reload
//     Window` belongs in backticks, which is also how a reader knows it is one)
//   - HTML comments, including multi-line template hints
//   - YAML front matter
//   - table rows
//   - link targets, autolinks and bare URLs (the visible link text stays)

const FENCE = /^\s*(```|~~~)/;

// keepBreaks marks every line that is not prose with text: null, so a caller
// can tell where one paragraph or list item ends and the next begins.
function proseLines(text, { keepBreaks = false } = {}) {
  const out = [];
  const brk = (i) => { if (keepBreaks) out.push({ n: i + 1, text: null }); };
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  let inFence = false;
  let inComment = false;
  let inFrontMatter = lines[0] === '---';
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    if (inFrontMatter) {
      if (i > 0 && line === '---') inFrontMatter = false;
      brk(i);
      continue;
    }
    if (FENCE.test(line)) { inFence = !inFence; brk(i); continue; }
    if (inFence) { brk(i); continue; }

    // Comments can open and close anywhere, and span lines.
    let kept = '';
    let rest = line;
    while (rest.length > 0) {
      if (inComment) {
        const end = rest.indexOf('-->');
        if (end === -1) { rest = ''; break; }
        rest = rest.slice(end + 3);
        inComment = false;
      } else {
        const start = rest.indexOf('<!--');
        if (start === -1) { kept += rest; rest = ''; break; }
        kept += rest.slice(0, start);
        rest = rest.slice(start + 4);
        inComment = true;
      }
    }
    line = kept;

    if (/^\s*\|/.test(line)) { brk(i); continue; }
    // Inline code becomes one placeholder word rather than nothing. It is a
    // word to a reader, so it counts toward sentence length, and a sentence
    // that starts with it still reads as starting a new sentence.
    line = line
      .replace(/``[^`]*``/g, 'Code')
      .replace(/`[^`]*`/g, 'Code')
      .replace(/\]\([^)]*\)/g, ']')
      .replace(/<https?:[^>]*>/g, ' ')
      .replace(/\bhttps?:\/\/\S+/g, ' ');
    if (line.trim() === '') { brk(i); continue; }
    out.push({ n: i + 1, text: line });
  }
  return out;
}

// Headings with their content, for structure checks. A heading counts when
// any of `patterns` matches its text.
function headings(text) {
  const out = [];
  let inFence = false;
  for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
    if (FENCE.test(line)) { inFence = !inFence; continue; }
    if (inFence) continue;
    const m = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (m) out.push({ level: m[1].length, text: m[2] });
  }
  return out;
}

// The first paragraph a reader meets: prose before the first second-level
// heading, ignoring the title and badge or link-only lines.
function openingParagraph(text) {
  const words = [];
  for (const { text: line } of proseLines(text)) {
    if (/^#{2,6}\s/.test(line)) break;
    if (/^#\s/.test(line)) continue;
    const bare = line.replace(/!?\[[^\]]*\]/g, '').replace(/[·|*_]/g, '').trim();
    if (bare.split(/\s+/).filter(Boolean).length < 4) continue;
    words.push(bare);
  }
  return words.join(' ');
}

// One section of a changelog, by its heading: "Unreleased" matches
// "## [Unreleased]", and a version matches "## 0.3.0 — 2026-09-17".
function changelogSection(text, name) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const want = name.toLowerCase();
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    const m = /^##\s+\[?([^\]\s]+)\]?/.exec(lines[i]);
    if (!m) continue;
    if (start === -1 && m[1].toLowerCase() === want) { start = i; continue; }
    if (start !== -1) return lines.slice(start, i).join('\n');
  }
  return start === -1 ? null : lines.slice(start).join('\n');
}

// Paragraphs and list items, each as one unit of prose with the line it
// starts on. A list item never runs into the next one, which a plain join of
// lines does whenever an item has no full stop. A numbered item is a step.
const LIST_ITEM = /^\s*(?:([-*+])|(\d+)[.)])\s+/;

function proseBlocks(text) {
  const blocks = [];
  let current = null;
  const close = () => { if (current) blocks.push(current); current = null; };
  for (const line of proseLines(text, { keepBreaks: true })) {
    if (line.text === null) { close(); continue; }
    if (/^\s*#{1,6}\s/.test(line.text)) { close(); continue; }
    const item = LIST_ITEM.exec(line.text);
    if (item) {
      close();
      current = { n: line.n, kind: item[2] ? 'step' : 'item', text: line.text.slice(item[0].length) };
    } else if (current) {
      current.text += ` ${line.text.trim()}`;
    } else {
      current = { n: line.n, kind: 'prose', text: line.text.trim() };
    }
  }
  close();
  return blocks;
}

// Sentences in a block. A full stop ends a sentence only when the next word
// starts with a capital, a digit, a quote or markup, so "e.g. the" and "v0.3.0"
// stay whole.
function sentences(text) {
  return text.replace(/\s+/g, ' ').trim()
    // Closing emphasis or a quote may follow the full stop, as in a bold
    // lead sentence ("**Reports are evidence.** The gate…").
    .split(/(?<=[.!?][*_"')\]]*)\s+(?=[A-Z0-9"'*\[(])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const wordCount = (sentence) => sentence.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length;

module.exports = { proseLines, proseBlocks, sentences, wordCount, headings, openingParagraph, changelogSection };
