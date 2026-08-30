resource "cloudflare_workers_custom_domain" "site" {
  account_id = var.account_id
  hostname   = var.zone_name
  service    = var.worker_name
  zone_id    = cloudflare_zone.site.id
}
