DROP TABLE IF EXISTS detalle_compras CASCADE;
DROP TABLE IF EXISTS compras CASCADE;
DROP TABLE IF EXISTS alimentos CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;

CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    telefono VARCHAR(20),
    direccion VARCHAR(255),
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- TABLA DE ALIMENTOS
CREATE TABLE IF NOT EXISTS alimentos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    precio DECIMAL(10, 2) NOT NULL,
    stock INT NOT NULL DEFAULT 0,
    descripcion TEXT,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- TABLA DE COMPRAS
CREATE TABLE IF NOT EXISTS compras (
    id SERIAL PRIMARY KEY,
    usuario_id INT REFERENCES usuarios(id),
    total DECIMAL(10, 2),
    estado VARCHAR(50) DEFAULT 'completada',
    fecha_compra TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- TABLA DE DETALLES DE COMPRAS
CREATE TABLE IF NOT EXISTS detalle_compras (
    id SERIAL PRIMARY KEY,
    compra_id INT REFERENCES compras(id),
    alimento_id INT REFERENCES alimentos(id),
    cantidad INT,
    precio DECIMAL(10, 2)
);

-- INSERTAR DATOS DE PRUEBA
INSERT INTO alimentos (nombre, precio, stock, descripcion) VALUES
('Salmón Premium', 24.99, 50, 'Alimento premium para gatos con salmón fresco'),
('Snacks Pollo', 12.99, 75, 'Deliciosos snacks con sabor a pollo'),
('Alimento Light', 19.99, 60, 'Alimento bajo en calorías para gatos adultos');

-- ÍNDICES PARA MEJORAR RENDIMIENTO
CREATE INDEX idx_email ON usuarios(email);
CREATE INDEX idx_usuario_compras ON compras(usuario_id);
CREATE INDEX idx_compra_detalles ON detalle_compras(compra_id);
