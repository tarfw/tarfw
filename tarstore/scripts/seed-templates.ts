/**
 * Seed design templates into the states DB via taragent API.
 * Run: npx tsx scripts/seed-templates.ts
 */
import { ALL_TEMPLATES, templateToStatePayload } from '../src/templates/designs';

const TARAGENT_API = process.env.TARAGENT_API || 'https://taragent.tar-54d.workers.dev';

async function seed() {
  console.log(`Seeding ${ALL_TEMPLATES.length} templates to ${TARAGENT_API}/api/state ...\n`);

  for (const template of ALL_TEMPLATES) {
    const body = templateToStatePayload(template);

    const res = await fetch(`${TARAGENT_API}/api/state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const json = await res.json();

    if (res.ok) {
      console.log(`  [OK] ${template.id} — ${template.title}`);
    } else {
      console.error(`  [FAIL] ${template.id}:`, json);
    }
  }

  console.log('\nDone.');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
