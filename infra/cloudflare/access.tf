# ドキュメントサイトを、許可したメールアドレスの人だけに開く (ADR-0032)。
# Zero Trust の組織は Terraform で作らない。作り方は apps/docs-site/README.md にある
resource "cloudflare_zero_trust_access_policy" "docs" {
  account_id = var.account_id
  name       = "docs-allowed-emails"
  decision   = "allow"
  include = [
    for email in var.docs_allowed_emails : {
      email = {
        email = email
      }
    }
  ]
}

resource "cloudflare_zero_trust_access_application" "docs" {
  account_id = var.account_id
  name       = "docs"
  type       = "self_hosted"
  destinations = [
    {
      type = "public"
      uri  = "docs.${var.zone_name}"
    }
  ]
  session_duration     = "24h"
  app_launcher_visible = false
  policies = [
    {
      id         = cloudflare_zero_trust_access_policy.docs.id
      precedence = 1
    }
  ]
}
