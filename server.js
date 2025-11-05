const express = require('express');
const { Client } = require('pg');

const app = express();

async function fetchWorkflows() {
  const client = new Client({
    host: process.env.DB_POSTGRESDB_HOST,
    port: process.env.DB_POSTGRESDB_PORT ? Number(process.env.DB_POSTGRESDB_PORT) : 5432,
    database: process.env.DB_POSTGRESDB_DATABASE,
    user: process.env.DB_POSTGRESDB_USER,
    password: process.env.DB_POSTGRESDB_PASSWORD,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  try {
    const possibleCols = ['json', 'data', 'workflow', 'workflow_data'];
    let rows = null;
    for (const col of possibleCols) {
      try {
        const r = await client.query(`SELECT id, name, ${col} FROM workflow_entity LIMIT 1`);
        if (r.rows.length >= 0) {
          const full = await client.query(`SELECT id, name, ${col} AS data FROM workflow_entity`);
          rows = full.rows;
          break;
        }
      } catch (e) {}
    }

    if (!rows) {
      const alt = await client.query(`SELECT id, name, to_jsonb(workflow_entity.*) AS data FROM workflow_entity`);
      rows = alt.rows;
    }

    return rows;
  } finally {
    await client.end();
  }
}

app.get('/', async (req, res) => {
  try {
    const rows = await fetchWorkflows();
    if (!rows) {
      return res.status(404).send('No workflow table or data found. Make sure the DB credentials are correct.');
    }

    res.setHeader('Content-Disposition', 'attachment; filename="n8n_workflows.json"');
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(rows, null, 2));
  } catch (err) {
    console.error('Exporter error:', err);
    res.status(500).send('Error: ' + (err.message || err));
  }
});

const port = process.env.PORT || 10000;
app.listen(port, () => {
  console.log('n8n DB exporter running on port', port);
});
