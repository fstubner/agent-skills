'use strict';

/**
 * Minimal JSON Schema subset validator (Draft-07-ish).
 * Supports: type, enum, const, required, properties, items, additionalProperties,
 * oneOf, anyOf, $ref (local #/$defs only), $defs / definitions.
 */

function isType(value, type) {
  if (type === 'null') return value === null;
  if (type === 'array') return Array.isArray(value);
  if (type === 'integer') return typeof value === 'number' && Number.isInteger(value);
  if (type === 'number') return typeof value === 'number' && !Number.isNaN(value);
  if (type === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);
  return typeof value === type;
}

function resolveRef(rootSchema, ref) {
  if (!ref.startsWith('#/')) throw new Error(`Unsupported $ref: ${ref}`);
  const parts = ref.slice(2).split('/');
  let cur = rootSchema;
  for (const p of parts) {
    cur = cur?.[p];
    if (cur === undefined) throw new Error(`Unresolved $ref: ${ref}`);
  }
  return cur;
}

function validate(value, schema, rootSchema = schema, path = '$') {
  const errors = [];
  if (!schema || typeof schema !== 'object') return errors;

  if (schema.$ref) {
    return validate(value, resolveRef(rootSchema, schema.$ref), rootSchema, path);
  }

  if (schema.const !== undefined && value !== schema.const) {
    errors.push(`${path}: expected const ${JSON.stringify(schema.const)}`);
  }

  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${path}: expected one of ${JSON.stringify(schema.enum)}`);
  }

  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((t) => isType(value, t))) {
      errors.push(`${path}: expected type ${types.join('|')}, got ${value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value}`);
      return errors;
    }
  }

  if (schema.oneOf) {
    const ok = schema.oneOf.filter((s) => validate(value, s, rootSchema, path).length === 0);
    if (ok.length !== 1) errors.push(`${path}: oneOf matched ${ok.length} schemas`);
  }

  if (schema.anyOf) {
    const ok = schema.anyOf.some((s) => validate(value, s, rootSchema, path).length === 0);
    if (!ok) errors.push(`${path}: anyOf matched none`);
  }

  if (isType(value, 'object')) {
    for (const key of schema.required || []) {
      if (!(key in value)) errors.push(`${path}: missing required "${key}"`);
    }
    const props = schema.properties || {};
    for (const [key, sub] of Object.entries(props)) {
      if (key in value) errors.push(...validate(value[key], sub, rootSchema, `${path}.${key}`));
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!(key in props)) errors.push(`${path}: unexpected property "${key}"`);
      }
    } else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
      for (const key of Object.keys(value)) {
        if (!(key in props)) {
          errors.push(...validate(value[key], schema.additionalProperties, rootSchema, `${path}.${key}`));
        }
      }
    }
  }

  if (isType(value, 'array') && schema.items) {
    const itemSchema = schema.items;
    value.forEach((item, i) => {
      errors.push(...validate(item, itemSchema, rootSchema, `${path}[${i}]`));
    });
  }

  return errors;
}

function validateJson(value, schema) {
  return validate(value, schema, schema, '$');
}

module.exports = { validateJson };
