import { createClientFromRequest } from 'npm:@base44/sdk@0.8.35';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const params = await req.json().catch(() => ({}));
  const sr = base44.asServiceRole || base44;

  // Support special actions for map / autocomplete (used by frontend)
  if (params.action === 'getSpeciesSuggestions') {
    const suggestions = await getSpeciesSuggestions(params.query || '', params.limit || 8, sr);
    return Response.json({ success: true, suggestions });
  }
  if (params.action === 'getSpeciesMapData') {
    const data = await getSpeciesMapData(params.speciesId || params.taxonId, sr);
    return Response.json({ success: true, ...data });
  }
  if (params.action === 'geocode') {
    const places = await geocodePlace(params.query || '');
    return Response.json({ success: true, places });
  }

  const { query = '', type = 'all', edibility, season, habitat, rarity, lat, lon, limit = 30, offset = 0 } = params;

  try {
    // 1. Curated local (fast path)
    let curated = await sr.entities.Taxon.list();
    
    // Filter
    if (type && type !== 'all') {
      curated = curated.filter((t: any) => t.type === type);
    }
    if (query) {
      const q = query.toLowerCase();
      curated = curated.filter((t: any) =>
        (t.common_name || '').toLowerCase().includes(q) ||
        (t.scientific_name || '').toLowerCase().includes(q) ||
        (t.key_features || []).some((f: string) => f.toLowerCase().includes(q)) ||
        (t.traditional_uses || []).some((u: string) => u.toLowerCase().includes(q))
      );
    }
    if (edibility) curated = curated.filter((t: any) => t.edibility === edibility);
    if (season) curated = curated.filter((t: any) => 
      (t.fruiting_season || t.flowering_or_fruiting_season || '').toLowerCase().includes(season.toLowerCase())
    );
    if (habitat) curated = curated.filter((t: any) => (t.habitat || '').toLowerCase().includes(habitat.toLowerCase()));
    if (rarity) curated = curated.filter((t: any) => t.rarity === rarity);

    // Attach caught status (simplified - in prod join with UserCollection)
    const results = curated.map((t: any) => ({ ...t, source: 'curated', caught: false }));

    // 2. Live external (hybrid for ALL species) - parallel for speed
    let liveResults: any[] = [];
    const externalPromises = [];

    if (!type || type === 'all' || type === 'fungus') {
      externalPromises.push(fetchGBIFSpecies(query, 'fungi', lat, lon));
    }
    if (!type || type === 'all' || type === 'plant') {
      externalPromises.push(fetchPOWOSpecies(query, lat, lon));
      externalPromises.push(fetchINatTaxa(query, 'plants'));
    }

    const externalSettled = await Promise.allSettled(externalPromises);
    
    for (const res of externalSettled) {
      if (res.status === 'fulfilled' && res.value) {
        liveResults = liveResults.concat(res.value.map((r: any) => ({ ...r, source: 'live', caught: false })));
      }
    }

    // Dedup + merge (curated first)
    const merged = [...results];
    const seen = new Set(results.map((r: any) => (r.scientific_name || '').toLowerCase()));
    
    for (const live of liveResults) {
      const key = (live.scientific_name || live.name || '').toLowerCase();
      if (!seen.has(key)) {
        merged.push(live);
        seen.add(key);
      }
    }

    // Pagination
    const paginated = merged.slice(offset, offset + limit);

    return Response.json({ 
      success: true, 
      results: paginated, 
      total: merged.length,
      curatedCount: results.length,
      liveCount: liveResults.length,
      source: 'hybrid'
    });
  } catch (e) {
    console.error('searchHybridTaxa error', e);
    return Response.json({ success: false, error: e.message });
  }
});

