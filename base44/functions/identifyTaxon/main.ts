import { createClientFromRequest } from 'npm:@base44/sdk@0.8.35';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const { image_base64, lat, lon, type_hint } = await req.json();
  const sr = base44.asServiceRole || base44;

  try {
    const taxa = await sr.entities.Taxon.list({ limit: 100 });

    let scored = taxa.map((t: any) => {
      let score = Math.random() * 0.6 + 0.2;
      if (type_hint && t.type === type_hint) score += 0.15;
      if (lat && lon) score += 0.1;
      return { taxon: t, confidence: Math.min(0.98, score) };
    });

    scored.sort((a, b) => b.confidence - a.confidence);
    const top = scored.slice(0, 5);

    const suggestions = top.map((s: any) => ({
      taxon_id: s.taxon.id,
      scientific_name: s.taxon.scientific_name,
      common_name: s.taxon.common_name,
      type: s.taxon.type,
      confidence: s.confidence,
      edibility_or_safety: s.taxon.edibility || s.taxon.toxicity_or_safety_notes || 'verify',
      key_features: s.taxon.key_features?.slice(0, 3) || []
    }));

    const best = suggestions[0];
    const isToxic = (best.edibility_or_safety || '').toLowerCase().includes('toxic') || (best.edibility_or_safety || '').toLowerCase().includes('deadly');

    return Response.json({
      success: true,
      suggestions,
      arData: {
        bbox: [120, 80, 280, 320],
        label: best.common_name || best.scientific_name,
        confidence: best.confidence,
        toxicity_alert: isToxic ? 'HIGH - verify carefully' : 'low',
        type: best.type
      },
      note: 'Prototype. Integrate real multimodal vision + cross-check in production.'
    });
  } catch (e) {
    return Response.json({ success: false, error: e.message });
  }
});