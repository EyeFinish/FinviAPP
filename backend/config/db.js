const mongoose = require('mongoose');

const connectDB = async (retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      const conn = await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 10000,
      });
      console.log(`MongoDB conectado: ${conn.connection.host}`);
      return conn;
    } catch (error) {
      console.error(`Intento ${i + 1}/${retries} - Error de conexión a MongoDB: ${error.message}`);
      if (i === retries - 1) {
        console.error('No se pudo conectar a MongoDB. Verifica que tu IP esté en la whitelist de Atlas (Network Access → Allow Access from Anywhere).');
        process.exit(1);
      }
      await new Promise(r => setTimeout(r, 3000));
    }
  }
};

module.exports = connectDB;
