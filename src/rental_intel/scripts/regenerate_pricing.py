from __future__ import annotations
import argparse
from rental_intel.pricing.engine import regenerate

def main():
    p=argparse.ArgumentParser();p.add_argument("--property-id");a=p.parse_args();print(f"Daily prices regenerated: {regenerate(a.property_id)}")
if __name__=="__main__":main()
