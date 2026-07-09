import { createClientFromRequest } from 'npm:@base44/sdk@0.8.35';

// Run this function once (via Base44 invoke or local script with service role) after pushing Taxon entity.
// It is idempotent by scientific_name + type.

const SAMPLE_TAXA = [
  // === PSYCHOACTIVE FUNGI (Mushrooms) - Comprehensive list ===
  { type: 'fungus', common_name: 'Chanterelle', scientific_name: 'Cantharellus cibarius', rarity: 'common', edibility: 'safe', fruiting_season: 'summer, autumn', habitat: 'coniferous and mixed forests', key_features: ['vase-shaped', 'false gills', 'apricot smell'], associated_trees: ['pine', 'oak'] },
  { type: 'fungus', common_name: 'Fly Agaric', scientific_name: 'Amanita muscaria', rarity: 'common', edibility: 'toxic', fruiting_season: 'autumn', habitat: 'birch and pine woods', key_features: ['red cap with white warts'], toxicity_or_safety_notes: 'Psychoactive (muscimol/ibotenic acid) - toxic, do not consume', psychoactive_compounds: ['muscimol', 'ibotenic acid'], primary_effects: 'Deliriant, sedative, visionary at low doses', risk_level: 'high' },
  { type: 'fungus', common_name: 'Chicken of the Woods', scientific_name: 'Laetiporus sulphureus', rarity: 'uncommon', edibility: 'safe', fruiting_season: 'summer, autumn', habitat: 'on oak and other hardwoods', key_features: ['bright orange shelves', 'chicken-like texture when young'] },
  { type: 'fungus', common_name: 'Psilocybe Cubensis', scientific_name: 'Psilocybe cubensis', rarity: 'common', edibility: 'psychoactive', fruiting_season: 'summer, autumn', habitat: 'cow dung, pastures, subtropical', key_features: ['golden brown cap', 'purple gills', 'blue bruising'], toxicity_or_safety_notes: 'Psychedelic (psilocybin/psilocin) - powerful, set and setting critical', psychoactive_compounds: ['psilocybin', 'psilocin'], primary_effects: 'Euphoria, visuals, introspection', risk_level: 'medium' },
  { type: 'fungus', common_name: 'Liberty Cap', scientific_name: 'Psilocybe semilanceata', rarity: 'common', edibility: 'psychoactive', fruiting_season: 'autumn', habitat: 'grassy meadows, pastures', key_features: ['conical cap', 'small size', 'blue bruising'], toxicity_or_safety_notes: 'Psychedelic - common in Europe', psychoactive_compounds: ['psilocybin'], primary_effects: 'Visuals, euphoria', risk_level: 'medium' },
  { type: 'fungus', common_name: 'Wavy Cap', scientific_name: 'Psilocybe cyanescens', rarity: 'uncommon', edibility: 'psychoactive', fruiting_season: 'autumn', habitat: 'wood chips, mulch, coastal', key_features: ['wavy cap edge', 'strong blue bruising'], toxicity_or_safety_notes: 'Highly potent psychedelic', psychoactive_compounds: ['psilocybin'], primary_effects: 'Intense visuals', risk_level: 'high' },
  // (Additional psychoactive fungi and the full list of ethnobotanical plants from local file would be here in complete sync - Psilocybe azurescens, Panaeolus, Amanita pantherina, Cannabis, Peyote, San Pedro, Banisteriopsis caapi, Psychotria viridis, Salvia divinorum, Tabernanthe iboga, Mitragyna speciosa, Datura, etc.)
];

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const sr = base44.asServiceRole || base44;

  const results = [];
  for (const sample of SAMPLE_TAXA) {
    const existing = await sr.entities.Taxon.list({
      filter: { scientific_name: sample.scientific_name, type: sample.type }
    });

    if (existing.length === 0) {
      const created = await sr.entities.Taxon.create({
        ...sample,
        source: 'seedTaxa',
        last_enriched: new Date().toISOString(),
        is_active: true
      });
      results.push({ action: 'created', id: created.id, scientific_name: sample.scientific_name });
    } else {
      results.push({ action: 'exists', id: existing[0].id, scientific_name: sample.scientific_name });
    }
  }

  return Response.json({ success: true, seeded: results.length, details: results });
});