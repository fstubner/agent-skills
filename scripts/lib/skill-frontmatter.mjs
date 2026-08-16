// Canonical Agent Skills frontmatter subset. This intentionally validates
// semantics instead of extracting fields with unrelated regular expressions.
const ALLOWED = new Set(['name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools']);

export function validateSkillFrontmatter(text, directoryName) {
  const errors = [];
  const normalized = text.replace(/\r\n/g, '\n');
  const match = normalized.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  if (!match) return ['missing or unclosed YAML frontmatter'];
  const lines = match[1].split('\n');
  const values = new Map();
  for (let i = 0; i < lines.length;) {
    const line = lines[i];
    const keyMatch = /^([a-z][a-z0-9-]*):(?:\s*(.*))?$/.exec(line);
    if (!keyMatch) { errors.push(`unsupported frontmatter syntax on line ${i + 2}`); i++; continue; }
    const [, key, raw = ''] = keyMatch;
    if (!ALLOWED.has(key)) errors.push(`unknown top-level field: ${key}`);
    if (values.has(key)) errors.push(`duplicate field: ${key}`);
    if (key === 'metadata') {
      const entries = [];
      i++;
      while (i < lines.length && /^\s+/.test(lines[i])) { entries.push(lines[i].trim()); i++; }
      if (raw || entries.some((entry) => !/^[^:]+:\s*\S.*$/.test(entry))) errors.push('metadata must be a string-to-string mapping');
      values.set(key, entries.join('\n')); continue;
    }
    if (/^[>|][-+]?\s*$/.test(raw)) {
      const block = [];
      i++;
      while (i < lines.length && /^\s+/.test(lines[i])) { block.push(lines[i].trim()); i++; }
      values.set(key, block.join(raw.startsWith('>') ? ' ' : '\n').trim()); continue;
    }
    values.set(key, raw.trim()); i++;
  }
  const name = values.get('name') || '';
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) || name.length > 64) errors.push('name must be 1-64 lowercase alphanumeric/hyphen characters without leading, trailing, or consecutive hyphens');
  if (name !== directoryName) errors.push(`name ${JSON.stringify(name)} does not match directory ${JSON.stringify(directoryName)}`);
  const description = values.get('description') || '';
  if (!description || description.length > 1024) errors.push('description must be 1-1024 characters');
  const compatibility = values.get('compatibility');
  if (compatibility !== undefined && (!compatibility || compatibility.length > 500)) errors.push('compatibility must be 1-500 characters');
  return errors;
}
