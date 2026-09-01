# Engineering Assessment: `orders-core`

## Scope and approach

**Depth:** targeted. I enumerated and read every package file under `src/` and `test/` in full, plus `README.md` and `package.json`. The package is a small ES-module JavaScript library for order pricing, customer lookup, formatting, date handling, chunking, and synchronous retry. It targets Node.js; no framework or runtime version is declared.

**In scope:** `package.json`, `README.md`, `src/customers.js`, `src/pricing.js`, `src/util.js`, and `test/pricing.test.js`; package structure, module boundaries, public API shape, correctness/reliability risks, and available automated checks.

**Out of scope:** files outside the package, deployment/CI configuration (none was present in the enumerated workspace), production behavior and metrics, consumer compatibility, security penetration testing, load/concurrency testing, and evaluation cases, graders, expected answers, or sibling run outputs.

## What I ran

- `npm test` — passed: 2 tests, 2 passes, 0 failures.
- `npm run build` — failed to start: `npm error Missing script: "build"`.
- `npm run lint` — failed to start: `npm error Missing script: "lint"`.
- `npm run typecheck` — failed to start: `npm error Missing script: "typecheck"`.
- `npm audit` — failed: `npm error code ENOLOCK`; no lockfile exists.
- `npm ls --depth=0` — succeeded; reported `orders-core@ /workspace` with an empty dependency tree.
- `git status --short` — could not run because `/workspace` is not a Git repository.

## Findings

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|---|---|---|---|---|
| 1 | Medium | Architecture | The shared utility module participates in a circular dependency with both feature modules. | `src/util.js:2-3` imports `priceFor` and `findCustomer`; `src/pricing.js:1` imports `isWeekend` from `util.js`; `src/customers.js:1` imports `slugify` from `util.js`. | Before extraction, split foundational pure helpers (date, slug, money, collection, retry) into a dependency-free module, and keep pricing/customer orchestration in feature modules. Add an import smoke test for supported entry points. |
| 2 | Medium | API/Packaging | The package entry point exposes only `src/util.js`, while pricing and customer functionality is not re-exported from that entry point. This makes the reusable API accidental and obscures which functions are supported for consumers. | `package.json:4` sets `"main": "src/util.js"`; `src/pricing.js:5` and `src/customers.js:8,12` export public functions, but `src/util.js` exports no pricing/customer symbols. | Define an explicit public entry module with named exports, set `main`/`exports` to it, and document the compatibility contract before splitting the package out. |
| 3 | Medium | Correctness | Several public helpers accept malformed or unsafe arguments without validation, producing misleading values or non-terminating behavior. | `src/pricing.js:5-7` dereferences `order` and multiplies `quantity` without checks; `src/util.js:18-20` assumes a string in `parseDate`; `src/util.js:29-32` loops forever when `size` is `0` or negative; `src/util.js:35-41` throws `undefined` when `times <= 0`. | Establish input contracts and validate at each public boundary. In particular reject non-positive chunk sizes and non-positive retry counts with clear errors, validate order/date/quantity, and add tests for invalid inputs. |
| 4 | Medium | Maintainability | Automated coverage exercises only weekday/weekend pricing, leaving every other exported function and important edge condition untested. | `package.json:6` runs only `test/pricing.test.js`; that file contains two tests importing only `priceFor` (`test/pricing.test.js:3-10`). Exports in `src/customers.js` and `src/util.js` have no corresponding tests. | Add focused tests for customer fallback/slugging, money formatting (including negative values if supported), date validation, chunk boundaries and invalid sizes, retry exhaustion/attempt counts, and the package entry point. |
| 5 | Low | Documentation | The README claims `src/util.js` contains “anything shared” and that everything in it is used, but does not describe public exports, argument contracts, Node version, or the intended extraction boundary. | `README.md:3-6`; the package has no `engines`, `exports`, or API documentation in `package.json:1-6`. | Replace the implementation-oriented description with a documented API and support policy, including the intended stable entry point and behavior for invalid inputs. |

## Unconfirmed / Requires Investigation

- Whether the circular ESM imports fail in any supported Node version or bundler configuration was not established by a compatibility matrix; the current Node test run did not import every public module through an external-consumer-like entry point.
- Whether `BASE_MINOR = 2500`, the weekend surcharge, customer fallback behavior, and date format are intentional business rules requires domain-owner confirmation; the code and two tests show behavior but not the specification.
- Dependency/license and vulnerability exposure could not be fully assessed because there is no lockfile and no declared dependencies.

## Strengths

- The package is compact and easy to enumerate: three source modules and one test file, with no runtime dependencies reported by `npm ls --depth=0`.
- The existing pricing checks pass, including both branches of the weekend surcharge (`test/pricing.test.js:5-10`; `npm test` reported 2 passing tests).
- `isWeekend` uses UTC construction and UTC day lookup (`src/util.js:23-26`), avoiding host-local timezone variation for the supplied date string.

## Key Risks

Findings 1–3 are the main extraction risks: the dependency cycle, implicit entry-point contract, and unchecked inputs can become consumer-facing compatibility or reliability problems once callers exist outside this repository. Finding 4 means regressions in most of the proposed reusable surface would currently go undetected.

## Priority Order

1. Define and document the supported package entry point and API (Finding 2).
2. Remove the circular dependency by separating dependency-free helpers (Finding 1).
3. Specify and enforce input contracts, especially `chunk(..., 0)`/negative sizes and retry counts (Finding 3).
4. Add tests for all exported behavior and edge cases (Finding 4).
5. Add package metadata and API documentation, then establish lockfile and lint/type-check policy where appropriate (Finding 5 and tooling gaps).

## Coverage Gaps

- No files outside the current workspace package were examined.
- No build, lint, or type-check scripts exist, so those checks could not reveal compilation, style, or static type issues.
- `npm audit` could not run because there is no lockfile; dependency vulnerability and license review remains incomplete.
- No production configuration, CI, published-package metadata, consumer applications, runtime-version matrix, performance/load tests, fuzz tests, penetration tests, or integration tests were available.
- Git history and change context were unavailable because `/workspace` is not a Git repository.
