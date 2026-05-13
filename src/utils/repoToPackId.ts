/**
 * Heuristic mapping from a GitHub repo identifier to a Comfy Registry pack id.
 *
 * The Comfy Registry doesn't expose a "lookup by GitHub URL" endpoint, so we
 * approximate: the publisher uploads the pack under a slug that matches the
 * lowercased repo name. Works for the majority of well-known packs in the
 * top-20 dataset (e.g. `Comfy-Org/ComfyUI-Manager` → `comfyui-manager`,
 * `rgthree/rgthree-comfy` → `rgthree-comfy`).
 *
 * Accepted inputs:
 *   - `org/repo`                → `repo` lowercased
 *   - `org__repo`               → `repo` lowercased (worktree-style flat keys)
 *   - `https://github.com/org/repo[.git]` → `repo` lowercased
 *
 * Returns `null` if the input can't be parsed into something repo-shaped.
 * Callers should treat this as a guess and fall back to a GitHub avatar/repo
 * card when the registry returns 404.
 */
export function repoToPackId(input: string): string | null {
  if (!input) return null;

  let repoPath = input.trim();

  // URL-shaped inputs must be GitHub URLs; otherwise we can't trust the
  // path layout to be `/org/repo`.
  if (/^[a-z]+:\/\//i.test(repoPath)) {
    const ghMatch = repoPath.match(
      /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/\s]+\/[^/\s?#]+)/i,
    );
    if (!ghMatch) return null;
    repoPath = ghMatch[1];
  }

  // Drop trailing .git
  repoPath = repoPath.replace(/\.git$/i, "");

  // Worktree flat-key form: org__repo → org/repo
  if (!repoPath.includes("/") && repoPath.includes("__")) {
    repoPath = repoPath.replace("__", "/");
  }

  const parts = repoPath.split("/").filter(Boolean);
  if (parts.length < 2) return null;

  return parts[parts.length - 1].toLowerCase();
}
