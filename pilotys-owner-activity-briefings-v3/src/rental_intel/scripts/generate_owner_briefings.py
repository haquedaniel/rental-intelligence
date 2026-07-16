import argparse
import json

from rental_intel.decisions.briefings import (
    generate_due_briefings,
    process_preview_requests,
)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--owner-id")
    parser.add_argument("--previews-only", action="store_true")
    args = parser.parse_args()

    previews = process_preview_requests()
    scheduled = [] if args.previews_only else generate_due_briefings(args.owner_id)
    print(json.dumps({"previews": previews, "scheduled": scheduled}, indent=2))


if __name__ == "__main__":
    main()
