const { execSync } = require('child_process');
const path = require('path');

const isWindows = process.platform === 'win32';
const script = isWindows ? 'recreate-db.cmd' : 'recreate-db.sh';
const scriptPath = path.resolve(__dirname, '..', script);

console.log(`============================================`);
console.log(` DentaCore Database Seed`);
console.log(`============================================`);
console.log(``);
console.log(`This project uses ${script} to create and seed the database.`);
console.log(``);
console.log(`Run it directly:`);
console.log(`  ${scriptPath}`);
console.log(``);
console.log(`Or from the project root:`);
console.log(`  ${isWindows ? '.\\recreate-db.cmd' : './recreate-db.sh'}`);
console.log(``);
console.log(`The script will:`);
console.log(`  1. Drop existing 'dentacore' database`);
console.log(`  2. Recreate the 'dentacore' user and database`);
console.log(`  3. Run db.sql (schema)`);
console.log(`  4. Run seed.sql (demo data for 3 clinics)`);
console.log(``);
console.log(`Default demo admin: admin@elqods.dz / Admin@2025! (also admin@sourire.dz / Sourire@2025!)`);
console.log(`============================================`);

try {
    execSync(scriptPath, { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });
} catch (err) {
    console.error(`\nFailed to run ${script}. See instructions above.`);
    process.exit(1);
}
