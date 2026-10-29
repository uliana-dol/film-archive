variable "jwt_secret" {
  description = "Secret used to sign JWT tokens"
  type        = string
  sensitive   = true
}

variable "omdb_api_key" {
  description = "OMDb API key"
  type        = string
  sensitive   = true
}

variable "app_db_username" {
  description = "Database username"
  type        = string
  default     = "admin"
}
