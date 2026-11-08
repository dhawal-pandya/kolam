#!/usr/bin/env bash
#
# Build the site for GitHub Pages and publish it to the gh-pages branch.
#
#   scripts/deploy-pages.sh [remote] [commit]     (defaults: origin, HEAD)
#
# Called by .githooks/pre-push when main is pushed; can also be run by hand.
# Env:
#   DRY_RUN=1      build and create the local gh-pages commit, but do not push
#   ALLOW_DIRTY=1  deploy even with uncommitted changes (site may then not match main)
#   ALLOW_DIVERGED=1  deploy even if origin/main is not an ancestor (e.g. force push)
#
set -euo pipefail

remote="${1:-origin}"
sha="${2:-$(git rev-parse HEAD)}"
root="$(git rev-parse --show-toplevel)"
cd "$root"

say() { printf '\033[1;33mdeploy:\033[0m %s\n' "$*"; }
die() { printf '\033[1;31mdeploy: %s\033[0m\n' "$*" >&2; exit 1; }

# 1. The site must be built from exactly the commit being pushed.
[[ "$(git rev-parse HEAD)" == "$sha" ]] ||
  die "pushing ${sha:0:7} but HEAD is $(git rev-parse --short HEAD). Check out that commit (or push HEAD) so the site matches main."
if [[ -z "${ALLOW_DIRTY:-}" && -n "$(git status --porcelain)" ]]; then
  git status --short >&2
  die "working tree has uncommitted or untracked changes; commit or stash them so the deployed site matches main (or ALLOW_DIRTY=1)."
fi

# 2a. GitHub makes the first branch pushed to an empty repository its
#     default. Publishing gh-pages first would make it the default, and the
#     hook cannot push main itself (git's own push of main would then be
#     rejected), so ask for one plain push of main first.
if [[ -z "${DRY_RUN:-}" && -z "$(git ls-remote --heads "$remote" 2>/dev/null)" ]]; then
  die "$remote is an empty repository. Push main once without deploying, so main becomes the default branch:
    SKIP_PAGES_DEPLOY=1 git push -u $remote main
  then publish the site with:  npm run deploy:pages   (later pushes deploy automatically)"
fi

# 2b. Don't publish a site for a main that the remote will then reject.
if git fetch -q "$remote" main 2>/dev/null; then
  if [[ -z "${ALLOW_DIVERGED:-}" ]] && ! git merge-base --is-ancestor FETCH_HEAD "$sha"; then
    die "$remote/main has commits you don't have; pull first (or ALLOW_DIVERGED=1 for a force push)."
  fi
fi

# 3. Project sites are served under /<repo>/; a <user>.github.io repo at /.
repo="$(basename -s .git "$(git remote get-url "$remote")")"
if [[ "$repo" == *.github.io ]]; then base=""; else base="/$repo"; fi

say "testing ${sha:0:7}"
npm test --silent
say "building for GitHub Pages (base path '${base:-/}')"
rm -rf out
PAGES_BASE_PATH="$base" npx next build
[[ -f out/index.html ]] || die "build produced no out/index.html"
touch out/.nojekyll # stop Jekyll from dropping the _next/ folder

# 4. Commit out/ onto gh-pages using a throwaway index: the working tree,
#    the real index and the current branch are never touched.
index="$(mktemp -u)"
GIT_INDEX_FILE="$index" git --work-tree="$root/out" add -A
tree="$(GIT_INDEX_FILE="$index" git write-tree)"
rm -f "$index"

parent=""
if git fetch -q "$remote" gh-pages 2>/dev/null; then
  parent="$(git rev-parse FETCH_HEAD)"
elif git rev-parse -q --verify refs/heads/gh-pages >/dev/null; then
  parent="$(git rev-parse refs/heads/gh-pages)"
fi

if [[ -n "$parent" && "$(git rev-parse "$parent^{tree}")" == "$tree" ]]; then
  say "site unchanged since the last deploy; nothing to publish"
  git update-ref refs/heads/gh-pages "$parent"
  exit 0
fi

msg="Deploy $(git rev-parse --short "$sha"): $(git log -1 --format=%s "$sha")"
commit="$(git commit-tree "$tree" ${parent:+-p "$parent"} -m "$msg")"
git update-ref refs/heads/gh-pages "$commit"
say "gh-pages → $(git rev-parse --short "$commit")"

if [[ -n "${DRY_RUN:-}" ]]; then
  say "DRY_RUN=1: not pushing"
  exit 0
fi

# --no-verify: this push must not re-enter the pre-push hook.
git push --no-verify "$remote" refs/heads/gh-pages:refs/heads/gh-pages
owner="$(git remote get-url "$remote" | sed -E 's#.*[:/]([^/]+)/[^/]+$#\1#')"
say "published; GitHub Pages will serve it at https://$owner.github.io${base}/"
