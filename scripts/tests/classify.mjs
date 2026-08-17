import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  root, registry, read, expect, runNode, walk, pathToFileUrl,
  tmpBase, runFixture, assertFixture, ARCH, BACKEND, FRONTEND, ACCEPT,
} from './harness.mjs';

// ---------- 12. Manifest parsers, against REAL-WORLD manifest shapes ----------
// The per-ecosystem readers were written against one hand-picked shape each and
// fixtured with that same shape, so the fixtures confirmed the implementation
// instead of probing it. Every case below is a normal, common way to write the
// manifest that returned ZERO dependencies — meaning serverPresent went false,
// B-scope short-circuited, and the entire backend gate silently skipped.
{
  const { classify } = await import(pathToFileUrl(path.join(root, 'core', 'lib', 'classify.cjs')));
  const mk = (files) => {
    const dir = fs.mkdtempSync(path.join(tmpBase, 'manifest-'));
    for (const [rel, content] of Object.entries(files)) {
      const full = path.join(dir, rel);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, content);
    }
    return dir;
  };
  // [label, files, expectServerPresent, mustContainDep, mustNotContainDep]
  const CASES = [
    ['py: single-line PEP-621 array',
      { 'pyproject.toml': '[project]\nname = "s"\ndependencies = ["flask", "sqlalchemy"]\n' }, true, 'flask'],
    ['py: PEP-621 state must not leak past the closing bracket',
      { 'pyproject.toml': '[project]\ndependencies = [\n  "requests",\n]\nclassifiers = [\n  "Framework :: Django :: 4.2",\n]\n' },
      false, null, 'django'],
    ['py: Poetry 1.2+ group syntax',
      { 'pyproject.toml': '[tool.poetry.group.main.dependencies]\nflask = "^3.0"\n' }, true, 'flask'],
    ['py: requirements.txt -r include is followed',
      { 'requirements.txt': '-r requirements/base.txt\n', 'requirements/base.txt': 'flask==3.0.0\n' }, true, 'flask'],
    ['py: nested service manifest is discovered',
      { 'services/api/requirements.txt': 'flask==3.0.0\n' }, true, 'flask'],
    ['examples: manifests do not classify the product',
      { 'examples/demo/requirements.txt': 'flask==3.0.0\n' }, false, null, 'flask'],
    ['eval: intentionally app-shaped cases do not classify the product',
      {
        'eval/fixtures-v2/demo/package.json': '{"dependencies":{"express":"^4.18.0","react":"^18.2.0"}}',
        'eval/fixtures-v2/demo/server.js': 'export {};\n',
        'eval/fixtures-v2/demo/App.jsx': 'export default function App() { return null; }\n',
      }, false, null, 'express'],
    ['go: second require block is parsed',
      { 'go.mod': 'module x\n\nrequire ( golang.org/x/text v0.3.0 )\n\nrequire ( github.com/labstack/echo/v4 v4.11.0 )\n' },
      true, 'github.com/labstack/echo/v4'],
    ['go: a paren inside a comment does not truncate the block',
      { 'go.mod': 'module x\n\nrequire (\n\t// gin (web framework)\n\tgithub.com/gin-gonic/gin v1.9.1\n)\n' },
      true, 'github.com/gin-gonic/gin'],
    ['go: // indirect deps are not counted as direct',
      { 'go.mod': 'module x\n\nrequire (\n\tgithub.com/gin-gonic/gin v1.9.1\n\tgorm.io/gorm v1.25.7 // indirect\n)\n' },
      true, 'github.com/gin-gonic/gin', 'gorm.io/gorm'],
    ['rust: [dependencies.foo] subtable',
      { 'Cargo.toml': '[package]\nname = "s"\n\n[dependencies]\nserde = "1.0"\n\n[dependencies.axum]\nversion = "0.7"\n' },
      true, 'axum'],
    ['rust: [workspace.dependencies]',
      { 'Cargo.toml': '[workspace]\nmembers = ["a"]\n\n[workspace.dependencies]\naxum = "0.7"\n' }, true, 'axum'],
    ['java: gradle coordinates without an inline version',
      { 'build.gradle': "dependencies {\n  implementation 'org.springframework.boot:spring-boot-starter-web'\n}\n" },
      true, 'spring-boot-starter-web'],
    ['java: pom <exclusion> is not counted as a dependency',
      { 'pom.xml': '<project><artifactId>my-svc</artifactId><dependencies><dependency>' +
        '<artifactId>spring-boot-starter-web</artifactId><exclusions><exclusion>' +
        '<artifactId>hibernate-core</artifactId></exclusion></exclusions></dependency></dependencies></project>\n' },
      true, 'spring-boot-starter-web', 'hibernate-core'],
    ['java: the project\'s own artifactId is not a dependency',
      { 'pom.xml': '<project><artifactId>my-svc</artifactId><dependencies><dependency>' +
        '<artifactId>spring-boot-starter-web</artifactId></dependency></dependencies></project>\n' },
      true, 'spring-boot-starter-web', 'my-svc'],
    ['node: root server.ts counts as a server file',
      { 'package.json': '{}', 'server.ts': 'export {};\n' }, true, null],
    ['node: nested backend/+frontend/ package.json split (no root deps, no workspaces field) counts as a server file',
      {
        'package.json': '{"name":"root","private":true}',
        'backend/package.json': '{"dependencies":{"express":"^4.18.0"}}',
        'frontend/package.json': '{"dependencies":{"react":"^18.2.0"}}',
        'frontend/public/index.html': '<!doctype html>\n',
      }, true, 'express'],
  ];
  for (const [label, files, wantServer, mustHave, mustNotHave] of CASES) {
    const cls = classify(mk(files));
    const deps = cls.manifests.flatMap((m) => [...m.depNames]);
    expect(`classify — ${label}: serverPresent ${wantServer}`, cls.serverPresent === wantServer,
      `got ${cls.serverPresent}; deps: [${deps.join(', ')}]`);
    if (mustHave) {
      expect(`classify — ${label}: detects ${mustHave}`, deps.includes(mustHave), `deps: [${deps.join(', ')}]`);
    }
    if (mustNotHave) {
      expect(`classify — ${label}: does NOT count ${mustNotHave}`, !deps.includes(mustNotHave), `deps: [${deps.join(', ')}]`);
    }
  }

  // Regression: a genuinely multi-part project (separate backend/ and
  // frontend/ directories, each with its own package.json, no npm/yarn
  // workspaces field tying them together) was classified single-part because
  // only the ROOT package.json was ever read — express in backend/package.json
  // and react in frontend/package.json were both invisible. Found via a real
  // A/B eval run: check-architecture.js said "architecture doc not required"
  // on a project that was unambiguously client+server.
  {
    const dir = mk({
      'package.json': '{"name":"root","private":true}',
      'backend/package.json': '{"dependencies":{"express":"^4.18.0"}}',
      'backend/src/index.ts': 'export {};\n',
      'frontend/package.json': '{"dependencies":{"react":"^18.2.0"}}',
      'frontend/public/index.html': '<!doctype html>\n',
      'frontend/src/App.jsx': 'export default function App() { return null; }\n',
    });
    const cls = classify(dir);
    expect('classify — nested backend/+frontend/ split: multiPart is true',
      cls.multiPart === true,
      `distinctServerPresent=${cls.distinctServerPresent} frontendPresent=${cls.frontendPresent}`);
  }
}
