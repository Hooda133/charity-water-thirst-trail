#!/usr/bin/env python3
"""Curated CC0 asset downloader for Thirst Trail. Python 3.11+, stdlib only.

No scraping, logins, marketplace bypass, executable extraction, or overwriting files.
Asset files are staged in assets/upgraded_graphics; the workflow commits them.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "assets" / "upgraded_graphics"
USER_AGENT = "ThirstTrail-CC0-Importer/1.0 (educational GitHub Actions project)"
MAX_ARCHIVE_BYTES = 40 * 1024 * 1024
MAX_FILE_BYTES = 8 * 1024 * 1024
MAX_PACK_BYTES = 25 * 1024 * 1024
MAX_TOTAL_BYTES = 55 * 1024 * 1024
FORMATS = {".glb", ".gltf", ".fbx", ".png", ".jpg", ".jpeg", ".webp", ".bin"}
LICENSES = {"CC0-1.0", "CC-BY-4.0", "CC-BY-3.0"}

# Pin a known CC0 Kenney mirror to a specific immutable Git commit.
# https://github.com/Hidencod/tge-assets/blob/main/LICENSE credits Kenney under CC0.
# The original Kenney archive endpoint returns HTTP 403 from GitHub Actions,
# so the mirrored self-contained GLBs are more reliable for automation.
KENNEY_MIRROR = "https://github.com/Hidencod/tge-assets"
KENNEY_COMMIT = "e26d410c77163293bcf3c07614e024552a308c69"
KENNEY_SELECTION = {
    "nature-kit": [
        "tree-oak.glb", "tree-default.glb", "tree-palmdetailedshort.glb",
        "tree-palmdetailedtall.glb", "rock-largea.glb", "rock-smalla.glb",
        "cactus-short.glb", "cactus-tall.glb", "flower-yellowa.glb",
        "flower-purplea.glb", "grass.glb", "bridge-wood.glb",
        "fence-simple.glb", "fence-gate.glb",
    ],
    "city-kit-suburban": [
        "building-type-a.glb", "building-type-c.glb",
        "planter.glb", "tree-small.glb",
    ],
    "pirate-kit": [
        "palm-detailed-straight.glb", "boat-row-small.glb",
        "structure-platform-dock-small.glb", "barrel.glb",
    ],
    "mini-characters": [
        "character-female-a.glb", "character-male-a.glb",
    ],
}


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def safe_url(url: str, provider: str) -> None:
    p = urllib.parse.urlsplit(url)
    if p.scheme != "https" or not p.hostname or p.username or p.password:
        raise ValueError(f"Only public HTTPS downloads are supported: {url}")
    host = p.hostname.lower()
    approved = {
        "kenney": {"kenney.nl", "raw.githubusercontent.com"},
        "ambientcg": {"ambientcg.com", "www.ambientcg.com"},
        "poly_pizza_api": {"api.poly.pizza"},
        "poly_pizza": {"poly.pizza", "static.poly.pizza", "cdn.poly.pizza", "assets.poly.pizza"},
        "quaternius": {"quaternius.com", "www.quaternius.com", "raw.githubusercontent.com", "github.com"},
        "fab": {"fab.com", "www.fab.com", "raw.githubusercontent.com", "github.com"},
    }
    if host not in approved[provider]:
        raise ValueError(f"Unapproved {provider} download host: {host}")


def fetch(url: str, provider: str, limit: int = MAX_ARCHIVE_BYTES,
          headers: dict[str, str] | None = None) -> bytes:
    safe_url(url, provider)
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, **(headers or {})})
    with urllib.request.urlopen(request, timeout=45) as response:
        # The initial URL must be trusted; redirects must at least remain HTTPS.
        if urllib.parse.urlsplit(response.geturl()).scheme != "https":
            raise ValueError("Refusing insecure redirect")
        if response.headers.get("Content-Length") and int(response.headers["Content-Length"]) > limit:
            raise ValueError("Download exceeds size limit")
        data = response.read(limit + 1)
    if len(data) > limit:
        raise ValueError("Download exceeds size limit")
    return data


def safe_path(name: str) -> PurePosixPath:
    if "\\" in name or name.startswith("/") or not name or "\x00" in name:
        raise ValueError(f"Unsafe archive path: {name!r}")
    path = PurePosixPath(name)
    if ".." in path.parts or "." in path.parts:
        raise ValueError(f"Unsafe archive path: {name!r}")
    return path


def valid_asset(path: PurePosixPath, data: bytes) -> None:
    if path.suffix.lower() not in FORMATS:
        raise ValueError(f"Unsupported file extension: {path}")
    if len(data) > MAX_FILE_BYTES:
        raise ValueError(f"Asset too large: {path}")
    if path.suffix.lower() == ".glb" and (len(data) < 12 or data[:4] != b"glTF"):
        raise ValueError(f"Invalid GLB header: {path}")
    if path.suffix.lower() == ".png" and not data.startswith(b"\x89PNG\r\n\x1a\n"):
        raise ValueError(f"Invalid PNG: {path}")


def remember(relative: str, data: bytes, *, provider: str, source: str,
             license_id: str, records: dict, creator: str = "",
             download_url: str = "") -> None:
    if license_id not in LICENSES:
        raise ValueError(f"Unapproved license for {source}: {license_id}")
    if license_id.startswith("CC-BY") and not creator.strip():
        raise ValueError("CC-BY assets require a credited creator")
    relative_path = safe_path(relative)
    valid_asset(relative_path, data)
    target = OUTPUT.joinpath(*relative_path.parts)
    if not target.resolve().is_relative_to(OUTPUT.resolve()):
        raise ValueError("Asset attempted to escape target directory")
    if target.exists():
        if sha(target.read_bytes()) != sha(data):
            raise ValueError(f"Refusing to overwrite existing asset: {target}")
    else:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        print(f"Added {target.relative_to(ROOT)} ({len(data):,} bytes)")
    records[relative] = {"source": source, "provider": provider,
                         "license": license_id, "creator": creator,
                         "license_url": "https://creativecommons.org/publicdomain/zero/1.0/" if license_id == "CC0-1.0" else "https://creativecommons.org/licenses/by/" + license_id.split("-")[-1] + "/",
                         "download_url": download_url,
                         "sha256": sha(data), "bytes": len(data)}
    if sum(row["bytes"] for row in records.values()) > MAX_TOTAL_BYTES:
        raise ValueError("Total curated asset budget exceeded")


def unpack_archive(archive: bytes, allowed: list[str] | None, prefix: str, *,
                   provider: str, source: str, license_id: str, records: dict,
                   creator: str = "") -> None:
    with zipfile.ZipFile(io.BytesIO(archive)) as z:
        candidates = {i.filename: i for i in z.infolist() if not i.is_dir()}
        picks = allowed or [n for n in candidates if PurePosixPath(n).suffix.lower() in FORMATS]
        if len(picks) > 100:
            raise ValueError("Archive contains too many selected files")
        total = 0
        for name in picks:
            safe_path(name)
            info = candidates.get(name)
            if info is None:
                raise ValueError(f"Required archive member missing: {name}")
            # Unix symlinks can traverse out of the target; never extract them.
            if ((info.external_attr >> 16) & 0o170000) == 0o120000:
                raise ValueError("Archive symlinks are not allowed")
            total += info.file_size
            if info.file_size > MAX_FILE_BYTES or total > MAX_PACK_BYTES:
                raise ValueError("Archive extraction limit exceeded")
            # Preserve texture dependencies beside Survival Kit GLBs.
            parts = PurePosixPath(name).parts
            rel = "/".join(parts[2:]) if provider == "kenney" else "/".join(parts)
            if not rel:
                continue
            with z.open(info) as stream:
                data = stream.read(MAX_FILE_BYTES + 1)
            remember(f"{prefix}/{rel}", data, provider=provider,
                     source=source, license_id=license_id, creator=creator, records=records)


def import_kenney(records: dict) -> None:
    """Import small, professionally authored CC0 GLBs from a pinned GitHub mirror."""
    for pack, files in KENNEY_SELECTION.items():
        print("Fetching CC0 Kenney models:", pack)
        source_page = f"https://kenney.nl/assets/{pack}"
        if pack == "mini-characters":
            source_page = "https://kenney.nl/assets/mini-characters"
        for filename in files:
            if not re.fullmatch(r"[a-z0-9-]+\.glb", filename):
                raise ValueError("Unexpected curated model name")
            url = (f"https://raw.githubusercontent.com/Hidencod/tge-assets/"
                   f"{KENNEY_COMMIT}/packs/{pack}/{filename}")
            data = fetch(url, "kenney", MAX_FILE_BYTES)
            remember(f"kenney/{pack}/{filename}", data, provider="kenney",
                     source=source_page, license_id="CC0-1.0", creator="Kenney",
                     records=records, download_url=url)


def import_ambientcg(records: dict) -> None:
    for query in ("rock", "wood"):
        url = "https://ambientcg.com/api/v3/assets?" + urllib.parse.urlencode({
            "type": "material", "q": query, "limit": 5, "sort": "popular", "include": "title,downloads"})
        catalog = json.loads(fetch(url, "ambientcg", 3 * 1024 * 1024))
        options = catalog.get("assets", [])
        selected = None
        for asset in options:
            for candidate in asset.get("downloads", []):
                if candidate.get("attributes") == "1K-JPG" and candidate.get("extension") == "zip":
                    selected = asset, candidate
                    break
            if selected:
                break
        if not selected:
            raise ValueError(f"No small CC0 ambientCG texture set available for: {query}")
        asset, download = selected
        asset_id = str(asset["id"])
        if not re.fullmatch(r"[A-Za-z0-9_-]{3,70}", asset_id):
            raise ValueError("Invalid ambientCG asset ID")
        print("Fetching CC0 ambientCG", asset_id)
        archive = fetch(download["url"], "ambientcg")
        unpack_archive(archive, None, f"ambientcg/{asset_id}", provider="ambientcg",
                       source=f"https://ambientcg.com/a/{asset_id}",license_id="CC0-1.0",records=records)


def import_poly_pizza(records: dict, token: str) -> None:
    # Optional; API responses differ across versions. Missing/incomplete CC0 metadata is rejected.
    for query in ("tree", "water well"):
        url = "https://api.poly.pizza/v1/search/" + urllib.parse.quote(query)
        result = json.loads(fetch(url, "poly_pizza_api", 2 * 1024 * 1024,
                                  {"X-Auth-Token": token}))
        for item in result.get("results", [])[:8]:
            license_raw = str(item.get("Licence", item.get("License", ""))).strip().upper()
            if license_raw not in {"CC0", "CC0-1.0"}:
                continue  # All CC-BY and unverified licenses excluded by default.
            asset_id = str(item.get("ID", item.get("id", "")))
            url = item.get("Download")
            if not re.fullmatch(r"[A-Za-z0-9_-]{3,80}",asset_id) or not url:
                continue
            try:
                data = fetch(url, "poly_pizza", MAX_FILE_BYTES)
            except (urllib.error.URLError, ValueError) as exc:
                print(f"Skipping unavailable Poly Pizza asset {asset_id}: {exc}")
                continue
            remember(f"poly_pizza/{asset_id}.glb", data,provider="poly_pizza",
                     source=f"https://poly.pizza/m/{asset_id}",license_id="CC0-1.0",records=records)
            break  # At most one curated model per keyword.


def import_explicit(records: dict, manifest_path: Path) -> None:
    if not manifest_path.exists():
        return
    config = json.loads(manifest_path.read_text(encoding="utf-8"))
    for item in config.get("downloads", []):
        provider = item["provider"]
        if provider not in {"quaternius", "fab"}:
            raise ValueError("Explicit entries are reserved for Fab and Quaternius")
        license_id = item["license"]
        if license_id not in LICENSES:
            raise ValueError("Unknown/unsupported Creative Commons license")
        expected = item["sha256"].lower()
        if not re.fullmatch(r"[a-f0-9]{64}",expected):
            raise ValueError("Every direct download needs a verified SHA-256")
        url = item["url"]
        data = fetch(url,provider)
        if sha(data) != expected:
            raise ValueError(f"Checksum mismatch for {url}")
        prefix = provider + "/" + re.sub(r"[^A-Za-z0-9_-]", "_",item["name"])
        meta = dict(provider=provider, source=item["source_page"],
                    license_id=license_id,creator=item.get("creator",""),records=records)
        if item.get("format") == "zip":
            if not item.get("members"):
                raise ValueError("Curated zip entries require explicit safe members")
            unpack_archive(data,item["members"],prefix,**meta)
        else:
            filename=PurePosixPath(urllib.parse.urlsplit(url).path).name
            remember(f"{prefix}/{filename}",data,**meta)


def main() -> int:
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--include-poly-pizza",action="store_true",help="Use optional POLY_PIZZA_API_KEY")
    parser.add_argument("--skip-ambientcg",action="store_true",help="Skip additional CC0 PBR materials")
    parser.add_argument("--skip-kenney",action="store_true",help="Skip curated Kenney packs")
    args=parser.parse_args()
    OUTPUT.mkdir(parents=True,exist_ok=True)
    manifest=OUTPUT/"manifest.json"
    # Rebuild a deterministic manifest; untouched existing assets are never removed.
    old=json.loads(manifest.read_text(encoding="utf-8")) if manifest.exists() else {"assets":{}}
    records=old.get("assets",{})
    if not args.skip_kenney:
        import_kenney(records)
    if not args.skip_ambientcg:
        import_ambientcg(records)
    if args.include_poly_pizza:
        key=os.getenv("POLY_PIZZA_API_KEY","")
        if not key:
            print("Poly Pizza skipped: add POLY_PIZZA_API_KEY as an Actions secret")
        else:
            import_poly_pizza(records,key)
    import_explicit(records,ROOT/"tools"/"asset_sources.json")
    manifest.write_text(json.dumps({"schema_version":1,"assets":dict(sorted(records.items()))},
                                   indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
    print(f"Ready: {len(records)} assets (no existing files overwritten).")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, ValueError, KeyError, zipfile.BadZipFile, urllib.error.URLError) as exc:
        print(f"Asset import stopped safely: {exc}",file=sys.stderr)
        sys.exit(1)
