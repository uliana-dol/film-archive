const express = require('express');
const cors = require('cors');
const path = require('path');
const mediaRoutes = require('./routes/mediaRoutes');
const authRoutes = require('./routes/authRoutes');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.use(express.static(path.join(__dirname, '../public')));

app.use('/api/auth', authRoutes);
app.use('/api/media', mediaRoutes);

app.get('/api/health', (req, res) => res.status(200).json({ status: 'healthy' }));

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🎬 CozyReel is running on port ${PORT}`);
});

const swaggerUi = require('swagger-ui-express');

const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'CozyReel Film Archive API',
    version: '1.0.0',
    description: 'API для управління персональною бібліотекою фільмів та дорам',
  },
  paths: {
    '/health': {
      get: {
        summary: 'Health check endpoint',
        responses: { '200': { description: 'Server is healthy' } }
      }
    }
  }
};

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
