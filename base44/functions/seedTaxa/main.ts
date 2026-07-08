import { createClientFromRequest } from 'npm:@base44/sdk@0.8.35';

const SAMPLE_TAXA = [
  { type: 'fungus', common_name: 'Chanterelle', scientific_name: 'Cantharellus cibarius', rarity: 'common', edibility: 'safe', fruiting_season: 'summer, autumn', habitat: 'coniferous and mixed forests', key_features: ['vase-shaped', 'false gills', 'apricot smell'] },
  { type: 'fungus', common_name: 'Fly Agaric', scientific_name: 'Amanita muscaria', rarity: 'common', edibility: 'toxic', fruiting_season: 'autumn', habitat: 'birch and pine woods', key_features: ['red cap with white warts'], toxicity_or_safety_notes: 'Psychoactive and toxic' },
  { type: 'plant', common_name: 'Yarrow', scientific_name: 'Achillea millefolium', rarity: 'common', traditional_uses: ['wound healing', 'fever'], habitat: 'meadows', flowering_or_fruiting_season: 'summer', phytochemical_notes: 'Achilleine' },
  { type: 'plant', common_name: 'Elderberry', scientific_name: 'Sambucus nigra', rarity: 'common', traditional_uses: ['immune support'], habitat: 'hedgerows', flowering_or_fruiting_season: 'late summer', recipes: [{ name: 'Elderberry Syrup', safe: true }] }
];

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const sr = base44.asServiceRole || base44;

  const results = [];
  for (const sample of SAMPLE_TAXA) {
    const existing = await sr.entities.Taxon.list({ filter: { scientific_name: sample.scientific_name, type: sample.type } });
    if (existing.length === 0) {
      const created = await sr.entities.Taxon.create({ ...sample, source: 'seedTaxa', last_enriched: new Date().toISOString(), is_active: true });
      results.push({ action: 'created', id: created.id });
    } else {
      results.push({ action: 'exists', id: existing[0].id });
    }
  }
  return Response.json({ success: true, seeded: results });
});