// Helper implementations (rapid, public APIs) + Map integration helpers
async function fetchGBIFSpecies(q: string, kingdom: string, lat?: number, lon?: number) {
  if (!q) return [];
  const url = `https://api.gbif.org/v1/species/search?q=${encodeURIComponent(q)}&rank=SPECIES&limit=20` + 
    (kingdom === 'fungi' ? '&kingdom=Fungi' : '');
  const res = await fetch(url);
  const data = await res.json();
  return (data.results || []).map((r: any) => ({
    scientific_name: r.scientificName,
    common_name: r.canonicalName,
    type: kingdom === 'fungi' ? 'fungus' : 'plant',
    source_details: 'GBIF',
    gbif_key: r.key
  }));
}

async function fetchPOWOSpecies(q: string, lat?: number, lon?: number) {
  if (!q) return [];
  const url = `http://powo.science.kew.org/api/2/search?q=${encodeURIComponent(q)}&perPage=15`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    return (data.results || []).map((r: any) => ({
      scientific_name: r.name,
      common_name: r.name,
      type: 'plant',
      source_details: 'POWO',
      external_ids: { powo: r.id }
    }));
  } catch { return []; }
}

async function fetchINatTaxa(q: string, iconic_taxon: string) {
  if (!q) return [];
  const url = `https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(q)}&per_page=10&rank=species`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    return (data.results || []).filter((r: any) => r.iconic_taxon_name === (iconic_taxon === 'plants' ? 'Plantae' : null)).map((r: any) => ({
      scientific_name: r.name,
      common_name: r.preferred_common_name,
      type: iconic_taxon === 'plants' ? 'plant' : 'fungus',
      source_details: 'iNaturalist'
    }));
  } catch { return []; }
}

// New: Geocode places using free Nominatim (for map search) - returns for autocomplete
async function geocodePlace(query: string) {
  if (!query || query.length < 2) return [];
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'ShroomFinder/1.0' } });
    const data = await res.json();
    return data.map((item: any) => ({
      type: 'place',
      name: item.display_name,
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon),
      source: 'Nominatim'
    }));
  } catch { return []; }
}

// Self-contained helper: Get species suggestions (DB connected autocomplete)
async function getSpeciesSuggestions(query: string, limit: number = 8, srParam?: any) {
  if (!query || query.length < 2) return [];
  try {
    const sr = srParam || { entities: { Taxon: { list: async () => [] } } };
    const taxa = await (sr.entities?.Taxon?.list?.({ limit: 150 }) || []);
    const q = query.toLowerCase();
    const matches = (taxa || [])
      .filter((t: any) => 
        (t.common_name || '').toLowerCase().includes(q) || 
        (t.scientific_name || '').toLowerCase().includes(q)
      )
      .slice(0, limit)
      .map((t: any) => ({
        type: 'species',
        id: t.id,
        name: t.common_name,
        scientific: t.scientific_name,
        taxon_type: t.type,
        psychoactive: !!(t.psychoactive_compounds && t.psychoactive_compounds.length),
        rarity: t.rarity
      }));
    return matches;
  } catch { return []; }
}

// Self-contained: Get map data for a species (layers)
async function getSpeciesMapData(speciesId: string, srParam?: any) {
  try {
    const sr = srParam || { entities: { Taxon: { get: async () => null }, Observation: { list: async () => [] } }, functions: { invoke: async () => ({}) } };
    const taxon = await (sr.entities?.Taxon?.get?.(speciesId) || null);
    if (!taxon) return { taxon: null, observations: [], predictions: [] };

    const observations = await (sr.entities?.Observation?.list?.({ filter: { taxon_id: speciesId }, limit: 50 }) || []);

    let predictions: any = {};
    try {
      predictions = await sr.functions.invoke('predictLocation', { lat: 0, lon: 0, taxonId: speciesId }).catch(() => ({}));
    } catch {}

    return {
      taxon,
      observations: (observations || []).map((o: any) => ({ lat: o.lat, lon: o.lon, date: o.date_found })),
      predictions: predictions.results || predictions.predictions || []
    };
  } catch { return { taxon: null, observations: [], predictions: [] }; }
}