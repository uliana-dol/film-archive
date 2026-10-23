const express = require('express');
const cors = require('cors');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
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

const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'Film Archive API',
    version: '1.0.0',
    description: 'REST API для управління персональною бібліотекою фільмів та дорам',
  },
  paths: {
    '/health': {
      get: {
        summary: 'Health check ендпоінт для ALB',
        responses: { '200': { description: 'Сервер працює нормально' } }
      }
    },
    '/api/auth/register': {
      post: {
        summary: 'Реєстрація нового користувача',
        responses: { '201': { description: 'Користувача створено' } }
      }
    },
    '/api/auth/login': {
      post: {
        summary: 'Авторизація та отримання JWT-токена',
        responses: { '200': { description: 'Успішний вхід' } }
      }
    },
    '/api/films': {
      get: {
        summary: 'Отримати список фільмів',
        responses: { '200': { description: 'Успішно' } }
      },
      post: {
        summary: 'Додати фільм до бібліотеки (потрібен JWT)',
        security: [{ bearerAuth: [] }],
        responses: { '201': { description: 'Фільм додано' }, '401': { description: 'Неавторизовано' } }
      }
    },
    '/api/films/{id}': {
      delete: {
        summary: 'Видалити фільм за ID (потрібен JWT)',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Фільм видалено' }, '401': { description: 'Неавторизовано' } }
      }
    }
  }
};

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🎬 FilmArchive is running on port ${PORT}`);
});
