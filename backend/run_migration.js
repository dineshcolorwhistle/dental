const { execSync } = require('child_process');
try {
  console.log('Running migration...');
  const out1 = execSync('npx prisma migrate dev --name wo_module_improvements', { encoding: 'utf-8' });
  console.log(out1);
} catch (e) {
  console.error('Migration error:', e.stdout || e.message);
  try {
    console.log('Falling back to prisma generate...');
    const out2 = execSync('npx prisma generate', { encoding: 'utf-8' });
    console.log(out2);
  } catch (err) {
    console.error('Generate error:', err.stdout || err.message);
  }
}
