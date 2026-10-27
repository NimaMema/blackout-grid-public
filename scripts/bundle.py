"""Create a clean, reproducible source download. Run before the frontend build.

Only explicitly approved project files are packaged (an allowlist). Everything else is
skipped: unknown files, hidden files, credentials, build output, local data, and any
symlink. A path is also skipped if it resolves outside the project root.
"""
import os
import sys
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED

root = Path(__file__).resolve().parents[1]
out = root / "public" / "downloads" / "blackout-source.zip"

# Individual files allowed at the project root.
ROOT_FILES = {
    "README.md", "LICENSE", "package.json", "package-lock.json", "index.html",
    "vite.config.js", "compose.yaml", ".gitignore", ".dockerignore", ".env.example",
}
# Directories whose contents may be packaged, subject to the extension allowlist.
ROOT_DIRS = {"src", "public", "tests", "scripts", "docker", "docs", "server", ".github"}
# Allowed file types inside those directories.
EXTENSIONS = {
    ".js", ".mjs", ".css", ".html", ".svg", ".jpg", ".png", ".md", ".py",
    ".yml", ".yaml", ".conf", ".Dockerfile", ".java", ".xml", ".properties", ".sql",
}
# Specific extensionless or unusual files allowed by relative path.
EXTRA_FILES = {
    "server/api/src/test/resources/mockito-extensions/org.mockito.plugins.MockMaker",
}
# Directory names never descended into, wherever they appear.
SKIP_DIRS = {"node_modules", "dist", "target", "data", "artifacts", "downloads", "__pycache__"}
# Hidden names allowed in paths (all other dot-files and dot-directories are skipped).
HIDDEN_OK = {".github", ".gitignore", ".dockerignore", ".env.example"}


def inside_root(path: Path) -> bool:
    try:
        path.resolve(strict=True).relative_to(root)
        return True
    except (OSError, ValueError):
        return False


def approved(rel: Path) -> bool:
    parts = rel.parts
    if any(p.startswith(".") and p not in HIDDEN_OK for p in parts):
        return False
    if len(parts) == 1:
        return parts[0] in ROOT_FILES
    if parts[0] not in ROOT_DIRS or any(p in SKIP_DIRS for p in parts[:-1]):
        return False
    if parts[0] == ".github" and parts[1] != "workflows":
        return False
    return rel.as_posix() in EXTRA_FILES or rel.suffix in EXTENSIONS


def collect():
    files, skipped = [], []
    for name in sorted(ROOT_FILES):
        p = root / name
        if p.is_symlink():
            skipped.append(name + " (symlink)")
        elif p.is_file() and inside_root(p):
            files.append(p)
    for top in sorted(ROOT_DIRS):
        base = root / top
        if base.is_symlink() or not base.is_dir():
            if base.is_symlink():
                skipped.append(top + "/ (symlink)")
            continue
        for dirpath, dirnames, filenames in os.walk(base, followlinks=False):
            here = Path(dirpath)
            keep = []
            for d in sorted(dirnames):
                full = here / d
                if full.is_symlink():
                    skipped.append(full.relative_to(root).as_posix() + "/ (symlink)")
                elif d not in SKIP_DIRS and (not d.startswith(".") or d in HIDDEN_OK):
                    keep.append(d)
            dirnames[:] = keep
            for f in sorted(filenames):
                full = here / f
                rel = full.relative_to(root)
                if full.is_symlink():
                    skipped.append(rel.as_posix() + " (symlink)")
                elif full.is_file() and approved(rel) and inside_root(full):
                    files.append(full)
                else:
                    skipped.append(rel.as_posix())
    return files, skipped


files, skipped = collect()
out.parent.mkdir(parents=True, exist_ok=True)
with ZipFile(out, "w", ZIP_DEFLATED, compresslevel=9) as archive:
    for path in files:
        rel = path.relative_to(root)
        info = ZipInfo(str(Path("blackout") / rel), date_time=(2026, 1, 1, 0, 0, 0))
        info.compress_type = ZIP_DEFLATED
        info.external_attr = 0o644 << 16
        archive.writestr(info, path.read_bytes())
print(str(out))
print(str(len(files)) + " source files; " + str(out.stat().st_size) + " bytes")
if skipped:
    print("Skipped (not on the allowlist): " + ", ".join(skipped), file=sys.stderr)
