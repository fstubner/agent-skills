'use strict';

// Minimal JSON-schema validator covering exactly the keyword subset used by
// core/schemas/*.json. Unknown VALIDATION keywords THROW instead of being
// silently ignored, so schema/validator drift fails loudly instead of
// letting invalid data through (the v0.4 validator dropped minLength and
// minimum without a whisper).
//
// The unknown-keyword check is STATIC: it walks the whole schema structure
// up front, independent of what data is validated. A keyword under a
// branch the current data happens not to reach still throws — a
// data-path-dependent guard would let an untested branch's drift through
// silently, which is exactly the failure mode this file exists to prevent.

const ANNOTATIONS = new Set([
  '$schema', '$id', 'title', 'description', 'default', 'examples',
]);

const IMPLEMENTED = new Set([
  'type', 'properties', 'required', 'additionalProperties', 'items',
  'enum', 'const', 'minLength', 'maxLength', 'minimum', 'maximum',
  'pattern', 'minItems',
]);

function checkKeywordsStatic(schema, path = '$') {
  if (schema === null || typeof schema !== 'object' || Array.isArray(schema)) return;
  for (const key of Object.keys(schema)) {
    if (!IMPLEMENTED.has(key) && !ANNOTATIONS.has(key)) {
      throw new Error(
        `schema.cjs: unimplemented schema keyword "${key}" at ${path} — ` +
        `implement it or remove it from the schema; silent skipping is not allowed`
      );
    }
  }
  if (schema.properties) {
    for (const [k, v] of Object.entries(schema.properties)) checkKeywordsStatic(v, `${path}.properties.${k}`);
  }
  if (schema.items) checkKeywordsStatic(schema.items, `${path}.items`);
  if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
    checkKeywordsStatic(schema.additionalProperties, `${path}.additionalProperties`);
  }
}

function typeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number';
  return typeof v;
}

// expected may be a single type string or an array of allowed type strings
// (JSON Schema's `type: ["string", "null"]` form).
function typeSatisfied(expected, actual) {
  const list = Array.isArray(expected) ? expected : [expected];
  return list.some((t) => t === actual || (t === 'number' && actual === 'integer'));
}

function validate(schema, data, path = '$', errors = [], isRoot = true) {
  if (isRoot) checkKeywordsStatic(schema, path);

  const t = typeOf(data);

  if (schema.type !== undefined && !typeSatisfied(schema.type, t)) {
    const expectedLabel = Array.isArray(schema.type) ? schema.type.join('|') : schema.type;
    errors.push(`${path}: expected type ${expectedLabel}, got ${t}`);
    return errors; // structural mismatch — deeper checks would be noise
  }
  if (schema.enum !== undefined && !schema.enum.some((v) => v === data)) {
    errors.push(`${path}: value ${JSON.stringify(data)} not in enum [${schema.enum.join(', ')}]`);
  }
  if (schema.const !== undefined && data !== schema.const) {
    errors.push(`${path}: expected const ${JSON.stringify(schema.const)}`);
  }
  if (t === 'string') {
    if (schema.minLength !== undefined && data.length < schema.minLength) {
      errors.push(`${path}: string shorter than minLength ${schema.minLength}`);
    }
    if (schema.maxLength !== undefined && data.length > schema.maxLength) {
      errors.push(`${path}: string longer than maxLength ${schema.maxLength}`);
    }
    if (schema.pattern !== undefined && !new RegExp(schema.pattern).test(data)) {
      errors.push(`${path}: string does not match pattern ${schema.pattern}`);
    }
  }
  if (t === 'integer' || t === 'number') {
    if (schema.minimum !== undefined && data < schema.minimum) {
      errors.push(`${path}: ${data} below minimum ${schema.minimum}`);
    }
    if (schema.maximum !== undefined && data > schema.maximum) {
      errors.push(`${path}: ${data} above maximum ${schema.maximum}`);
    }
  }
  if (t === 'array') {
    if (schema.minItems !== undefined && data.length < schema.minItems) {
      errors.push(`${path}: array shorter than minItems ${schema.minItems}`);
    }
    if (schema.items !== undefined) {
      data.forEach((item, i) => validate(schema.items, item, `${path}[${i}]`, errors, false));
    }
  }
  if (t === 'object') {
    const props = schema.properties || {};
    for (const req of schema.required || []) {
      if (!(req in data)) errors.push(`${path}: missing required property "${req}"`);
    }
    for (const [k, v] of Object.entries(data)) {
      if (props[k] !== undefined) {
        validate(props[k], v, `${path}.${k}`, errors, false);
      } else if (schema.additionalProperties === false) {
        errors.push(`${path}: unexpected property "${k}"`);
      } else if (typeof schema.additionalProperties === 'object') {
        validate(schema.additionalProperties, v, `${path}.${k}`, errors, false);
      }
    }
  }
  return errors;
}

module.exports = { validate, checkKeywordsStatic };
