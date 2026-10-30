
# FilmArchive — AWS Cloud Deployment

**Лабораторна робота з хмарних технологій**  
**Виконала:** Долинська Уляна, група ІР-31  
**GitHub:** https://github.com/uliana-dol/film-archive

FilmArchive (CozyReel) — вебзастосунок для персонального обліку фільмів та іншого медіаконтенту.

Проєкт реалізований на Node.js та Express, використовує MySQL для збереження даних, JWT для авторизації й Docker для контейнеризації.

Застосунок розгорнуто в AWS із використанням Terraform, EC2, Amazon RDS, Application Load Balancer, Amazon ECR та AWS Systems Manager. Автоматичне збирання й розгортання реалізоване через GitHub Actions.

## 1. Посилання на застосунок

- **Вебсайт:** http://filmarchive-alb-1333188652.eu-north-1.elb.amazonaws.com/
- **Swagger UI:** http://filmarchive-alb-1333188652.eu-north-1.elb.amazonaws.com/api-docs/
- **Health check:** http://filmarchive-alb-1333188652.eu-north-1.elb.amazonaws.com/health
- **GitHub Actions:** https://github.com/uliana-dol/film-archive/actions


## 2. Використані технології

| Компонент | Технологія |
|---|---|
| Backend | Node.js 20, Express |
| Frontend | HTML, CSS, JavaScript |
| База даних | MySQL 8 |
| Авторизація | JWT, bcryptjs |
| Контейнеризація | Docker, Docker Compose |
| Хмарний провайдер | Amazon Web Services |
| Infrastructure as Code | Terraform |
| Сервер застосунку | Amazon EC2 |
| Керована база даних | Amazon RDS |
| Балансування навантаження | Application Load Balancer |
| Реєстр образів | Amazon ECR |
| CI/CD | GitHub Actions |
| Віддалене розгортання | AWS Systems Manager |
| Моніторинг | Amazon CloudWatch |
| Документація API | Swagger UI |

## 3. Архітектура AWS

```text
                  КОРИСТУВАЧ
                       |
                       v
            Application Load Balancer
                  HTTP :80
                       |
                       v
                  Amazon EC2
               Docker Container
                 Node.js :3000
                       |
                       v
                  Amazon RDS
                 MySQL :3306
                Private Subnets


            АВТОМАТИЧНИЙ ДЕПЛОЙ

                GitHub Repository
                       |
                  Push to main
                       |
                       v
                 GitHub Actions
                       |
                 Docker Build
                       |
                       v
                   Amazon ECR
                       |
                 Docker Image
                       |
                       v
              AWS Systems Manager
                       |
                       v
                  Amazon EC2
                       |
                Docker Compose
                       |
                       v
               Updated FilmArchive
```

Інфраструктура створюється за допомогою Terraform.

Вона містить:

- VPC із публічними та приватними підмережами;
- Internet Gateway та маршрутизацію;
- Security Groups для ALB, EC2 та RDS;
- Application Load Balancer;
- EC2 для запуску Docker-контейнера;
- Amazon RDS MySQL для постійного збереження даних;
- Amazon ECR для Docker-образів;
- CloudWatch Dashboard та Alarm.

База даних RDS розміщена в приватних підмережах і не має публічного доступу.

Security Group RDS дозволяє з'єднання з MySQL лише від Security Group застосунку. Порт 3000 сервера доступний через ALB.

## 4. Структура проєкту

```text
film-archive/
|
|-- .github/
|   `-- workflows/
|       `-- deploy.yml
|
|-- scripts/
|   `-- deploy-ec2.sh
|
|-- terraform/
|   `-- main.tf
|
|-- src/
|   |-- config/
|   |-- controllers/
|   |-- routes/
|   `-- server.js
|
|-- public/
|-- Dockerfile
|-- compose.yaml
|-- compose.aws.yaml
|-- init.sql
|-- .env.example
|-- package.json
`-- README.md
```

Призначення основних файлів:

- `Dockerfile` — створення Docker-образу застосунку.
- `compose.yaml` — локальний запуск API та MySQL.
- `compose.aws.yaml` — запуск готового ECR-образу на EC2.
- `terraform/main.tf` — опис AWS-інфраструктури.
- `.github/workflows/deploy.yml` — автоматична збірка та деплой.
- `scripts/deploy-ec2.sh` — оновлення контейнера з перевіркою стану.
- `init.sql` — створення таблиць бази даних.

