from __future__ import annotations

from datetime import date, timedelta

import pandas as pd

from rental_intel.ui.data import read_processed_csv
from rental_intel.ui.data_supabase import build_operating_map_inputs, get_supabase_client


def main() -> None:
    print("Supabase client:", bool(get_supabase_client()))

    reservations = read_processed_csv("normalized_reservations.csv")
    print("local reservations:", len(reservations))
    if not reservations.empty:
        print("local columns:", ", ".join(reservations.columns))
        if "source_booking_id" in reservations.columns:
            print("local reservations with source_booking_id:", reservations["source_booking_id"].notna().sum())

    today = date.today()
    start = today - timedelta(days=30)
    end = today + timedelta(days=120)

    result = build_operating_map_inputs(reservations, start, end)
    print("diagnostics:", result.diagnostics)

    print("\nproperty bridge:")
    if result.property_bridge_df.empty:
        print("  <empty>")
    else:
        print(result.property_bridge_df.to_string(index=False))

    print("\nlisting metadata:")
    if result.listing_meta_df.empty:
        print("  <empty>")
    else:
        cols = [c for c in ["listing_id", "listing_name", "supabase_property_id", "property_name", "image_url"] if c in result.listing_meta_df.columns]
        df = result.listing_meta_df[cols].copy()
        if "image_url" in df.columns:
            df["has_image"] = df["image_url"].astype(str).str.len() > 0
            df = df.drop(columns=["image_url"])
        print(df.to_string(index=False))

    print("\ncleaning events:")
    if result.cleaning_df.empty:
        print("  <empty>")
    else:
        cols = [c for c in ["listing_id", "date", "status", "cleaner_name", "window_start", "window_end", "cleaning_request_id"] if c in result.cleaning_df.columns]
        print(result.cleaning_df[cols].head(30).to_string(index=False))


if __name__ == "__main__":
    main()
