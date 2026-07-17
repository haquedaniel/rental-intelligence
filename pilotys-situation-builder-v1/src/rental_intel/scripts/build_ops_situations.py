import argparse
import json

from rental_intel.decisions.situations import build_situations


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--owner-id")
    parser.add_argument("--lookback-days", type=int, default=7)
    args = parser.parse_args()
    print(
        json.dumps(
            build_situations(
                lookback_days=args.lookback_days,
                owner_id=args.owner_id,
            ),
            indent=2,
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
