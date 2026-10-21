Лабораторна роботи з дисципліни "Хмарні технології"
Виконала: Долинська Уляна (IP-31)
Лабораторна робота №1

Film Archive API: розгортання в AWS (Terraform)
REST API каталогу фільмів та дорам (Node.js + Express + MySQL 8.0 RDS). Запакований у Docker, інфраструктура описана в Terraform, розгорнуто в AWS за Application Load Balancer (ALB), автодеплой через GitHub Actions.

Публічна адреса: http://filmarchive-alb-1333188652.eu-north-1.elb.amazonaws.com (після apply береться з terraform output alb_dns_name)
Swagger UI: http://filmarchive-alb-1333188652.eu-north-1.elb.amazonaws.com/api-docs

Ендпоінти
| Метод | Шлях | Доступ |
|---|---|---|
| GET | `/api/films`, `/api/films/<id>`, `/api/films/search` | відкритий |
| POST | `/api/films` | JWT |
| PUT, DELETE | `/api/films/<id>` | JWT |
| POST | `/api/auth/login`, `/api/auth/register` | видає токен |
| GET | `/health`, `/api-docs` | відкритий |

Структура репозиторію
Уся інфраструктура — в terraform/. Один terraform apply створює:
| Файл | Що створює |
|---|---|
| `server.js`, `package.json` | код застосунку (Node.js / Express API) |
| `Dockerfile` | образ: фіксована база `node:20-alpine`, залежності окремим шаром, користувач не root |
| `compose.yaml` | застосунок + MySQL 8.0 локально, дані в volume `db_data` |
| `.github/workflows/deploy.yml` | push у main → збірка → push в ECR з тегом = sha коміту → оновлення сервісу |
| `terraform/main.tf` | VPC, підмережі, ALB, RDS MySQL, ECR, CloudWatch, SNS, Security Groups |
| `terraform/outputs.tf`, `variables.tf` | виводи, змінні, провайдери |

Локальний запуск
docker compose up --build -d
curl localhost:3000/health
docker compose down

Розгортання в AWS
cd terraform
aws configure
terraform init
terraform apply
terraform output alb_dns_name

CI/CD
1. GitHub Secrets: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY.
2. Push у main запускає workflow, вхід в AWS ECR, збірка Docker-образу.
3. Образ тегується хешем коміту (${{ github.sha }}) та тегом latest. Відкат: запуск потрібного образу з ECR за SHA коміту.

Мережа та безпека
- База RDS MySQL в приватній підмережі, publicly_accessible = false.
- Security Group бази дозволяє порт 3306 лише з Security Group застосунку.
- Сервер застосунку приймає трафік лише з Security Group балансувальника.
- З інтернету видно лише Application Load Balancer (ALB).
- Паролі (БД, JWT) генерує Terraform і передає через змінні середовища контейнера (.env).

Моніторинг
Логи в CloudWatch, дашборд із метриками, алерт на 5xx з email сповіщенням через AWS SNS (dol.ulyana@gmail.com).

Прибрати все
terraform destroy

Свідомі спрощення
- Тільки HTTP без SSL-сертифіката.
- Використання Access Keys замість OIDC через SCP-обмеження у навчальному акаунті AWS.
- State локальний (terraform.tfstate).
