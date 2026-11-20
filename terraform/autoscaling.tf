# EC2 + ALB auto scaling. Existing VPC/RDS/ECR/ALB identities are kept from lab 1.
# WARNING: Deploying is explicitly blocked unless allow_paid_deploy=true.
resource "aws_security_group" "worker_sg" {
  name   = "filmarchive-worker-sg"
  vpc_id = aws_vpc.main.id
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "redis_sg" {
  name   = "filmarchive-redis-sg"
  vpc_id = aws_vpc.main.id
  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.app_sg.id, aws_security_group.worker_sg.id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_ssm_parameter" "app_env" {
  name = "/filmarchive/lab2/app-env"
  type = "SecureString"
  # State contains secrets; never publish terraform.tfstate or any backup.
  value = jsonencode({
    PORT         = "3000"
    DB_HOST      = aws_db_instance.mysql.address
    DB_PORT      = "3306"
    DB_NAME      = aws_db_instance.mysql.db_name
    DB_USER      = aws_db_instance.mysql.username
    DB_PASSWORD  = random_password.db_password.result
    JWT_SECRET   = var.jwt_secret
    OMDB_API_KEY = var.omdb_api_key
  })
}

resource "aws_iam_role" "instance" {
  name               = "filmarchive-lab2-ec2-role"
  assume_role_policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Principal = { Service = "ec2.amazonaws.com" }, Action = "sts:AssumeRole" }] })
}
resource "aws_iam_role_policy_attachment" "ecr" {
  role       = aws_iam_role.instance.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
}
resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.instance.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}
resource "aws_iam_role_policy" "application" {
  name = "filmarchive-runtime"
  role = aws_iam_role.instance.id
  policy = jsonencode({ Version = "2012-10-17", Statement = [
    { Effect = "Allow", Action = ["ssm:GetParameter"], Resource = aws_ssm_parameter.app_env.arn },
    { Effect = "Allow", Action = ["sqs:SendMessage", "sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"], Resource = aws_sqs_queue.jobs.arn }
  ] })
}
resource "aws_iam_instance_profile" "app" {
  name = "filmarchive-lab2-instance-profile"
  role = aws_iam_role.instance.name
}

resource "aws_instance" "redis" {
  ami                         = data.aws_ami.ubuntu.id
  instance_type               = var.redis_instance_type
  subnet_id                   = aws_subnet.public_1.id
  associate_public_ip_address = true # outbound package/docker installs; inbound Redis restricted to app/worker SGs
  vpc_security_group_ids      = [aws_security_group.redis_sg.id]
  metadata_options {
    http_tokens                 = "required"
    http_put_response_hop_limit = 2
  }
  user_data = templatefile("${path.module}/templates/redis.sh.tftpl", {})
  tags      = { Name = "filmarchive-redis-singleton" }
  lifecycle {
    precondition {
      condition     = var.allow_paid_deploy
      error_message = "AWS resources cost money. Set allow_paid_deploy=true only after approving costs."
    }
  }
}

locals {
  ecr_registry = split("/", aws_ecr_repository.app_repo.repository_url)[0]
  image_uri    = "${aws_ecr_repository.app_repo.repository_url}:${var.image_tag}"
  app_user_data = templatefile("${path.module}/templates/node.sh.tftpl", {
    role             = "api", region = var.aws_region, secret_parameter = aws_ssm_parameter.app_env.name,
    redis_private_ip = aws_instance.redis.private_ip, sqs_url = aws_sqs_queue.jobs.url,
    ecr_registry     = local.ecr_registry, image_uri = local.image_uri, cache_enabled = var.cache_enabled
  })
  worker_user_data = templatefile("${path.module}/templates/node.sh.tftpl", {
    role             = "worker", region = var.aws_region, secret_parameter = aws_ssm_parameter.app_env.name,
    redis_private_ip = aws_instance.redis.private_ip, sqs_url = aws_sqs_queue.jobs.url,
    ecr_registry     = local.ecr_registry, image_uri = local.image_uri, cache_enabled = var.cache_enabled
  })
}

resource "aws_launch_template" "app" {
  name_prefix            = "filmarchive-app-"
  image_id               = data.aws_ami.ubuntu.id
  instance_type          = var.app_instance_type
  vpc_security_group_ids = [aws_security_group.app_sg.id]
  iam_instance_profile { name = aws_iam_instance_profile.app.name }
  monitoring { enabled = true }
  metadata_options {
    http_tokens                 = "required"
    http_put_response_hop_limit = 2
  }
  user_data = base64encode(local.app_user_data)
  tag_specifications {
    resource_type = "instance"
    tags          = { Name = "FilmArchive-AutoScaled" }
  }
}

