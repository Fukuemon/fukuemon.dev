# plan のログは public repo では誰でも読める。sensitive を外すと ID が出る
variable "account_id" {
  description = "Cloudflare の account ID"
  type        = string
  sensitive   = true
}

variable "zone_id" {
  description = "既存 zone の ID (Cloudflare Registrar が作成済み)"
  type        = string
  sensitive   = true
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

variable "catalog_worker_name" {
  description = "カタログを配信する Worker の名前 (packages/ui/wrangler.jsonc の name と一致させる)"
  type        = string
  default     = "fukuemon-dev-design"
}

variable "playground_worker_name" {
  description = "プレイグラウンドを配信する Worker の名前 (apps/playground/wrangler.jsonc の name と一致させる)"
  type        = string
  default     = "fukuemon-dev-play"
}

variable "docs_worker_name" {
  description = "ドキュメントサイトを配信する Worker の名前 (apps/docs-site/wrangler.jsonc の name と一致させる)"
  type        = string
  default     = "fukuemon-dev-docs"
}

# メールアドレスはリポジトリと公開の Actions のログに書かない (ADR-0032)。apply の workflow は infra environment の secret から渡す
variable "docs_allowed_emails" {
  description = "ドキュメントサイトを開けるメールアドレスの一覧"
  type        = list(string)
  sensitive   = true
  nullable    = false

  validation {
    condition     = length(var.docs_allowed_emails) > 0
    error_message = "docs_allowed_emails に 1 つ以上のメールアドレスを渡す。"
  }

  # error_message に値を入れない。plan のログにメールアドレスが出る
  validation {
    condition     = alltrue([for email in var.docs_allowed_emails : can(regex("^[^@\\s]+@[^@\\s]+$", email))])
    error_message = "docs_allowed_emails に、メールアドレスの形でない値がある。"
  }
}
