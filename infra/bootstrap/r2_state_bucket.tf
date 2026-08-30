resource "cloudflare_r2_bucket" "state" {
  account_id    = var.account_id
  name          = var.state_bucket_name
  location      = var.location
  storage_class = "Standard"

  lifecycle {
    prevent_destroy = true
  }
}
