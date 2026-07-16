import argparse, json
from rental_intel.decisions.briefings import generate_due_briefings
def main():
 p=argparse.ArgumentParser(); p.add_argument("--owner-id"); a=p.parse_args(); print(json.dumps(generate_due_briefings(a.owner_id),indent=2))
if __name__=="__main__": main()
