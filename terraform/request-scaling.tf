resource "aws_autoscaling_policy" "app_requests" {
  name                   = "filmarchive-requests-1000"
  autoscaling_group_name = aws_autoscaling_group.app.name
  policy_type            = "TargetTrackingScaling"
  estimated_instance_warmup = 180

  target_tracking_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ALBRequestCountPerTarget"
      resource_label = "${aws_lb.alb.arn_suffix}/${aws_lb_target_group.app_tg.arn_suffix}"
    }

    target_value     = 1000.0
    disable_scale_in = true
  }
}
