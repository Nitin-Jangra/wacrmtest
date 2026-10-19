require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const pass = process.env.SUPABASE_DB_PASSWORD;
const ref = 'yfenqebkpwzycqbixeui';

if (!pass) {
  console.error('SUPABASE_DB_PASSWORD is missing in .env');
  process.exit(1);
}

async function tryConnect() {
  const configs = [
    {
      name: 'Pooler connection (session mode - port 5432)',
      host: 'aws-0-ap-northeast-1.pooler.supabase.com',
      port: 5432,
      user: 'postgres.' + ref,
      password: pass,
      database: 'postgres',
      ssl: { rejectUnauthorized: false }
    },
    {
      name: 'Pooler connection (transaction mode - port 6543)',
      host: 'aws-0-ap-northeast-1.pooler.supabase.com',
      port: 6543,
      user: 'postgres.' + ref,
      password: pass,
      database: 'postgres',
      ssl: { rejectUnauthorized: false }
    },
    {
      name: 'Direct connection (port 5432)',
      host: 'db.' + ref + '.supabase.co',
      port: 5432,
      user: 'postgres',
      password: pass,
      database: 'postgres',
      ssl: { rejectUnauthorized: false }
    }
  ];

  for (const cfg of configs) {
    console.log('Trying ' + cfg.name + '...');
    const client = new Client(cfg);
    try {
      await client.connect();
      console.log('Connected successfully via ' + cfg.name + '!');
      
      const sql = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'setup-all.sql'), 'utf-8');
      console.log('Executing setup-all.sql (' + sql.length + ' characters)...');
      await client.query(sql);
      console.log('✅ setup-all.sql executed successfully!');
      
      const leadsRes = await client.query('SELECT count(*) FROM leads;');
      console.log('Total seeded leads:', leadsRes.rows[0].count);
      
      const convRes = await client.query('SELECT count(*) FROM conversations;');
      console.log('Total seeded conversations:', convRes.rows[0].count);

      const chRes = await client.query('SELECT count(*) FROM whatsapp_channels;');
      console.log('Total seeded channels:', chRes.rows[0].count);

      await client.end();
      return true;
    } catch (err) {
      console.log('Failed via ' + cfg.name + ': ' + err.message);
      try { await client.end(); } catch (_) {}
    }
  }
  return false;
}

tryConnect().then(success => {
  if (!success) {
    console.error('All connection attempts failed.');
    process.exit(1);
  }
  console.log('🎉 Database migration & seed complete!');
});
