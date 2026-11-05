---
name: git-coop-workflow
description: >-
  Enforces strict module separation and safe Git collaboration between Kristian and Ole.
  Use this skill whenever Kristian or Ole asks to save, commit, sync, push, pull, switch branches,
  merge code, or asks "what files should I touch?" or "how do I update my branch?".
---

# Git Co-op Workflow — Kristian & Ole Safe Collaboration Guide

Use this skill whenever **Kristian** or **Ole** asks to save, commit, push, pull, merge, check status, or asks which files/folders they are allowed to edit.

---

## 1. Strict Domain Ownership ("What Should I Touch?")

To guarantee zero merge conflicts while both developers build in parallel with AI agents, enforce these strict module boundaries:

| Developer | Git Branch | Allowed Folders (READ & WRITE) | Forbidden Folders (NEVER TOUCH) |
| :--- | :--- | :--- | :--- |
| **Kristian** | `Komrad-Kristian` | `src/modules/reactor/`<br>`src/modules/terminal/` | `src/modules/inspector/` |
| **Ole** | `Komrad-Ole` | `src/modules/inspector/` | `src/modules/reactor/`<br>`src/modules/terminal/` |
| **Shared** | Coordinated | `src/shared/types.ts`<br>`src/shared/useGameStore.ts`<br>`src/App.tsx` | Only edit with minimal, additive changes coordinated between both developers |

---

## 2. Mandatory Pre-Commit & Pre-Sync Safety Check

**Before EVERY `git add`, `git commit`, `git pull`, `git push`, or `git merge`, the agent MUST run:**

```bash
git branch --show-current && git status --short
```

### Verification Rules:
1. **Confirm Active Branch:**
   - If working with **Kristian**, ensure the active branch is `Komrad-Kristian`.
   - If working with **Ole**, ensure the active branch is `Komrad-Ole`.
2. **Audit Modified/Untracked Files:**
   - **On `Komrad-Kristian` branch:** Verify that **NO** files inside `src/modules/inspector/` appear in `git status`. If any file in `src/modules/inspector/` was accidentally modified, immediately revert it (`git checkout -- src/modules/inspector/`) before staging.
   - **On `Komrad-Ole` branch:** Verify that **NO** files inside `src/modules/reactor/` or `src/modules/terminal/` appear in `git status`. If any file in those folders was accidentally modified, immediately revert it (`git checkout -- src/modules/reactor/ src/modules/terminal/`) before staging.
3. **Stage Domain-Scoped Paths Explicitly:**
   - Prefer staging specific module directories rather than blind `git add .` when possible:
     - Kristian: `git add src/modules/reactor src/modules/terminal`
     - Ole: `git add src/modules/inspector`

---

## 3. Beginner-Friendly Step-by-Step Git Guide (Especially for Ole)

Whenever **Ole** (or **Kristian**) asks how to save work, push changes, or pull updates from the team, always address them as **Komrad Ole** or **Komrad Kristian** with deadpan Soviet enthusiasm for the Five-Year Plan, while explaining what is happening in clear, reassuring, beginner-friendly steps (in Norwegian if the user writes in Norwegian, or English if they write in English):

### Scenario A: Switching to Ole's Branch (First Time Setup)
Explain: *"Utmerket, Komrad Ole! Vi sjekker at du står på din egen Partigodkjente branch (`Komrad-Ole`), slik at alt du bygger i `src/modules/inspector/` ligger trygt skjermet fra Komrad Kristians reaktorarbeid."*
```bash
git checkout Komrad-Ole
git pull origin Komrad-Ole
```

### Scenario B: Saving & Pushing Work (`Save / Push`)
1. **Check status & verify boundaries:**
   ```bash
   git status
   ```
   *(Explain which files were changed and confirm they are all inside `src/modules/inspector/`.)*
2. **Stage & Commit changes:**
   ```bash
   git add src/modules/inspector
   git commit -m "feat(inspector): describe what was added"
   ```
3. **Push to GitHub:**
   ```bash
   git push origin Komrad-Ole
   ```

### Scenario C: Pulling Latest Shared Updates from `main`
When Kristian and Ole want to sync shared changes (such as updated `src/shared/useGameStore.ts` or merged features on `main`):
1. First, make sure current work is committed (`git status` should be clean).
2. Fetch and merge `origin/main` into the developer's branch:
   ```bash
   git fetch origin
   git merge origin/main
   ```
3. Because Kristian only edits `reactor`/`terminal` and Ole only edits `inspector`, merging `origin/main` will complete cleanly without conflicts!
4. Push the updated branch:
   ```bash
   git push origin <Komrad-Kristian|Komrad-Ole>
   ```

### Scenario D: Merging Feature Work into `main`
1. Verify `npm run build` and `npm run lint` pass with zero errors.
2. Switch to `main`, pull latest, merge the developer branch, and push:
   ```bash
   git checkout main
   git pull origin main
   git merge <Komrad-Kristian|Komrad-Ole>
   git push origin main
   git checkout <Komrad-Kristian|Komrad-Ole>
   ```
