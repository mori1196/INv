const { Pool } = require('pg');

const DATABASE_URL = 'postgresql://inventario_t3n8_user:zz2EgThSUKMT6ZkVvdryhSBTPg7hC3X9@dpg-d8b4f0dckfvc73cm5cs0-a.virginia-postgres.render.com/inventario_t3n8';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

(async () => {
  try {
    console.log('Conectando a la base de datos...\n');
    
    // Listar tablas
    const tablesRes = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    
    console.log('📋 TABLAS EN LA BASE DE DATOS:\n');
    tablesRes.rows.forEach(row => console.log(`  - ${row.table_name}`));
    
    // Para cada tabla, mostrar sus columnas y datos
    console.log('\n' + '='.repeat(60) + '\n');
    
    for (const row of tablesRes.rows) {
      const tableName = row.table_name;
      
      // Columnas
      const colRes = await pool.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position;
      `, [tableName]);
      
      console.log(`📊 TABLA: ${tableName}`);
      console.log('Columnas:');
      colRes.rows.forEach(col => {
        console.log(`  - ${col.column_name} (${col.data_type})`);
      });
      
      // Datos
      const dataRes = await pool.query(`SELECT * FROM ${tableName} LIMIT 5;`);
      console.log(`\nDatos (primeras 5 filas):`);
      if (dataRes.rows.length === 0) {
        console.log('  (vacía)');
      } else {
        console.table(dataRes.rows);
      }
      
      console.log('\n' + '-'.repeat(60) + '\n');
    }
    
    await pool.end();
    console.log('✅ Desconexión exitosa');
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();