## 5. Локальний запуск

### Вимоги

Для локального запуску необхідні:

- Git;
- Docker Desktop;
- Docker Compose v2.

### Клонування репозиторію

```bash
git clone https://github.com/uliana-dol/film-archive.git
cd film-archive
```

### Налаштування середовища

Створити файл `.env` на основі `.env.example`.

Налаштувати необхідні змінні середовища, зокрема:

```env
DB_HOST=db
DB_PORT=3306
DB_USER=appuser
DB_NAME=appdb
DB_PASSWORD=your_local_db_password
MYSQL_ROOT_PASSWORD=your_local_root_password
JWT_SECRET=your_local_jwt_secret
```

Ці значення є прикладами. Для реального запуску потрібно встановити власні паролі й секрети.

Файл `.env` не повинен потрапляти в GitHub.

### Запуск контейнерів

```bash
docker compose up --build -d
```

### Перевірка

```bash
docker compose ps
```

Локальні адреси:

- Сайт: http://localhost:3000/
- Swagger: http://localhost:3000/api-docs/
- Health check: http://localhost:3000/health

Локальна база MySQL використовує Docker volume `db_data` для збереження даних.

Команда `docker compose down` зупиняє контейнери без видалення тому. Команда `docker compose down -v` видаляє також том із локальними даними.

## 6. REST API

Застосунок реалізує REST API для авторизації та керування медіакаталогом.

| Метод | Endpoint | Призначення |
|---|---|---|
| POST | `/api/auth/register` | Реєстрація користувача |
| POST | `/api/auth/login` | Авторизація |
| GET | `/api/media` | Отримання записів користувача |
| POST | `/api/media` | Додавання запису |
| PUT | `/api/media/:id` | Редагування запису |
| DELETE | `/api/media/:id` | Видалення запису |
| GET | `/health` | Перевірка роботи сервера |
| GET | `/api/health` | Перевірка стану API |

Маршрути медіакаталогу захищені JWT.

Для виконання авторизованих запитів необхідно передавати заголовок:

```http
Authorization: Bearer <JWT_TOKEN>
```

Без авторизації запит до `/api/media` повертає HTTP 401.

Документація API доступна через Swagger UI за адресою `/api-docs/`.

## 7. Docker

Dockerfile використовує базовий образ Node.js Alpine.

Основні особливості:

- залежності встановлюються через `npm ci`;
- застосунок запускається від непривілейованого користувача `node`;
- сервер використовує порт 3000;
- змінні середовища передаються окремо від Docker-образу.

Для локального середовища Docker Compose запускає два сервіси: API та MySQL.

В AWS запускається тільки API-контейнер, а база даних розміщена в Amazon RDS.

## 8. Infrastructure as Code — Terraform

AWS-інфраструктура описана в директорії `terraform/`.

Terraform використовується для створення мережі, балансувальника, EC2, RDS, ECR та ресурсів моніторингу.

Основні команди перевірки:

```bash
cd terraform

terraform fmt -check
terraform validate
terraform plan
```

Під час фінальної перевірки `terraform validate` підтвердив коректність конфігурації, але повідомив про зайву змінну `db_password` у `terraform.tfvars`.

Також `terraform plan` показав необхідність заміни EC2 та пов'язаного ALB target group attachment:

```text
Plan: 2 to add, 1 to change, 2 to destroy.
```

Поточний EC2 було додатково налаштовано вручну: встановлено AWS CLI v2 і Docker Compose v2, підключено IAM-дозволи та налаштовано отримання образів із ECR.

Terraform bootstrap ще потребує узгодження з поточним `compose.aws.yaml`, який очікує змінну `APP_IMAGE`.

Тому `terraform apply` не виконувався після цієї перевірки, щоб не замінити працюючий сервер.

## 9. CI/CD — GitHub Actions

Автоматичний деплой реалізовано у файлі:

```text
.github/workflows/deploy.yml
```

Workflow запускається після кожного `push` у гілку `main`.

Послідовність:

