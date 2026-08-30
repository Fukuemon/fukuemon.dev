variable "account_id" {
  description = "Cloudflare の account ID"
  type        = string
}

variable "state_bucket_name" {
  description = "Terraform state を置く R2 バケットの名前"
  type        = string
}

variable "location" {
  description = "R2 バケットのロケーション"
  type        = string
  default     = "apac"
}
