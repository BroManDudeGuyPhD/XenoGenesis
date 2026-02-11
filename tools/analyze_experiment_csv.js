const fs = require('fs');
const path = require('path');
// Accept filename as first CLI arg (relative to workspace root) or default to Gold Wasp
const filename = process.argv[2] || 'experiment_Gold Wasp_2026-02-05T07-56-41.csv';
const csvPath = path.join(__dirname, '..', filename);
if (!fs.existsSync(csvPath)) {
  console.error('CSV file not found:', csvPath);
  process.exit(1);
}
const text = fs.readFileSync(csvPath, 'utf8');
const lines = text.split(/\r?\n/).filter(Boolean);
const header = lines.shift().split(',');
const rows = lines.map(l => {
  const cols = l.split(',');
  const obj = {};
  header.forEach((h,i) => obj[h]=cols[i]);
  return obj;
});
const cond = {};
const incentive = {};
const recipient = {};
const per_rec = {};
const blocks = {};
rows.forEach(r => {
  cond[r['Condition']] = (cond[r['Condition']]||0)+1;
  incentive[r['Incentive_Type']] = (incentive[r['Incentive_Type']]||0)+1;
  recipient[r['Incentive_Recipient']] = (recipient[r['Incentive_Recipient']]||0)+1;
  if (!per_rec[r['Incentive_Recipient']]) per_rec[r['Incentive_Recipient']] = {};
  per_rec[r['Incentive_Recipient']][r['Incentive_Type']] = (per_rec[r['Incentive_Recipient']][r['Incentive_Type']]||0)+1;
  const b = parseInt(r['Block_Number'],10)||0;
  blocks[b] = (blocks[b]||0)+1;
});
function printCounts(title, obj){
  console.log(title);
  Object.keys(obj).sort().forEach(k=>console.log(`  ${k}: ${obj[k]}`));
}
console.log(`Total rounds: ${rows.length}\n`);
printCounts('Conditions:', cond);
console.log();
printCounts('Incentive Types:', incentive);
console.log();
printCounts('Incentive Recipients:', recipient);
console.log();
console.log('Per-recipient incentive breakdown:');
Object.keys(per_rec).sort().forEach(r=>{
  console.log(`  ${r}: ${JSON.stringify(per_rec[r])}`);
});
console.log();
printCounts('Rounds per block:', blocks);
console.log('\nExpected per-condition target: 63 each (189 total)');
