resource "cloudflare_r2_bucket" "state" {
  account_id    = var.account_id
  name          = var.state_bucket_name
  location      = var.location
  storage_class = "Standard"

  # 消えると infra/cloudflare/ の state を失う
  lifecycle {
    prevent_destroy = true
  }
}
