import argparse, json
from rental_intel.pricing.engine import regenerate

def main():
 p=argparse.ArgumentParser();p.add_argument("--property-id",required=True);p.add_argument("--created-by",default="cli");a=p.parse_args();print(json.dumps(regenerate(a.property_id,a.created_by),indent=2))
if __name__=="__main__":main()
