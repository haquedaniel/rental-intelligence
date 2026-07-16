from __future__ import annotations
import argparse
from rental_intel.pricing.publisher import publish

def main():
 p=argparse.ArgumentParser();p.add_argument("--property-id");p.add_argument("--limit",type=int,default=100);p.add_argument("--dry-run",action="store_true");a=p.parse_args();print(f"Pricing actions applied: {publish(a.property_id,a.limit,a.dry_run)}")
if __name__=="__main__":main()
