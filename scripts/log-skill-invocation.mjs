#!/usr/bin/env node
// Harness adapters write one local, append-only event for each observable
// skill activation. Claude has a first-class Skill tool; other harnesses
// expose a successful SKILL.md read. Antigravity exposes the model's requested
// read in its documented transcript, before tool completion. The evidence
// field keeps those signals distinct.
//
// The hook is fail-open and silent. Telemetry must never block agent work.

import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LOG_DIR = process.env.AGENT_SKILLS_TELEMETRY_DIR
  || path.join(os.homedir(), '.agent-skills-telemetry');
const LOG_PATH = path.join(LOG_DIR, 'invocations.jsonl');
const KNOWN_HARNESSES = new Set(['claude', 'codex', 'cursor', 'antigravity']);

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

function registryIds() {
  for (const candidate of [path.join(HERE, 'registry.json'), path.join(HERE, '..', 'registry.json')]) {
    const registry = readJson(candidate);
    if (registry?.skills) return new Set(registry.skills.map((skill) => skill.id));
  }
  return new Set();
}

function parseHarness(argv) {
  const at = argv.indexOf('--harness');
  const value = at >= 0 ? argv[at + 1] : 'claude';
  return KNOWN_HARNESSES.has(value) ? value : null;
}

function readStdin() {
  try { return fs.readFileSync(0, 'utf8'); } catch { return ''; }
}

function toolName(payload) {
  return payload.tool_name || payload.toolName || payload.toolCall?.name || '';
}

function toolInput(payload) {
  return payload.tool_input || payload.toolInput || payload.toolCall?.args || {};
}

function explicitSkillName(payload) {
  const input = toolInput(payload);
  return input.skill || input.name || input.skill_name || payload.skill || null;
}

function stringsIn(value, out = []) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((item) => stringsIn(item, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((item) => stringsIn(item, out));
  return out;
}

function skillFromFileReference(value, ids) {
  if (typeof value !== 'string' || !/SKILL\.md/i.test(value)) return null;
  const normalized = value.replaceAll('\\', '/');
  for (const match of normalized.matchAll(/(?:^|[\s"']|\/)([a-z][a-z0-9-]*)\/SKILL\.md\b/gi)) {
    if (ids.has(match[1])) return match[1];
  }
  return null;
}

function skillFileFrom(value, ids) {
  for (const text of stringsIn(value)) {
    const skill = skillFromFileReference(text, ids);
    if (skill) return skill;
  }
  return null;
}

function eventId(harness, payload, suffix = '') {
  const session = payload.session_id || payload.sessionId || payload.conversation_id
    || payload.conversationId || null;
  const call = payload.tool_use_id || payload.toolUseId || payload.tool_call_id || null;
  return session && call ? `${harness}:${session}:${call}${suffix}` : null;
}

function projectContext(payload) {
  const roots = payload.workspace_roots || payload.workspacePaths || [];
  const cwd = payload.cwd || roots[0] || process.cwd();
  return { cwd, project: path.basename(cwd) };
}

function directEvents(harness, payload, ids) {
  const name = toolName(payload);
  if (name === 'Skill') {
    return [{
      skill: explicitSkillName(payload),
      evidence: 'skill-tool-call',
      event: eventId(harness, payload),
    }];
  }

  if (harness === 'cursor' && name === 'Read') {
    const skill = skillFileFrom(toolInput(payload), ids);
    return skill ? [{ skill, evidence: 'skill-file-read', event: eventId(harness, payload) }] : [];
  }

  if (harness === 'codex') {
    const input = toolInput(payload);
    const inputText = stringsIn(input).join('\n');
    const readLike = /(?:Get-Content|\bcat\b|\bsed\b|\btype\b|read_file|read_mcp_resource)/i.test(inputText);
    const skill = readLike ? skillFileFrom(input, ids) : null;
    return skill ? [{ skill, evidence: 'skill-file-read', event: eventId(harness, payload) }] : [];
  }

  return [];
}

function antigravityEvents(payload, ids) {
  const transcript = payload.transcriptPath || payload.transcript_path;
  if (!transcript) return [];
  let text;
  try { text = fs.readFileSync(transcript, 'utf8'); } catch { return []; }
  const events = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    let step;
    try { step = JSON.parse(line); } catch { continue; }
    for (const [index, call] of (step.tool_calls || []).entries()) {
      if (call?.name !== 'view_file') continue;
      const skill = skillFileFrom(call.args, ids);
      if (!skill) continue;
      const session = payload.conversationId || payload.conversation_id || 'unknown';
      events.push({
        skill,
        evidence: 'skill-file-read-request',
        event: `antigravity:${session}:${step.step_index}:${index}`,
      });
    }
  }
  return events;
}

function existingEventIds() {
  const ids = new Set();
  let text;
  try { text = fs.readFileSync(LOG_PATH, 'utf8'); } catch { return ids; }
  for (const line of text.split('\n')) {
    try {
      const row = JSON.parse(line);
      if (row.event) ids.add(row.event);
    } catch { /* malformed rows stay visible to the reader */ }
  }
  return ids;
}

function append(events, harness, payload) {
  if (events.length === 0) return;
  const seen = existingEventIds();
  const context = projectContext(payload);
  const session = payload.session_id || payload.sessionId || payload.conversation_id
    || payload.conversationId || null;
  fs.mkdirSync(LOG_DIR, { recursive: true });
  for (const item of events) {
    if (item.event && seen.has(item.event)) continue;
    const row = {
      schemaVersion: 1,
      at: new Date().toISOString(),
      harness,
      skill: item.skill,
      evidence: item.evidence,
      ...context,
      session,
      event: item.event,
    };
    fs.appendFileSync(LOG_PATH, JSON.stringify(row) + '\n');
    if (item.event) seen.add(item.event);
  }
}

function main() {
  const harness = parseHarness(process.argv.slice(2));
  const raw = readStdin();
  if (!harness || !raw.trim()) return;
  let payload;
  try { payload = JSON.parse(raw); } catch { return; }
  const ids = registryIds();
  const events = harness === 'antigravity'
    ? [...directEvents(harness, payload, ids), ...antigravityEvents(payload, ids)]
    : directEvents(harness, payload, ids);
  append(events, harness, payload);
}

try { main(); } catch { /* fail-open by design */ }
process.exit(0);
