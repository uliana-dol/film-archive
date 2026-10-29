# Film Archive API — AWS Cloud Deployment

**Навчальний проєкт з дисципліни «Хмарні технології»**  
**Виконала:** Долинська Уляна, група ІР-31

Film Archive — REST API для каталогу фільмів і дорам. Застосунок побудований на Node.js та Express, використовує MySQL, запускається в Docker і розгортається в AWS за допомогою Terraform.

## 1. Технології

- **Backend:** Node.js, Express
- **Database:** MySQL 8.0
- **Containerization:** Docker, Docker Compose
- **Infrastructure as Code:** Terraform
- **AWS:** EC2, Application Load Balancer, Amazon RDS, Amazon ECR, VPC, Security Groups, CloudWatch, SNS
- **CI/CD:** GitHub Actions
- **API documentation:** Swagger UI / OpenAPI
- **Authentication:** JWT

## 2. Архітектура

Схема взаємодії компонентів:

```text
                 User / Client
                       |
                       v
            Application Load Balancer
                       |
                       v
                 EC2 Application
                       |
                       v
                 Amazon RDS
                  MySQL 8.0

GitHub Repository
        |
        v
 GitHub Actions
        |
        v
 Amazon ECR
```

Інфраструктура AWS описана в каталозі `terraform/`.

- ALB приймає HTTP-запити від користувачів і передає їх застосунку.
- EC2 запускає контейнеризований застосунок.
- Amazon RDS використовується як керована база даних MySQL.
- Amazon ECR зберігає Docker-образи застосунку.
- Terraform описує мережу, обчислювальні ресурси, базу даних і балансувальник навантаження.

## 3. Структура репозиторію

```text
film_archive/
├── .github/
│   └── workflows/
│       └── deploy.yml
├── terraform/
│   ├── main.tf
│   ├── variables.tf
│   ├── outputs.tf
│   └── ...
├── Dockerfile
├── compose.yaml
├── package.json
├── package-lock.json
├── server.js
├── README.md
└── .gitignore
```

Основні файли:

- `server.js` — сервер і маршрути API.
- `package.json` та `package-lock.json` — залежності Node.js.
- `Dockerfile` — інструкції для створення Docker-образу.
- `compose.yaml` — локальний запуск застосунку та MySQL.
- `.github/workflows/deploy.yml` — автоматизація збірки та публікації Docker-образу.
- `terraform/main.tf` — опис інфраструктури AWS.
- `terraform/variables.tf` — змінні Terraform.
- `terraform/outputs.tf` — вихідні значення, зокрема адреси AWS-ресурсів.

## 4. Локальний запуск

### Вимоги

- Docker Desktop із Docker Compose
- Git
- PowerShell або інший термінал

Клонуйте репозиторій і перейдіть до його каталогу:

```bash
git clone https://github.com/uliana-dol/film-archive.git
cd film-archive
```

Запустіть застосунок:

```bash
docker compose up --build -d
```

Перевірте стан контейнерів:

```bash
docker compose ps
```

Перевірте доступність застосунку:

```text
http://localhost:3000
```

Перевірте документацію API:

```text
http://localhost:3000/api-docs
```

Зупиніть контейнери:

```bash
docker compose down
```

Дані MySQL зберігаються в Docker volume `db_data`. Звичайна команда `docker compose down` не видаляє цей volume. Не використовуйте `docker compose down -v`, якщо потрібно зберегти локальні дані.

## 5. API та автентифікація

Swagger UI доступний за адресою:

`http://localhost:3000/api-docs`

Документація дозволяє переглядати доступні маршрути, HTTP-методи, параметри та схеми відповідей.

Основні групи API:

| Маршрути | Призначення |
|---|---|
| `/api/films` | Отримання та керування каталогом фільмів |
| `/api/auth/register` | Реєстрація користувача |
| `/api/auth/login` | Автентифікація користувача |
| `/health` | Перевірка стану застосунку |
| `/api-docs` | Інтерактивна документація API |

