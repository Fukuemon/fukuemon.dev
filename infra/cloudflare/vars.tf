variable "account_id" {
  description = "Cloudflare の account ID"
  type        = string
}

variable "zone_name" {
  description = "サイトのドメイン名"
  type        = string
}

variable "worker_name" {
  description = "配信する Worker の名前 (apps/web/wrangler.jsonc の name と一致させる)"
  type        = string
  default     = "fukuemon-dev"
}
