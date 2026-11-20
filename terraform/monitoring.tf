resource "aws_sns_topic" "alerts" { name = "filmarchive-alerts-topic" }
resource "aws_sns_topic_subscription" "email_subscription" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}
resource "aws_cloudwatch_metric_alarm" "alb_5xx_alarm" {
  alarm_name          = "filmarchive-alb-5xx-high"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Sum"
  threshold           = 1
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]
  dimensions          = { LoadBalancer = aws_lb.alb.arn_suffix }
}
# Requirement: alert when maximum app instance count is reached for 2 minutes,
# then send a second email when it is no longer reached.
resource "aws_cloudwatch_metric_alarm" "app_maxed" {
  alarm_name          = "filmarchive-app-max-replicas"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 2
  datapoints_to_alarm = 2
  metric_name         = "GroupInServiceInstances"
  namespace           = "AWS/AutoScaling"
  period              = 60
  statistic           = "Average"
  threshold           = 3
  treat_missing_data  = "notBreaching"
  alarm_description   = "FilmArchive serving at maximum 3 instances for 2 minutes"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]
  dimensions          = { AutoScalingGroupName = aws_autoscaling_group.app.name }
}
resource "aws_cloudwatch_metric_alarm" "worker_queue_pending" {
  alarm_name          = "filmarchive-worker-queue-has-work"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 60
  statistic           = "Maximum"
  threshold           = 1
  treat_missing_data  = "notBreaching"
  dimensions          = { QueueName = aws_sqs_queue.jobs.name }
  alarm_actions       = [aws_autoscaling_policy.worker_up.arn]
}
resource "aws_cloudwatch_metric_alarm" "worker_queue_empty" {
  alarm_name          = "filmarchive-worker-queue-empty"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 2
  metric_query {
    id          = "m1"
    return_data = false
    metric {
      metric_name = "ApproximateNumberOfMessagesVisible"
      namespace   = "AWS/SQS"
      period      = 60
      stat        = "Maximum"
      dimensions  = { QueueName = aws_sqs_queue.jobs.name }
    }
  }
  metric_query {
    id          = "e1"
    expression  = "FILL(m1,0)"
    label       = "Queue approximate depth"
    return_data = true
  }
  threshold          = 1
  treat_missing_data = "breaching" # if SQS does not emit idle datapoints, signal empty
  alarm_actions      = [aws_autoscaling_policy.worker_down.arn]
}
resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "FilmArchive-Lab2-Monitoring"
  dashboard_body = jsonencode({ widgets = [
    { type = "metric", x = 0, y = 0, width = 12, height = 6, properties = { title = "1. Desired vs in-service API instances", region = var.aws_region, period = 60, stat = "Average", view = "timeSeries", metrics = [
      ["AWS/AutoScaling", "GroupDesiredCapacity", "AutoScalingGroupName", aws_autoscaling_group.app.name, { label = "Desired" }],
      ["AWS/AutoScaling", "GroupInServiceInstances", "AutoScalingGroupName", aws_autoscaling_group.app.name, { label = "In service" }]
    ] } },
    { type = "metric", x = 12, y = 0, width = 12, height = 6, properties = { title = "2. CPU utilization (%)", region = var.aws_region, period = 60, stat = "Average", view = "timeSeries", annotations = { horizontal = [{ label = "Target 60%", value = 60 }] }, metrics = [
      ["AWS/EC2", "CPUUtilization", "AutoScalingGroupName", aws_autoscaling_group.app.name, { label = "API CPU average" }]
    ] } },
    { type = "metric", x = 0, y = 6, width = 12, height = 6, properties = { title = "3. Requests per minute", region = var.aws_region, period = 60, stat = "Sum", view = "timeSeries", metrics = [
      ["AWS/ApplicationELB", "RequestCount", "LoadBalancer", aws_lb.alb.arn_suffix]
    ] } },
    { type = "metric", x = 12, y = 6, width = 12, height = 6, properties = { title = "4. p95 Target Response Time (seconds)", region = var.aws_region, period = 60, stat = "p95", view = "timeSeries", metrics = [
      ["AWS/ApplicationELB", "TargetResponseTime", "LoadBalancer", aws_lb.alb.arn_suffix, { stat = "p95" }]
    ] } },
    { type = "metric", x = 0, y = 12, width = 12, height = 6, properties = { title = "5. Target 5xx per minute", region = var.aws_region, period = 60, stat = "Sum", view = "timeSeries", metrics = [
      ["AWS/ApplicationELB", "HTTPCode_Target_5XX_Count", "LoadBalancer", aws_lb.alb.arn_suffix]
    ] } },
    { type = "metric", x = 12, y = 12, width = 12, height = 6, properties = { title = "Bonus: queued messages and worker replicas", region = var.aws_region, period = 60, stat = "Maximum", view = "timeSeries", metrics = [
      ["AWS/SQS", "ApproximateNumberOfMessagesVisible", "QueueName", aws_sqs_queue.jobs.name, { label = "Queued" }],
      ["AWS/AutoScaling", "GroupInServiceInstances", "AutoScalingGroupName", aws_autoscaling_group.worker.name, { label = "Worker running" }]
    ] } }
  ] })
}

# Not a hard cost cap: AWS Budget alerts may arrive after spend has occurred.
resource "aws_budgets_budget" "course_budget" {
  name         = "filmarchive-course-lab-budget"
  budget_type  = "COST"
  limit_amount = "5"
  limit_unit   = "USD"
  time_unit    = "MONTHLY"
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.alert_email]
  }
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.alert_email]
  }
}
