# GitHub Actions OIDC; no long-lived IAM access keys in GitHub Secrets.
resource "aws_iam_openid_connect_provider" "github" {
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
}
resource "aws_iam_role" "github_deploy" {
  name = "filmarchive-github-deploy-oidc"
  assume_role_policy = jsonencode({ Version = "2012-10-17", Statement = [{
    Effect = "Allow", Principal = { Federated = aws_iam_openid_connect_provider.github.arn },
    Action = "sts:AssumeRoleWithWebIdentity", Condition = { StringEquals = {
      "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com",
      "token.actions.githubusercontent.com:sub" = "repo:uliana-dol/film-archive-lab2:ref:refs/heads/main"
    } }
  }] })
}
resource "aws_iam_role_policy" "github_push" {
  role = aws_iam_role.github_deploy.id
  name = "filmarchive-ecr-and-refresh"
  policy = jsonencode({ Version = "2012-10-17", Statement = [
    { Effect = "Allow", Action = ["ecr:GetAuthorizationToken"], Resource = "*" },
    { Effect = "Allow", Action = ["ecr:BatchCheckLayerAvailability", "ecr:CompleteLayerUpload", "ecr:InitiateLayerUpload", "ecr:PutImage", "ecr:UploadLayerPart", "ecr:BatchGetImage"], Resource = aws_ecr_repository.app_repo.arn },
    { Effect = "Allow", Action = ["autoscaling:StartInstanceRefresh"], Resource = [aws_autoscaling_group.app.arn, aws_autoscaling_group.worker.arn] }
  ] })
}
output "github_oidc_role_arn" { value = aws_iam_role.github_deploy.arn }
