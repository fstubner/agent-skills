# Install across Cursor, Claude, and Codex

These skills use the open [Agent Skills](https://agentskills.io) `SKILL.md` layout. Same folders work in multiple harnesses; only the **install path** changes.

Clone once:

```bash
git clone https://github.com/fstubner/agent-skills.git
cd agent-skills
```

Skills to install (each is a folder with `SKILL.md`):

- `build` **← install this; it is the entry router**
- `product-management`
- `systems-architecture`
- `frontend-engineering`
- `frontend-design`
- `frontend-ux`
- `backend-engineering`
- `product-acceptance`

Optional reference: `_suite-charters/`

Suite version: see [VERSION](./VERSION). Maturity: [STATUS.md](./STATUS.md).

---

## Cursor

**Personal (all projects):**

| OS | Path |
|---|---|
| macOS / Linux | `~/.cursor/skills/<name>/` |
| Windows | `%USERPROFILE%\.cursor\skills\<name>\` |

```powershell
# Windows
$dst = "$env:USERPROFILE\.cursor\skills"
foreach ($s in 'build','product-management','systems-architecture','frontend-engineering','frontend-design','frontend-ux','backend-engineering','product-acceptance') {
  Copy-Item -Recurse -Force ".\$s" "$dst\$s"
}
```

```bash
# macOS / Linux
DST="$HOME/.cursor/skills"
for s in build product-management systems-architecture frontend-engineering frontend-design frontend-ux backend-engineering product-acceptance; do
  rm -rf "$DST/$s" && cp -R "./$s" "$DST/$s"
done
```

**Project-scoped (optional):** `.cursor/skills/<name>/` in the repo.

Reload Cursor (or start a new agent chat). Prefer starting with **`build`** for app work; invoke **`product-acceptance`** in a **separate** turn.

---

## Claude Code (CLI)

**Personal:**

| OS | Path |
|---|---|
| macOS / Linux | `~/.claude/skills/<name>/` |
| Windows | `%USERPROFILE%\.claude\skills\<name>\` |

```bash
DST="$HOME/.claude/skills"
mkdir -p "$DST"
for s in build product-management systems-architecture frontend-engineering frontend-design frontend-ux backend-engineering product-acceptance; do
  rm -rf "$DST/$s" && cp -R "./$s" "$DST/$s"
done
```

**Project-scoped:** `<repo>/.claude/skills/<name>/` (commit if the team should share them).

Restart Claude Code, or reload skills if your build supports it. Invoke explicitly with `/build`, `/frontend-design`, etc., or let Claude match on description.

Scripts under each skill’s `scripts/` run with Node from the project cwd:

```bash
node ~/.claude/skills/frontend-engineering/scripts/check-structure.js --root . --strict
```

---

## Claude Desktop / claude.ai

Two different skill surfaces:

### A) Local Claude Code sessions from Desktop

If Desktop launches a **local** coding session that uses Claude Code on your machine, filesystem skills in `~/.claude/skills/` apply the same way as Claude Code CLI (above).

### B) Claude.ai account skills / Cowork / cloud sessions

Cloud and Cowork sessions **do not** read `~/.claude/skills/` on your disk. They use skills enabled for your **claude.ai account**.

Typical flow:

1. Open **Claude Desktop** → **Customize** (sidebar), or **claude.ai** → skills / customization settings.
2. Add or upload each skill (zip a skill folder containing `SKILL.md`, or follow the UI’s “add skill” flow).
3. Enable all suite skills, especially **`build`**.
4. Start a new session after enabling.

For **cloud** sessions on a git repo, you can also commit project skills under `.claude/skills/` so the cloned workspace picks them up.

Zip example (one skill):

```bash
cd agent-skills
zip -r build.skill.zip build
# upload build.skill.zip in Claude Desktop / claude.ai Customize
```

Repeat per skill (or upload a multi-skill package if the UI allows).

---

## Codex CLI and ChatGPT desktop (Codex / Work mode)

Official discovery paths ([Codex skills docs](https://developers.openai.com/codex/skills)):

| Scope | Path |
|---|---|
| **User (all projects)** | `~/.agents/skills/<name>/` |
| **Repo** | `<repo>/.agents/skills/<name>/` |

```bash
DST="$HOME/.agents/skills"
mkdir -p "$DST"
for s in build product-management systems-architecture frontend-engineering frontend-design frontend-ux backend-engineering product-acceptance; do
  rm -rf "$DST/$s" && cp -R "./$s" "$DST/$s"
done
```

Windows (PowerShell):

```powershell
$dst = "$env:USERPROFILE\.agents\skills"
New-Item -ItemType Directory -Force -Path $dst | Out-Null
foreach ($s in 'build','product-management','systems-architecture','frontend-engineering','frontend-design','frontend-ux','backend-engineering','product-acceptance') {
  Copy-Item -Recurse -Force ".\$s" "$dst\$s"
}
```

**Repo install** (share with the team):

```bash
mkdir -p .agents/skills
for s in build product-management systems-architecture frontend-engineering frontend-design frontend-ux backend-engineering product-acceptance; do
  cp -R "./$s" ".agents/skills/$s"
done
```

In Codex CLI / IDE:

- Explicit: `/skills` or `$build`, `$frontend-engineering`, …
- Implicit: Codex matches on each skill’s `description`

In **ChatGPT desktop**, open **Skills** in the sidebar to see project/user skills; restart Codex/Desktop if a new folder doesn’t appear.

Optional: ask Codex’s `$skill-installer` to pull from this GitHub repo if your build supports remote install prompts.

---

## One-shot: install everywhere (local harnesses)

macOS / Linux:

```bash
git clone https://github.com/fstubner/agent-skills.git
cd agent-skills
SKILLS="build product-management systems-architecture frontend-engineering frontend-design frontend-ux backend-engineering product-acceptance"
for dst in "$HOME/.cursor/skills" "$HOME/.claude/skills" "$HOME/.agents/skills"; do
  mkdir -p "$dst"
  for s in $SKILLS; do
    rm -rf "$dst/$s" && cp -R "./$s" "$dst/$s"
  done
done
```

Then enable the same skills in Claude Desktop Customize if you use cloud/Cowork.

---

## How to use (any harness)

1. Start with **`build`** for greenfield or “ship this app” work.  
2. Let product/architecture/engineering run by default; **answer** design/UX interview questions.  
3. Implement.  
4. New turn: **`product-acceptance`** (builder ≠ acceptor).  

Unprimed evaluation protocol: [STATUS.md](./STATUS.md).  
Smoke scripts: root [README.md](./README.md).
