variable "aws_region" {
  type    = string
  default = "eu-north-1"
}
variable "jwt_secret" {
  type      = string
  sensitive = true
}
variable "omdb_api_key" {
  type      = string
  sensitive = true
  default   = ""
}
variable "alert_email" {
  type        = string
  description = "Email for SNS alert and recovery messages"
}
variable "app_instance_type" {
  type    = string
  default = "t3.micro"
}
variable "redis_instance_type" {
  type    = string
  default = "t3.micro"
}
variable "worker_instance_type" {
  type    = string
  default = "t3.micro"
}
variable "image_tag" {
  type    = string
  default = "latest"
}
variable "allow_paid_deploy" {
  type        = bool
  default     = false
  description = "Explicit opt-in to creating billable AWS resources"
}
variable "cache_enabled" {
  type        = bool
  default     = true
  description = "Enable Redis cache-aside for comparison"
}
