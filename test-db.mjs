import { mockDbClient } from './src/lib/mock-db.ts';
console.log('Testing mock DB...');
mockDbClient.execute({sql: 'SELECT COUNT(*) as cnt FROM proposals', args: []}).then(res => {
  console.log('Mock DB query result:', res);
  process.exit(0);
}).catch(err => {
  console.error('Mock DB error:', err);
  process.exit(1);
});