resource "aws_autoscaling_group" "app" {
  name                      = "filmarchive-app-asg"
  min_size                  = 1
  max_size                  = 3
  desired_capacity          = 1
  vpc_zone_identifier       = [aws_subnet.public_1.id, aws_subnet.public_2.id]
  target_group_arns         = [aws_lb_target_group.app_tg.arn]
  health_check_type         = "ELB"
  health_check_grace_period = 600
  wait_for_capacity_timeout = "0" # Terraform apply must not require pre-existing ECR image health
  launch_template {
    id      = aws_launch_template.app.id
    version = "$Latest"
  }
  enabled_metrics     = ["GroupDesiredCapacity", "GroupInServiceInstances", "GroupTotalInstances"]
  metrics_granularity = "1Minute"
  instance_refresh {
    strategy = "Rolling"
    preferences {
      min_healthy_percentage = 50
      instance_warmup        = 180
    }
  }
  lifecycle {
    ignore_changes = [desired_capacity, min_size] # scheduled scaling changes them during day/night
    precondition {
      condition     = var.allow_paid_deploy
      error_message = "Do not deploy with zero credits. Set allow_paid_deploy=true after budgeting."
    }
  }
}

resource "aws_autoscaling_policy" "app_cpu" {
  name                      = "filmarchive-cpu-60"
  autoscaling_group_name    = aws_autoscaling_group.app.name
  policy_type               = "TargetTrackingScaling"
  estimated_instance_warmup = 180
  target_tracking_configuration {
    predefined_metric_specification { predefined_metric_type = "ASGAverageCPUUtilization" }
    target_value     = 60.0
    disable_scale_in = false
  }
}

# 08:00-22:00 approximately Kyiv wintertime; UTC fixed recurrence shifts by 1h in summer.
resource "aws_autoscaling_schedule" "day" {
  scheduled_action_name  = "filmarchive-day"
  autoscaling_group_name = aws_autoscaling_group.app.name
  recurrence             = "0 6 * * *"
  min_size               = 2
  max_size               = 3
  desired_capacity       = 2
}
resource "aws_autoscaling_schedule" "night" {
  scheduled_action_name  = "filmarchive-night"
  autoscaling_group_name = aws_autoscaling_group.app.name
  recurrence             = "0 20 * * *"
  min_size               = 1
  max_size               = 3
  desired_capacity       = 1
}

resource "aws_launch_template" "worker" {
  name_prefix            = "filmarchive-worker-"
  image_id               = data.aws_ami.ubuntu.id
  instance_type          = var.worker_instance_type
  vpc_security_group_ids = [aws_security_group.worker_sg.id]
  iam_instance_profile { name = aws_iam_instance_profile.app.name }
  metadata_options {
    http_tokens                 = "required"
    http_put_response_hop_limit = 2
  }
  user_data = base64encode(local.worker_user_data)
  monitoring { enabled = true }
  tag_specifications {
    resource_type = "instance"
    tags          = { Name = "FilmArchive-Queue-Worker" }
  }
}
resource "aws_autoscaling_group" "worker" {
  name                      = "filmarchive-worker-asg"
  min_size                  = 0
  max_size                  = 1
  desired_capacity          = 0
  vpc_zone_identifier       = [aws_subnet.public_1.id, aws_subnet.public_2.id]
  wait_for_capacity_timeout = "0"
  launch_template {
    id      = aws_launch_template.worker.id
    version = "$Latest"
  }
  enabled_metrics = ["GroupDesiredCapacity", "GroupInServiceInstances"]
  lifecycle { ignore_changes = [desired_capacity] }
}
resource "aws_autoscaling_policy" "worker_up" {
  name                   = "filmarchive-worker-from-queue"
  autoscaling_group_name = aws_autoscaling_group.worker.name
  adjustment_type        = "ChangeInCapacity"
  scaling_adjustment     = 1
  cooldown               = 180
  policy_type            = "SimpleScaling"
}
resource "aws_autoscaling_policy" "worker_down" {
  name                   = "filmarchive-worker-to-zero"
  autoscaling_group_name = aws_autoscaling_group.worker.name
  adjustment_type        = "ChangeInCapacity"
  scaling_adjustment     = -1
  cooldown               = 300
  policy_type            = "SimpleScaling"
}
resource "aws_sqs_queue" "jobs" {
  name                       = "filmarchive-media-jobs"
  visibility_timeout_seconds = 90
  receive_wait_time_seconds  = 10
  message_retention_seconds  = 345600
  redrive_policy             = jsonencode({ deadLetterTargetArn = aws_sqs_queue.dlq.arn, maxReceiveCount = 5 })
}
resource "aws_sqs_queue" "dlq" {
  name                      = "filmarchive-media-jobs-dlq"
  message_retention_seconds = 1209600
}