Для захищених операцій використовується JWT. Запити без необхідного токена мають відхилятися з HTTP `401 Unauthorized`.

Під час локального тестування запит до захищеного маршруту `/api/media` без токена повернув HTTP `401`.

Фактичний список маршрутів і вимоги авторизації потрібно звіряти зі Swagger UI та реалізацією в `server.js`.

## 6. Розгортання в AWS за допомогою Terraform

Потрібні AWS CLI, Terraform і налаштовані облікові дані AWS.

Перейдіть до каталогу Terraform:

```bash
cd terraform
terraform init
terraform validate
terraform plan
```

Перегляньте план перед застосуванням. Створення або зміна ресурсів виконується лише після окремого підтвердження:

```bash
terraform apply
```

Для перегляду адрес створених ресурсів:

```bash
terraform output
terraform output alb_dns_name
terraform output ecr_repository_url
terraform output rds_endpoint
```

Публічну адресу застосунку та адресу Swagger можна отримати з output `alb_dns_name`, додавши `/api-docs` для документації.

## 7. CI/CD через GitHub Actions

Workflow розташований у `.github/workflows/deploy.yml` і запускається після push до гілки `main`.

Поточний workflow:

1. Завантажує код репозиторію.
2. Налаштовує AWS credentials.
3. Авторизується в Amazon ECR.
4. Збирає Docker-образ.
5. Публікує образ із тегом SHA коміту та тегом `latest`.

Тег із SHA коміту допомагає ідентифікувати конкретну версію образу.

**Важливо:** успішна публікація образу в ECR сама по собі не означає, що вже запущений застосунок автоматично оновився. Для повного CD-процесу необхідно налаштувати й перевірити крок оновлення сервісу в AWS.

## 8. Безпека

У проєкті передбачено такі заходи:

- Amazon RDS налаштований з `publicly_accessible = false`.
- Security Group бази даних дозволяє MySQL-трафік лише від Security Group застосунку.
- Трафік до застосунку на порту 3000 дозволяється через Security Group балансувальника.
- Для захищених операцій API використовується JWT.
- Docker-контейнер запускається від користувача `node`, а не від `root`.
- Паролі та інші чутливі значення не слід зберігати в репозиторії.
- Секрети GitHub Actions мають зберігатися в налаштуваннях GitHub Secrets.

У поточному workflow використовуються AWS Access Keys через GitHub Secrets. Використання OIDC із короткостроковими AWS credentials може додатково покращити безпеку CI/CD.

## 9. Моніторинг

Terraform містить CloudWatch alarm для відстеження HTTP 5xx-помилок цільового застосунку та SNS-сповіщення.

Повноцінний моніторинг також може включати централізоване збирання логів, CloudWatch Dashboard, метрики навантаження та сповіщення про проблеми доступності. Наявність цих компонентів необхідно перевіряти в конфігурації та AWS Console.

## 10. Перевірка перед демонстрацією

- [ ] `docker compose ps` показує запущений застосунок і здорову базу даних.
- [ ] Головна сторінка повертає HTTP 200.
- [ ] Swagger UI відкривається.
- [ ] Захищений endpoint без токена повертає HTTP 401.
- [ ] `terraform validate` завершується успішно.
- [ ] Публічний ALB доступний.
- [ ] GitHub Actions успішно збирає та публікує образ у ECR.
- [ ] Перевірено стан AWS-ресурсів, мережеві правила та моніторинг.

## 11. Важливі зауваження

- Публічна адреса використовує HTTP, а не HTTPS.
- Доступність AWS-ресурсів залежить від їхнього фактичного стану.
- Перед видаленням інфраструктури необхідно перевірити, які ресурси та дані буде втрачено.
- Команда `terraform destroy` видаляє керовані Terraform ресурси й має виконуватися лише тоді, коли це справді потрібно.

---

**Проєкт:** Film Archive API  
**Репозиторій:** https://github.com/uliana-dol/film-archive
