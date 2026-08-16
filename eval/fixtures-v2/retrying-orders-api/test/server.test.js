import test from'node:test';import assert from'node:assert/strict';import {createServer}from'../src/server.js';
test('exports a server',()=>{const s=createServer();assert.equal(typeof s.listen,'function');s.close();});
