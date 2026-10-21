# Лабораторна робота №1 з дисципліни «Хмарні технології»
**Виконила:** Долинська Уляна (група ІР-31)

## Film Archive API: розгортання в AWS (Terraform)
REST API каталогу фільмів та дорам (Node.js + Express + MySQL 8.0 RDS). Запакований у Docker, інфраструктура повністю описана в Terraform, розгорнуто в AWS за Application Load Balancer (ALB), налаштовано автодеплой через GitHub Actions.

* **Публічна адреса:** http://filmarchive-alb-1333188652.eu-north-1.elb.amazonaws.com
* **Swagger UI:** http://filmarchive-alb-1333188652.eu-north-1.elb.amazonaws.com/api-docs

---

### Ендпоінти

| Метод | Шлях | Доступ |
|---|---|---|
| GET | `/api/films`, `/api/films/<id>`, `/api/films/search` | відкритий |
| POST | `/api/films` | JWT |
| PUT, DELETE | `/api/films/<id>` | JWT |
| POST | `/api/auth/login`, `/api/auth/register` | видає токен |
| GET | `/health`, `/api-docs` | відкритий |

---

### Структура репозиторію

Уся інфраструктура — у папці `terraform/`. Один `terraform apply` створює всі ресурси в хмарі AWS:

| Файл / Папка | Що створює / за що відповідає |
|---|---|
| `server.js`, `src/` | Код застосунку (Node.js / Express API) |
| `Dockerfile` | Образ: фіксована база `node:20-alpine`, залежності окремим шаром |
| `compose.yaml` | Застосунок + MySQL 8.0 локально, дані бази у volume `db_data` |
| `.github/workflows/deploy.yml` | Push у `main` → збірка → push в ECR з тегом = SHA коміту → деплой |
| `terraform/main.tf` | VPC, приватні підмережі, ALB, RDS MySQL, ECR, CloudWatch, SNS, Security Groups |
| `README.md` | Опис проєкту, публічні адреси та інструкції здачі |

---

### Локальний запуск

```bash
docker-compose up --build -d
curl http://localhost:3000/health
docker-compose down
