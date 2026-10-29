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
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  username: { type: 'string', example: 'uliana_test' },
                  password: { type: 'string', example: 'SecurePass123!' }
                }
              }
            }
          }
        },
        responses: { '201': { description: 'Користувача створено' } }
      }
    },
    '/api/auth/login': {
      post: {
        summary: 'Авторизація та отримання JWT-токена',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  username: { type: 'string', example: 'uliana_test' },
                  password: { type: 'string', example: 'SecurePass123!' }
                }
              }
            }
          }
        },
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
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  title: { type: 'string', example: 'Inception' },
                  type: { type: 'string', example: 'Movie' },
                  status: { type: 'string', example: 'Watched' },
                  seasonVibe: { type: 'string', example: 'Autumn' },
                  posterUrl: { type: 'string', example: 'https://via.placeholder.com/300.png' }
                }
              }
            }
          }
        },
        responses: { '201': { description: 'Фільм додано' }, '401': { description: 'Неавторизовано' } }
      }
    },
    '/api/films/{id}': {
      delete: {
        summary: 'Видалити фільм за ID (потрібен JWT)',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          }
        ],
        responses: { '200': { description: 'Фільм видалено' }, '401': { description: 'Неавторизовано' } }
      }
    }
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      }
    }
  }
};

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🎬 FilmArchive is running on port ${PORT}`);
});
