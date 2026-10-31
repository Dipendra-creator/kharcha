#!/usr/bin/env bash
# Stop hook for CLAUDE.md rule 2: every finished app change ships as a GitHub release.
# Stops Claude from ending its turn (once) while app files under mobile/ are
# uncommitted, unpushed, or changed since the latest v* release tag.
set -euo pipefail

input=$(cat)
# Claude was already reminded on this stop; let it finish.
[[ $(jq -r '.stop_hook_active // false' <<<"$input") == true ]] && exit 0

cd "${CLAUDE_PROJECT_DIR:-.}"
git rev-parse --git-dir >/dev/null 2>&1 || exit 0

# What ends up in the APK. Release tooling and docs don't need a release.
APP=(mobile ':!mobile/scripts' ':!mobile/README.md' ':!mobile/AGENTS.md' ':!mobile/.claude' ':!mobile/.vscode')

problems=()
[[ -n $(git status --porcelain -- "${APP[@]}") ]] && problems+=("uncommitted app changes in mobile/")
[[ -n $(git rev-list origin/main..HEAD 2>/dev/null) ]] && problems+=("commits on main not pushed to origin")
tag=$(git describe --tags --abbrev=0 --match 'v*' 2>/dev/null || true)
if [[ -n $tag ]] && ! git diff --quiet "$tag" HEAD -- "${APP[@]}"; then
  problems+=("app changes committed since the last release $tag")
fi
((${#problems[@]})) || exit 0

found=$(printf '%s; ' "${problems[@]}")
reason="Release check (CLAUDE.md rule 2): ${found%; }. If this work is finished and the checks pass, ship it now: bump version and versionCode in mobile/app.json, commit on main, write the release notes, run 'cd mobile && scripts/release.sh <notes.md>', and give the user the release URL. If the work isn't finished, a check fails, or you are stopping to ask the user something, say that in one line and stop."
jq -n --arg r "$reason" '{decision: "block", reason: $r}'
