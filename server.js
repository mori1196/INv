require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos
app.use(express.static(path.join(__dirname)));

app.get('/healthz', (req, res) => res.json({ status: 'ok' }));

// CONEXIÓN DB POSTGRESQL desde variables de entorno
function requireEnv(name) {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Variable de entorno requerida: ${name}`);
    }
    return value;
}

const dbConfig = process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false
        }
    }
    : {
        user: requireEnv('DB_USER'),
        password: requireEnv('DB_PASSWORD'),
        host: requireEnv('DB_HOST'),
        port: Number(requireEnv('DB_PORT')),
        database: requireEnv('DB_NAME')
    };

const db = new Pool(dbConfig);

process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Rejection:', reason);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    process.exit(1);
});

const initialProducts = [
    ['Salmón Premium', 24.99, 50, 'Alimento premium para gatos con salmón fresco'],
    ['Snacks Pollo', 12.99, 75, 'Deliciosos snacks con sabor a pollo'],
    ['Alimento Light', 19.99, 60, 'Alimento bajo en calorías para gatos adultos']
];

async function initializeDatabase() {
    const setupQueries = [
        `CREATE TABLE IF NOT EXISTS usuarios (
            id SERIAL PRIMARY KEY,
            nombre VARCHAR(100) NOT NULL,
            email VARCHAR(100) UNIQUE NOT NULL,
            telefono VARCHAR(20),
            direccion VARCHAR(255),
            fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );`,
        `CREATE TABLE IF NOT EXISTS alimentos (
            id SERIAL PRIMARY KEY,
            nombre VARCHAR(100) NOT NULL,
            precio DECIMAL(10,2) NOT NULL,
            stock INT NOT NULL DEFAULT 0,
            descripcion TEXT,
            fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );`,
        `CREATE TABLE IF NOT EXISTS compras (
            id SERIAL PRIMARY KEY,
            usuario_id INT REFERENCES usuarios(id),
            total DECIMAL(10,2),
            estado VARCHAR(50) DEFAULT 'completada',
            fecha_compra TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );`,
        `CREATE TABLE IF NOT EXISTS detalle_compras (
            id SERIAL PRIMARY KEY,
            compra_id INT REFERENCES compras(id),
            alimento_id INT REFERENCES alimentos(id),
            cantidad INT,
            precio DECIMAL(10,2)
        );`
    ];

    for (const query of setupQueries) {
        try {
            await db.query(query);
        } catch (err) {
            console.warn('Advertencia al ejecutar query:', err.message);
        }
    }
    await seedProducts();
}

async function seedProducts() {
    try {
        const result = await db.query('SELECT COUNT(*) AS count FROM alimentos');
        const total = parseInt(result.rows[0].count, 10);
        
        if (total === 0) {
            for (const product of initialProducts) {
                await db.query(
                    'INSERT INTO alimentos (nombre, precio, stock, descripcion) VALUES ($1, $2, $3, $4)',
                    product
                );
            }
            console.log('Datos de prueba insertados en alimentos');
        }
    } catch (err) {
        console.error('Error al sembrar productos:', err.message);
    }
}

async function startServer() {
    try {
        const client = await db.connect();
        client.release();
        console.log('Base de datos PostgreSQL conectada');
        await initializeDatabase();

        const PORT = Number(process.env.PORT || 3000);
        app.listen(PORT, () => {
            console.log(`Servidor en puerto ${PORT}`);
        });
    } catch (err) {
        console.error('Error de conexión o inicialización de BD:', err);
        process.exit(1);
    }
}

startServer();

// CARRITO (DEBE IR ARRIBA)
let carrito = [];

// CREDENCIALES DE ADMINISTRADOR
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'admin123';

/* =======================
   ALIMENTOS (PÚBLICO)
======================= */

// ver alimentos - PÚBLICO
app.get('/alimentos', async (req, res) => {
    try {
        const results = await db.query('SELECT id, nombre, precio FROM alimentos');
        res.json(results.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error al obtener alimentos' });
    }
});

/* =======================
   AUTENTICACIÓN ADMIN
======================= */

// Login de administrador
app.post('/admin/login', (req, res) => {
    const { usuario, contraseña } = req.body;

    if (usuario === ADMIN_USER && contraseña === ADMIN_PASS) {
        res.json({ 
            mensaje: 'Login exitoso',
            token: 'admin_' + Date.now(),
            admin: true
        });
    } else {
        res.status(401).json({ error: 'Credenciales inválidas' });
    }
});

/* =======================
   COMPRA DIRECTA (PÚBLICA)
======================= */

app.post('/comprar', async (req, res) => {
    const { id, cantidad } = req.body;

    try {
        const result = await db.query(
            'UPDATE alimentos SET stock = stock - $1 WHERE id = $2 AND stock >= $1',
            [cantidad, id]
        );

        if (result.rowCount === 0) {
            return res.json({ mensaje: 'Sin stock suficiente' });
        }

        res.json({ mensaje: 'Compra realizada' });
    } catch (err) {
        res.status(500).json({ error: 'Error al realizar compra' });
    }
});

/* =======================
   CARRITO (PÚBLICO)
======================= */

// agregar al carrito - PÚBLICO
app.post('/carrito', (req, res) => {
    const { id, nombre, precio } = req.body;

    carrito.push({ id, nombre, precio });

    res.json({ mensaje: "Agregado al carrito", carrito });
});

// ver carrito - PÚBLICO
app.get('/carrito', (req, res) => {
    res.json(carrito);
});

// finalizar compra - PÚBLICO (sin necesidad de usuario)
app.post('/finalizar', async (req, res) => {
    if (carrito.length === 0) {
        return res.json({ error: 'El carrito está vacío' });
    }

    let total = 0;
    carrito.forEach(item => {
        total += item.precio;
    });

    try {
        // Insertar compra sin usuario (comprador anónimo)
        const resultCompra = await db.query(
            'INSERT INTO compras (usuario_id, total) VALUES (NULL, $1) RETURNING id',
            [total]
        );

        const compra_id = resultCompra.rows[0].id;

        // Insertar detalles de compra y actualizar stock
        for (const item of carrito) {
            // Guardar detalle
            await db.query(
                'INSERT INTO detalle_compras (compra_id, alimento_id, cantidad, precio) VALUES ($1, $2, 1, $3)',
                [compra_id, item.id, item.precio]
            );

            // Actualizar stock
            await db.query(
                'UPDATE alimentos SET stock = stock - 1 WHERE id = $1 AND stock > 0',
                [item.id]
            );
        }

        carrito = [];
        res.json({ 
            mensaje: "Compra realizada y guardada exitosamente",
            compra_id: compra_id,
            total: total
        });
    } catch (err) {
        res.status(500).json({ error: 'Error al guardar compra' });
    }
});

/* =======================
   PANEL ADMIN - INVENTARIO Y VENTAS
======================= */

// Obtener inventario completo - SOLO ADMIN
app.get('/admin/inventario', async (req, res) => {
    const token = req.headers.authorization;
    
    if (!token || !token.startsWith('admin_')) {
        return res.status(403).json({ error: 'No autorizado' });
    }

    try {
        const results = await db.query('SELECT * FROM alimentos');
        res.json(results.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error al obtener inventario' });
    }
});

// Obtener todas las ventas - SOLO ADMIN
app.get('/admin/ventas', async (req, res) => {
    const token = req.headers.authorization;
    
    if (!token || !token.startsWith('admin_')) {
        return res.status(403).json({ error: 'No autorizado' });
    }

    try {
        const results = await db.query(
            `SELECT c.id, c.total, c.estado, c.fecha_compra,
                    STRING_AGG(CONCAT(a.nombre, ' (x', dc.cantidad, ')'), ', ') as productos,
                    COUNT(dc.id) as total_items
             FROM compras c
             LEFT JOIN detalle_compras dc ON c.id = dc.compra_id
             LEFT JOIN alimentos a ON dc.alimento_id = a.id
             GROUP BY c.id
             ORDER BY c.fecha_compra DESC`
        );
        res.json(results.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error al obtener ventas' });
    }
});

// Obtener estadísticas de ventas - SOLO ADMIN
app.get('/admin/estadisticas', async (req, res) => {
    const token = req.headers.authorization;
    
    if (!token || !token.startsWith('admin_')) {
        return res.status(403).json({ error: 'No autorizado' });
    }

    try {
        const results = await db.query(
            `SELECT 
                COUNT(DISTINCT c.id) as total_compras,
                SUM(c.total) as ingresos_totales,
                AVG(c.total) as promedio_compra,
                (SELECT COUNT(*) FROM alimentos) as total_productos
             FROM compras c`
        );
        res.json(results.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
});

// Actualizar stock de producto - SOLO ADMIN
app.put('/admin/alimento/:id', async (req, res) => {
    const token = req.headers.authorization;
    
    if (!token || !token.startsWith('admin_')) {
        return res.status(403).json({ error: 'No autorizado' });
    }

    const { id } = req.params;
    const { stock, precio, nombre } = req.body;

    try {
        await db.query(
            'UPDATE alimentos SET stock = $1, precio = $2, nombre = $3 WHERE id = $4',
            [stock, precio, nombre, id]
        );
        res.json({ mensaje: 'Producto actualizado exitosamente' });
    } catch (err) {
        res.status(500).json({ error: 'Error al actualizar' });
    }
});

// Agregar nuevo producto - SOLO ADMIN
app.post('/admin/alimento', async (req, res) => {
    const token = req.headers.authorization;
    
    if (!token || !token.startsWith('admin_')) {
        return res.status(403).json({ error: 'No autorizado' });
    }

    const { nombre, precio, stock, descripcion } = req.body;

    try {
        const result = await db.query(
            'INSERT INTO alimentos (nombre, precio, stock, descripcion) VALUES ($1, $2, $3, $4) RETURNING id',
            [nombre, precio, stock, descripcion]
        );
        res.json({ 
            mensaje: 'Producto agregado exitosamente',
            id: result.rows[0].id 
        });
    } catch (err) {
        res.status(500).json({ error: 'Error al agregar producto' });
    }
});

/* =======================
   USUARIOS (OPCIONAL - PARA FUTURO USO)
======================= */

// Registrar usuario (opcional)
app.post('/registrar', async (req, res) => {
    const { nombre, email, telefono, direccion } = req.body;

    if (!nombre || !email) {
        return res.status(400).json({ error: 'Nombre y email son requeridos' });
    }

    try {
        const result = await db.query(
            'INSERT INTO usuarios (nombre, email, telefono, direccion) VALUES ($1, $2, $3, $4) RETURNING id',
            [nombre, email, telefono || null, direccion || null]
        );
        res.json({ 
            mensaje: 'Usuario registrado exitosamente',
            usuario_id: result.rows[0].id 
        });
    } catch (err) {
        if (err.code === '23505') {
            return res.status(400).json({ error: 'El email ya está registrado' });
        }
        res.status(500).json({ error: 'Error al registrar' });
    }
});

// Obtener perfil de usuario (opcional)
app.get('/usuario/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const results = await db.query('SELECT * FROM usuarios WHERE id = $1', [id]);
        if (results.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        res.json(results.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Error al obtener perfil' });
    }
});

// Actualizar perfil de usuario (opcional)
app.put('/usuario/:id', async (req, res) => {
    const { id } = req.params;
    const { nombre, telefono, direccion } = req.body;

    try {
        await db.query(
            'UPDATE usuarios SET nombre = $1, telefono = $2, direccion = $3 WHERE id = $4',
            [nombre, telefono, direccion, id]
        );
        res.json({ mensaje: 'Perfil actualizado exitosamente' });
    } catch (err) {
        res.status(500).json({ error: 'Error al actualizar' });
    }
});

// Obtener todas las compras de un usuario (opcional)
app.get('/usuario/:id/compras', async (req, res) => {
    const { id } = req.params;

    try {
        const results = await db.query(
            `SELECT c.*, 
                    STRING_AGG(CONCAT(a.nombre, ' (x', dc.cantidad, ')'), ', ') as productos
             FROM compras c
             LEFT JOIN detalle_compras dc ON c.id = dc.compra_id
             LEFT JOIN alimentos a ON dc.alimento_id = a.id
             WHERE c.usuario_id = $1
             GROUP BY c.id
             ORDER BY c.fecha_compra DESC`,
            [id]
        );
        res.json(results.rows);
    } catch (err) {
        res.status(500).json({ error: 'Error al obtener compras' });
    }
});

// Finalizar compra con usuario (opcional - para clientes registrados)
app.post('/finalizar/:usuario_id', async (req, res) => {
    const { usuario_id } = req.params;

    if (carrito.length === 0) {
        return res.json({ error: 'El carrito está vacío' });
    }

    let total = 0;
    carrito.forEach(item => {
        total += item.precio;
    });

    try {
        // Insertar compra con usuario
        const resultCompra = await db.query(
            'INSERT INTO compras (usuario_id, total) VALUES ($1, $2) RETURNING id',
            [usuario_id, total]
        );

        const compra_id = resultCompra.rows[0].id;

        // Insertar detalles de compra y actualizar stock
        for (const item of carrito) {
            // Guardar detalle
            await db.query(
                'INSERT INTO detalle_compras (compra_id, alimento_id, cantidad, precio) VALUES ($1, $2, 1, $3)',
                [compra_id, item.id, item.precio]
            );

            // Actualizar stock
            await db.query(
                'UPDATE alimentos SET stock = stock - 1 WHERE id = $1 AND stock > 0',
                [item.id]
            );
        }

        carrito = [];
        res.json({ 
            mensaje: "Compra realizada y guardada exitosamente",
            compra_id: compra_id,
            total: total
        });
    } catch (err) {
        res.status(500).json({ error: 'Error al guardar compra' });
    }
});
