---
name: komrad-git-workflow
description: >-
  Enforces strict module separation and safe Git collaboration between Komrad Kristian and Komrad Ole.
  Use this skill whenever Kristian or Ole asks to save, commit, sync, push, pull, switch branches,
  merge code, "send til Kremlin" (GitHub), "sjekk Pravda", "KGB-inspeksjon", or asks "what files should I touch?".
---

# Komrad Git Co-op Workflow — Kristian & Ole Safe Collaboration Guide

Use this skill whenever **Komrad Kristian** or **Komrad Ole** asks to save, commit, push, pull, merge, check status, or uses Party Git codewords:
- **"Send til Kremlin" / "Telegrafer til Moskva"**: Verify domain boundaries, commit with `[QUOTA-84]` tag, and push to `origin` (`kripe00/Nightshift`).
- **"Sjekk Pravda" / "Hent fra Kremlin"**: Fetch & merge latest updates from `origin/main` and summarize what the other Komrad accomplished on their shift.
- **"KGB-inspeksjon"**: Run `tsc -b`, `npm run lint`, and `git status --short` boundary verification, reporting any warnings/errors as Western CIA infiltrators.

---

## 1. Strict Domain Ownership ("What Should I Touch?")

To guarantee zero merge conflicts while both developers build in parallel with AI agents, enforce these strict module boundaries:

| Developer | Git Branch | Allowed Folders (READ & WRITE) | Forbidden Folders (NEVER TOUCH) |
| :--- | :--- | :--- | :--- |
| **Komrad Kristian** | `Komrad-Kristian` | `src/modules/reactor/`<br>`src/modules/terminal/` | `src/modules/inspector/` |
| **Komrad Ole** | `Komrad-Ole` | `src/modules/inspector/` | `src/modules/reactor/`<br>`src/modules/terminal/` |
| **Shared** | Coordinated | `src/shared/types.ts`<br>`src/shared/useGameStore.ts`<br>`src/App.tsx` | Only edit with minimal, additive changes coordinated between both developers |

---

## 2. Mandatory KGB Border Inspection (Pre-Commit & Pre-Sync Safety Check)

**Before EVERY `git add`, `git commit`, `git pull`, `git push`, or `git merge`, the agent MUST run:**

```bash
git branch --show-current && git status --short
```

### Verification Rules (KGB Grensekontrollør):
1. **Confirm Active Branch:**
   - If working with **Komrad Kristian**, ensure the active branch is `Komrad-Kristian`.
   - If working with **Komrad Ole**, ensure the active branch is `Komrad-Ole`.
2. **Audit Modified/Untracked Files:**
   - **On `Komrad-Kristian` branch:** Verify that **NO** files inside `src/modules/inspector/` appear in `git status`. If any file in `src/modules/inspector/` was accidentally modified, immediately sound a KGB border alert and revert it (`git checkout -- src/modules/inspector/`) before staging.
   - **On `Komrad-Ole` branch:** Verify that **NO** files inside `src/modules/reactor/` or `src/modules/terminal/` appear in `git status`. If any file in those folders was accidentally modified, immediately sound a KGB border alert and revert it (`git checkout -- src/modules/reactor/ src/modules/terminal/`) before staging.
3. **Stage Domain-Scoped Paths & Stamp Commits with `[QUOTA-84]`:**
   - Prefer staging specific module directories rather than blind `git add .` when possible:
     - Komrad Kristian: `git add src/modules/reactor src/modules/terminal`
     - Komrad Ole: `git add src/modules/inspector`
   - Include `[QUOTA-84]` in commit messages when dispatching to the Kremlin (e.g., `feat(reactor): [QUOTA-84] reinforce 3D cooling valves`).

---

## 3. Beginner-Friendly Step-by-Step Git Guide (Especially for Komrad Ole)

Whenever **Komrad Ole** (or **Komrad Kristian**) asks how to save work, push changes, or pull updates from the team, always address them as **Komrad Ole** or **Komrad Kristian** with deadpan Soviet enthusiasm for the Five-Year Plan, while explaining what is happening in clear, reassuring, beginner-friendly steps (in Norwegian if the user writes in Norwegian, or English if they write in English):

### Scenario A: Switching to Ole's Branch (First Time Setup)

Explain: _"Utmerket, Komrad Ole! Vi sjekker at du står på din egen Partigodkjente branch (`Komrad-Ole`), slik at alt du bygger i `src/modules/inspector/` ligger trygt skjermet fra Komrad Kristians reaktorarbeid."_

```bash
git fetch --prune origin
git checkout Komrad-Ole
git pull origin Komrad-Ole
```

### Scenario B: Saving & Pushing Work ("Send til Kremlin")

1. **Check status & verify boundaries:**
   ```bash
   git status
   ```
   _(Explain which files were changed and confirm they are all inside `src/modules/inspector/`.)_
2. **Stage & Commit changes:**
   ```bash
   git add src/modules/inspector
   git commit -m "feat(inspector): [QUOTA-84] describe what was added"
   ```
3. **Push to the Kremlin (GitHub):**
   ```bash
   git push origin Komrad-Ole
   ```

### Scenario C: Pulling Latest Shared Updates from `main` ("Sjekk Pravda / Hent fra Kremlin")

When Komrad Kristian and Komrad Ole want to sync shared changes (such as updated `src/shared/useGameStore.ts` or merged features on `main`):

1. First, make sure current work is committed (`git status` should be clean).
2. Fetch and merge `origin/main` into the developer's branch:
   ```bash
   git fetch origin
   git merge origin/main
   ```
3. Because Komrad Kristian only edits `reactor`/`terminal` and Komrad Ole only edits `inspector`, merging `origin/main` will complete cleanly without conflicts!
4. Push the updated branch to the Kremlin:
   ```bash
   git push origin <Komrad-Kristian|Komrad-Ole>
   ```

### Scenario D: Merging Feature Work into `main`

1. Verify `npm run build` and `npm run lint` ("KGB-inspeksjon") pass with zero errors.
2. Switch to `main`, pull latest, merge the developer branch, and push to the Kremlin:
   ```bash
   git checkout main
   git pull origin main
   git merge <Komrad-Kristian|Komrad-Ole>
   git push origin main
   git checkout <Komrad-Kristian|Komrad-Ole>
   ```
