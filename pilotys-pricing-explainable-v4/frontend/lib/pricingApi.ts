export async function callPricingApi(path: string, body: Record<string, unknown>) {
  const base = process.env.PRICING_API_URL || "http://pricing-api:8010";
  const secret = process.env.PRICING_INTERNAL_SECRET;
  if (!secret) throw new Error("PRICING_INTERNAL_SECRET is not configured.");
  const response = await fetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json", "x-pricing-internal-secret": secret }, body: JSON.stringify(body), cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.ok) throw new Error(payload.message || payload.error || `Pricing API ${response.status}`);
  return payload.result;
}
