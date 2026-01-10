/**
 * Generate faqs.json from CSV source files
 *
 * This script reads the 2 CSV files, parses them, and generates
 * a single data/faqs.json file for use by the seed script.
 *
 * Usage:
 *   npm run build:data
 */

import fs from 'fs';
import path from 'path';
import { parseAllCSVs } from '../src/utils/csvParser';

async function main() {
  console.log('🔄 Generating faqs.json from CSV files...\n');
  console.warn('⚠️  Note: data/faqs.json is auto-generated from CSV sources');
  console.warn('⚠️  DO NOT edit faqs.json manually - edit CSV files instead!\n');

  // Read CSV files
  const dataDir = path.join(process.cwd(), 'data');
  const csv1Path = path.join(dataDir, 'Passgage Exairon.csv');
  const csv2Path = path.join(dataDir, 'Sorular - Yanıtlar ChatBot Mobil.csv');

  console.log('📂 Reading CSV files...');

  if (!fs.existsSync(csv1Path)) {
    console.error(`❌ Error: CSV file not found: ${csv1Path}`);
    process.exit(1);
  }

  if (!fs.existsSync(csv2Path)) {
    console.error(`❌ Error: CSV file not found: ${csv2Path}`);
    process.exit(1);
  }

  const csv1 = fs.readFileSync(csv1Path, 'utf-8');
  const csv2 = fs.readFileSync(csv2Path, 'utf-8');

  console.log(`  ✅ Passgage Exairon.csv (${csv1.split('\n').length} lines)`);
  console.log(`  ✅ Sorular - Yanıtlar ChatBot Mobil.csv (${csv2.split('\n').length} lines)\n`);

  // Parse CSVs
  console.log('🔄 Parsing CSV files...');
  const faqs = parseAllCSVs(csv1, csv2);

  console.log(`\n✅ Successfully parsed ${faqs.length} FAQs\n`);

  // Category breakdown
  const categories = new Map<string, number>();
  faqs.forEach((faq) => {
    categories.set(faq.category || 'general', (categories.get(faq.category || 'general') || 0) + 1);
  });

  console.log('📊 FAQs by category:');
  categories.forEach((count, category) => {
    console.log(`  - ${category}: ${count} FAQs`);
  });
  console.log('');

  // Create JSON with metadata comment
  const output = {
    _meta: {
      generated: new Date().toISOString(),
      source: 'CSV files (Passgage Exairon.csv + Sorular - Yanıtlar ChatBot Mobil.csv)',
      note: 'This file is auto-generated. DO NOT edit manually. Edit CSV files and run: npm run build:data',
      totalFAQs: faqs.length,
    },
    faqs,
  };

  // Save to data/faqs.json
  const outputPath = path.join(dataDir, 'faqs.json');
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');

  console.log(`💾 Saved to: ${outputPath}`);
  console.log('');
  console.log('✅ Done! You can now:');
  console.log('  1. Inspect: cat data/faqs.json | jq ".faqs | length"');
  console.log('  2. Seed: npm run seed\n');
}

main().catch((error) => {
  console.error('❌ Error generating faqs.json:', error);
  process.exit(1);
});