1. GitHub Actions отримує код репозиторію.
2. Налаштовується доступ до AWS.
3. Виконується авторизація в Amazon ECR.
4. Збирається Docker-образ.
5. Образ отримує теги SHA коміту та `latest`.
6. Образ завантажується до ECR.
7. Через AWS Systems Manager надсилається команда EC2.
8. EC2 завантажує новий образ.
9. Docker Compose оновлює контейнер.
10. Виконується перевірка `/health`.
11. GitHub Actions перевіряє результат виконання команди SSM.

Скрипт `scripts/deploy-ec2.sh` передбачає спробу повернення до попереднього Docker-образу у випадку помилки.

Розгортання одного контейнера може спричинити короткочасну недоступність застосунку. Повністю безперервне оновлення не реалізовано.

### Перевірений автоматичний деплой

GitHub Actions workflow №12.

Коміт:

```text
4ad02df4c3732b09d87295df949c76ab5796a097
```

Результат:

```text
GitHub Actions: Success
Build and push image: Success
Update EC2 through SSM: Success
EC2 container: Up
Health check: HTTP 200 OK
```

Після автоматичного оновлення перевірено:

- відкриття сайту через Application Load Balancer;
- авторизацію в раніше створеному обліковому записі;
- наявність раніше доданого фільму;
- успішне підключення застосунку до RDS.

Це підтверджує, що автоматичне оновлення працює, а дані зберігаються окремо від контейнера.

## 10. IAM та безпека

EC2 використовує IAM-роль:

```text
FilmArchive-EC2-SSM
```

До ролі підключено політики:

```text
AmazonSSMManagedInstanceCore
AmazonEC2ContainerRegistryReadOnly
```

Завдяки цьому EC2 може приймати команди AWS Systems Manager та завантажувати приватні Docker-образи з Amazon ECR.

Поточний GitHub Actions використовує AWS credentials, збережені у GitHub Secrets.

Перехід на GitHub OIDC ще не виконано. Під час перевірки IAM OIDC-провайдерів AWS повернув `AccessDenied` через явне обмеження Service Control Policy (SCP) організації.

Для повної реалізації OIDC потрібно погодити доступ з адміністратором AWS-організації.

Рекомендовані подальші покращення безпеки:

- OIDC замість довгострокових AWS-ключів;
- обмеження IAM-прав за принципом найменших привілеїв;
- HTTPS для публічного доступу;
- зберігання секретів у спеціалізованому менеджері секретів.

## 11. Моніторинг — Amazon CloudWatch

Для застосунку налаштовано CloudWatch Dashboard:

```text
FilmArchive-Monitoring
```

Dashboard призначений для перегляду метрик AWS-інфраструктури, зокрема запитів до ALB, помилок та навантаження на сервер.

Також створено CloudWatch Alarm:

```text
filmarchive-alb-5xx-high
```

Під час перевірки AWS CLI:

```text
Dashboard: exists
Alarm actions: enabled
Alarm state: INSUFFICIENT_DATA
```

Стан `INSUFFICIENT_DATA` означає, що для оцінювання умови тривоги недостатньо доступних даних. Це не є підтвердженням несправності застосунку.

Для сповіщень також передбачено Amazon SNS. Доставку повідомлень необхідно перевіряти окремо.

## 12. Результати тестування

У процесі виконання лабораторної підтверджено:

- локальний запуск застосунку в Docker;
- роботу контейнера від користувача `node`;
- роботу Amazon RDS MySQL;
- доступність застосунку через ALB;
- успішну реєстрацію та авторизацію користувача;
- збереження записів у базі даних;
- доступність Swagger UI;
- перевірку `/health` із відповіддю HTTP 200;
- завантаження Docker-образів до Amazon ECR;
- доступ EC2 до приватного ECR-репозиторію;
- виконання команд через AWS Systems Manager;
- успішний автоматичний деплой GitHub Actions;
- збереження даних після оновлення контейнера;
- наявність CloudWatch Dashboard та Alarm.


## 13. Висновок

У лабораторній роботі реалізовано контейнеризацію вебзастосунку FilmArchive та його розгортання в AWS.

Створено хмарну інфраструктуру з EC2, RDS, ALB, ECR та CloudWatch. Реалізовано CI/CD через GitHub Actions і AWS Systems Manager.

Успішний автоматичний деплой підтверджено запуском нового Docker-образу на EC2, відповіддю HTTP 200 і збереженням даних користувача в Amazon RDS.

Основний результат роботи — працездатний вебзастосунок у хмарному середовищі з автоматизованим оновленням після змін у GitHub.
