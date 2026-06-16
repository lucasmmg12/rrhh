/**
 * Deploy RPC functions to Supabase for server-side aggregation.
 * This eliminates the need to fetch 58K+ rows to the client.
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://hakysnqiryimxbwdslwe.supabase.co';
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhha3lzbnFpcnlpbXhid2RzbHdlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDA0MjI3NCwiZXhwIjoyMDg1NjE4Mjc0fQ.v0Zw7yFjGKJX8xsMCZJPwRyhr2eNd1gjASsI7qSK0YM';

// Read SQL file
const sqlPath = path.join(__dirname, 'sql', 'metricas_rpc_functions.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

// Split into individual function blocks
const statements = sql
  .split(/(?=CREATE OR REPLACE FUNCTION)/)
  .map(s => s.trim())
  .filter(s => s.length > 0);

console.log(`📦 Deploying ${statements.length} RPC functions to Supabase...\n`);

async function runSQL(query) {
  const url = new URL('/rest/v1/rpc/exec_sql', SUPABASE_URL);
  
  // Try using the SQL API endpoint directly
  const postData = JSON.stringify({ query });
  
  return new Promise((resolve, reject) => {
    const urlObj = new URL(`${SUPABASE_URL}/rest/v1/`);
    
    // Use the pg_net approach - execute raw SQL via PostgREST
    const reqUrl = new URL(`${SUPABASE_URL}/rest/v1/rpc/`);
    
    const options = {
      hostname: 'hakysnqiryimxbwdslwe.supabase.co',
      path: '/rest/v1/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Prefer': 'return=minimal',
      }
    };

    // Actually, let's use the Management API SQL endpoint
    const mgmtOptions = {
      hostname: 'hakysnqiryimxbwdslwe.supabase.co',
      path: '/pg',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      }
    };

    const req = https.request(mgmtOptions, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(body);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });
    req.on('error', reject);
    req.write(JSON.stringify({ query }));
    req.end();
  });
}

// Alternative: use @supabase/supabase-js with service role
async function deployWithSupabase() {
  // Dynamic import workaround for CommonJS
  const { createClient } = require('@supabase/supabase-js');
  
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    db: { schema: 'public' },
    auth: { persistSession: false },
  });

  // Execute the full SQL as one block via the SQL endpoint
  const fullSQL = sql;
  
  console.log('🔗 Connecting to Supabase with service role...');
  
  // Try the rpc approach first - call a raw SQL exec if available
  const { data, error } = await supabase.rpc('exec_sql', { query: fullSQL });
  
  if (error) {
    console.log('⚠️  exec_sql RPC not available, trying alternative...');
    
    // Alternative: use the database REST endpoint
    const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ query: fullSQL }),
    });
    
    if (!response.ok) {
      console.log('\n❌ Cannot deploy SQL via REST API.');
      console.log('📋 Please run the SQL manually in Supabase SQL Editor:');
      console.log(`   File: ${sqlPath}`);
      console.log('\n   Steps:');
      console.log('   1. Go to https://supabase.com/dashboard');
      console.log('   2. Open your project → SQL Editor');
      console.log('   3. Paste the contents of sql/metricas_rpc_functions.sql');
      console.log('   4. Click "Run"\n');
      return false;
    }
  }
  
  console.log('✅ RPC functions deployed successfully!');
  return true;
}

deployWithSupabase().catch(err => {
  console.error('Error:', err.message);
  console.log('\n📋 Deploy manually: paste sql/metricas_rpc_functions.sql in Supabase SQL Editor');
});
