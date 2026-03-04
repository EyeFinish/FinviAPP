const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const connectDB = require('./config/db');
require('dotenv').config();

// Conectar a MongoDB
connectDB();

const app = express();

// Middlewares
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rutas
app.use('/api/fintoc', require('./routes/fintoc'));
app.use('/api/creditos', require('./routes/creditos'));
app.use('/api/flujo', require('./routes/flujo'));

// Ruta de salud
app.get('/', (req, res) => {
  res.json({ message: 'API Finvi funcionando correctamente' });
});

// Manejo de errores centralizado
app.use((err, req, res, next) => {
  console.error('Error:', err.message);

  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ message: 'Error de validación', errors: messages });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({ message: 'ID con formato inválido' });
  }

  if (err.code === 11000) {
    return res.status(400).json({ message: 'Registro duplicado' });
  }

  if (err.response) {
    const fintocError = err.response.data?.error;
    return res.status(err.response.status).json({
      message: fintocError?.message || 'Error en servicio externo',
    });
  }

  res.status(err.statusCode || 500).json({
    message: err.message || 'Error interno del servidor',
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Servidor Finvi corriendo en http://localhost:${PORT}`);
});
