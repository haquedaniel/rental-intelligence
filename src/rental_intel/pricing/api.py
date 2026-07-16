from __future__ import annotations
import json, os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from rental_intel.pricing.engine import regenerate, rollback

SECRET=os.environ.get("PRICING_INTERNAL_SECRET","")
class Handler(BaseHTTPRequestHandler):
 def _send(self,status,payload):
  body=json.dumps(payload,default=str).encode();self.send_response(status);self.send_header("Content-Type","application/json");self.send_header("Content-Length",str(len(body)));self.end_headers();self.wfile.write(body)
 def do_GET(self):self._send(200,{"ok":True,"service":"pilotys-pricing-api"}) if self.path=="/health" else self._send(404,{"error":"not_found"})
 def do_POST(self):
  if not SECRET or self.headers.get("X-Pricing-Internal-Secret")!=SECRET:return self._send(401,{"error":"unauthorized"})
  try:
   data=json.loads(self.rfile.read(int(self.headers.get("Content-Length","0"))) or b"{}")
   if self.path=="/internal/pricing/regenerate":result=regenerate(str(data["property_id"]),data.get("created_by"),data.get("change_summary"))
   elif self.path=="/internal/pricing/rollback":result=rollback(str(data["property_id"]),str(data["target_version_id"]),data.get("created_by"))
   else:return self._send(404,{"error":"not_found"})
   self._send(200,{"ok":True,"result":result})
  except Exception as e:self._send(500,{"ok":False,"error":type(e).__name__,"message":str(e)})
 def log_message(self,fmt,*args):print("pricing-api",fmt%args,flush=True)

def main():
 port=int(os.environ.get("PRICING_API_PORT","8010"));ThreadingHTTPServer(("0.0.0.0",port),Handler).serve_forever()
if __name__=="__main__":main()
