from __future__ import annotations

import argparse
import hashlib
from io import BytesIO
from pathlib import PurePosixPath

from PIL import Image, ImageOps

from rental_intel.cleaning.db import get_supabase_client


MAX_WIDTH = 1600
QUALITY = 78


def optimized_path(original_path: str) -> str:
    path = PurePosixPath(original_path)
    digest = hashlib.sha1(original_path.encode("utf-8")).hexdigest()[:10]
    stem = path.stem or "photo"
    return str(path.parent / "optimized" / f"{stem}-{digest}.webp")


def optimize_image(raw: bytes) -> bytes:
    image = Image.open(BytesIO(raw))
    image = ImageOps.exif_transpose(image)

    if image.mode not in ("RGB", "L"):
        image = image.convert("RGB")

    width, height = image.size
    if width > MAX_WIDTH:
        new_height = round(height * (MAX_WIDTH / width))
        image = image.resize((MAX_WIDTH, new_height), Image.Resampling.LANCZOS)

    output = BytesIO()
    image.save(output, format="WEBP", quality=QUALITY, method=6)
    return output.getvalue()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int, default=500)
    args = parser.parse_args()

    supabase = get_supabase_client()

    rows = (
        supabase.table("property_reference_photos")
        .select("id,storage_bucket,storage_path,original_storage_path,optimized_at,is_active")
        .eq("is_active", True)
        .is_("optimized_at", "null")
        .limit(args.limit)
        .execute()
        .data
        or []
    )

    print(f"Found {len(rows)} active reference photo(s).")

    optimized_count = 0
    skipped_count = 0

    for row in rows:
        photo_id = row["id"]
        bucket = row.get("storage_bucket")
        path = row.get("storage_path")

        if not bucket or not path:
            skipped_count += 1
            continue

        if row.get("optimized_at") or "/optimized/" in path:
            skipped_count += 1
            continue

        target_path = optimized_path(path)

        print()
        print(f"Photo {photo_id}")
        print(f"  source: {bucket}/{path}")
        print(f"  target: {bucket}/{target_path}")

        if args.dry_run:
            continue

        raw = supabase.storage.from_(bucket).download(path)
        if not raw:
            print("  skipped: empty download")
            skipped_count += 1
            continue

        optimized = optimize_image(raw)

        supabase.storage.from_(bucket).upload(
            target_path,
            optimized,
            {
                "content-type": "image/webp",
                "upsert": "true",
            },
        )

        update = {
            "original_storage_bucket": bucket,
            "original_storage_path": path,
            "storage_path": target_path,
            "optimized_at": "now()",
            "original_size_bytes": len(raw),
            "optimized_size_bytes": len(optimized),
        }

        # Supabase/PostgREST will not evaluate "now()" inside JSON updates,
        # so use an ISO timestamp from the DB would be better later. For now,
        # set optimized_at with a second update using RPC would be overkill.
        # Replace with Python UTC timestamp.
        from datetime import datetime, timezone

        update["optimized_at"] = datetime.now(timezone.utc).isoformat()

        supabase.table("property_reference_photos").update(update).eq("id", photo_id).execute()

        saved = len(raw) - len(optimized)
        pct = round((saved / len(raw)) * 100) if raw else 0
        print(f"  done: {len(raw)} → {len(optimized)} bytes, saved {pct}%")

        optimized_count += 1

    print()
    print(f"Optimized: {optimized_count}")
    print(f"Skipped: {skipped_count}")


if __name__ == "__main__":
    main()
