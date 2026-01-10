/**
 * Seed script: Load FAQs from pre-generated faqs.json to Passgage FAQ Bot
 *
 * Usage:
 *   WORKER_URL=http://localhost:8787 ADMIN_API_KEY=your-key npm run seed
 *
 * Environment variables:
 *   WORKER_URL - Worker URL (default: http://localhost:8787)
 *   ADMIN_API_KEY - Admin API key for authentication
 *
 * Prerequisites:
 *   1. Run `npm run build:data` to generate data/faqs.json from CSVs
 *   2. Worker must be running (npm run dev) or deployed
 */

import fs from 'fs';
import path from 'path';

async function main() {
  console.log('🚀 Passgage FAQ Bot - Seeding from faqs.json\n');

  // Check environment variables
  const workerUrl = process.env.WORKER_URL || 'http://localhost:8787';
  const adminKey = process.env.ADMIN_API_KEY;

  if (!adminKey) {
    console.error('❌ Error: ADMIN_API_KEY environment variable is required');
    console.error('\nUsage:');
    console.error('  WORKER_URL=http://localhost:8787 ADMIN_API_KEY=your-key npm run seed\n');
    process.exit(1);
  }

  console.log(`📍 Worker URL: ${workerUrl}`);
  console.log(`🔑 Using admin API key: ${adminKey.substring(0, 8)}...\n`);

  // Read pre-generated faqs.json
  const faqsPath = path.join(process.cwd(), 'data', 'faqs.json');

  if (!fs.existsSync(faqsPath)) {
    console.error('❌ Error: data/faqs.json not found!');
    console.error('\nPlease run: npm run build:data');
    console.error('This will generate faqs.json from CSV files.\n');
    process.exit(1);
  }

  console.log('📂 Loading FAQs from data/faqs.json...');
  const data = JSON.parse(fs.readFileSync(faqsPath, 'utf-8'));
  const { faqs, _meta } = data;

  if (_meta) {
    console.log(`  Generated: ${_meta.generated}`);
    console.log(`  Source: ${_meta.source}`);
  }

  console.log(`  ✅ Loaded ${faqs.length} FAQs\n`);

  // Seed to worker
  console.log('🌱 Seeding FAQs to worker...');

  try {
    const response = await fetch(`${workerUrl}/api/seed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': adminKey,
      },
      body: JSON.stringify({ faqs }),
    });

    const result = await response.json();

    if (response.ok && result.success) {
      console.log(`\n✅ SUCCESS!`);
      console.log(`  - Inserted: ${result.inserted} FAQs`);
      console.log(`  - Failed: ${result.failed} FAQs`);
      console.log(`  - Message: ${result.message}\n`);

      // Verify data load
      console.log('🔍 Verifying data load...');
      const statusResponse = await fetch(`${workerUrl}/api/status`);
      const status = await statusResponse.json();

      if (status.initialized) {
        console.log(`✅ Verification successful: ${status.message}\n`);
      } else {
        console.log(`⚠️  Warning: ${status.message}\n`);
      }
    } else {
      console.error(`\n❌ Seed failed:`);
      console.error(`  - Status: ${response.status} ${response.statusText}`);
      console.error(`  - Response:`, result);
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Error seeding FAQs:', error);
    console.error('\nTroubleshooting:');
    console.error('  1. Is the worker running? (npm run dev)');
    console.error('  2. Is the WORKER_URL correct?');
    console.error('  3. Is the ADMIN_API_KEY valid?');
    console.error('  4. Is Vectorize index created? (npx wrangler vectorize create faq-index --dimensions=1024 --metric=cosine)\n');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
