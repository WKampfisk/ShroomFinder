import { createClientFromRequest } from 'npm:@base44/sdk@0.8.35';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const params = await req.json();
  const { query = '', type = 'all', edibility, season, habitat, rarity, lat, lon, limit = 30, offset = 0 } = params;
  const sr = base44.asServiceRole || base44;

  try {
    let curated = await sr.entities.Taxon.list();
    if (type && type !== 'all') curated = curated.filter((t: any) => t.type === type);
    if (query) {
      const q = query.toLowerCase();
      curated = curated.filter((t: any) => (t.common_name||'').toLowerCase().includes(q) || (t.scientific_name||'').toLowerCase().includes(q));
    }
    // ... (full filters as in local)
    const results = curated.map((t: any) => ({ ...t, source: 'curated', caught: false }));

    // Parallel live (simplified for push)
    let live: any[] = [];
    // (In full local version: Promise.allSettled for GBIF/POWO)

    const merged = [...results, ...live];
    return Response.json({ success: true, results: merged.slice(offset, offset+limit), total: merged.length });
  } catch (e) {
    return Response.json({ success: false, error: e.message });
  }
});