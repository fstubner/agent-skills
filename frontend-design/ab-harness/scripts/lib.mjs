import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const harnessRoot = path.resolve(__dirname, '..');

export function loadScenarios(configPath) {
  const file = configPath || path.join(harnessRoot, 'scenarios.json');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--app') out.app = path.resolve(argv[++i]);
    else if (a === '--out') out.out = path.resolve(argv[++i]);
    else if (a === '--base-url') out.baseUrl = argv[++i];
    else if (a === '--config') out.config = path.resolve(argv[++i]);
    else if (a === '--baseline') out.baseline = path.resolve(argv[++i]);
    else if (a === '--candidate') out.candidate = path.resolve(argv[++i]);
    else if (a === '--with-skill') out.withSkill = path.resolve(argv[++i]);
    else if (a === '--without-skill') out.withoutSkill = path.resolve(argv[++i]);
    else if (a === '--threshold') out.threshold = Number(argv[++i]);
    else if (a === '--port-with') out.portWith = Number(argv[++i]);
    else if (a === '--port-without') out.portWithout = Number(argv[++i]);
  }
  return out;
}

export async function applyActions(page, actions = []) {
  for (const action of actions) {
    switch (action.type) {
      case 'click':
        await page.click(action.selector);
        break;
      case 'fill':
        await page.fill(action.selector, action.value);
        break;
      case 'wait':
        await page.waitForTimeout(action.ms);
        break;
      case 'scroll': {
        await page.locator(action.selector).evaluate((el, top) => {
          el.scrollTop = top;
          el.dispatchEvent(new Event('scroll'));
        }, action.top);
        break;
      }
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }
}

export function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}
