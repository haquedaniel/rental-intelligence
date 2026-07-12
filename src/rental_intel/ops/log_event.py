from __future__ import annotations

import argparse
import hashlib
import json
import sys
from typing import Any

from rental_intel.cleaning.db import get_supabase_client


def parse_context(raw: str | None) -> dict[str, Any] | None:
    if not raw:
        return None

    try:
        value = json.loads(raw)
        return value if isinstance(value, dict) else {"value": value}
    except Exception as exc:
        return {"context_parse_error": str(exc), "raw": raw}


def main() -> int:
    parser = argparse.ArgumentParser(description="Write an operational event to Supabase.")
    parser.add_argument("--event-type", required=True)
    parser.add_argument("--severity", default="info")
    parser.add_argument("--source", default="cron_script")
    parser.add_argument("--job-name")
    parser.add_argument("--run-id")
    parser.add_argument("--title")
    parser.add_argument("--summary")
    parser.add_argument("--reason-code")
    parser.add_argument("--event-key")
    parser.add_argument("--context-json")

    args = parser.parse_args()

    context = parse_context(args.context_json)

    fingerprint = hashlib.sha1(
        "|".join(
            [
                args.job_name or "",
                args.run_id or "",
                args.event_type or "",
                args.summary or "",
            ]
        ).encode("utf-8")
    ).hexdigest()[:12]

    event_key = args.event_key or f"ops:{args.job_name or 'unknown'}:{args.run_id or 'no_run'}:{args.event_type}:{fingerprint}"

    payload = {
        "event_type": args.event_type,
        "severity": args.severity,
        "source": args.source,
        "job_name": args.job_name,
        "run_id": args.run_id,
        "title": args.title,
        "summary": args.summary,
        "reason_code": args.reason_code,
        "event_key": event_key,
        "context": context,
    }

    payload = {key: value for key, value in payload.items() if value is not None}

    try:
        supabase = get_supabase_client()
        supabase.table("operational_event_log").insert(payload).execute()
    except Exception as exc:
        # Logging must never break cron jobs.
        print(f"WARNING: failed to write operational event: {exc}", file=sys.stderr)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
