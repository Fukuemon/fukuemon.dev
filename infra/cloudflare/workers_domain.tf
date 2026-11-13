resource "cloudflare_workers_custom_domain" "site" {
  account_id = var.account_id
  hostname   = var.zone_name
  service    = var.worker_name
  zone_id    = cloudflare_zone.site.id
}

resource "cloudflare_workers_custom_domain" "catalog" {
  account_id = var.account_id
  hostname   = "design.${var.zone_name}"
  service    = var.catalog_worker_name
  zone_id    = cloudflare_zone.site.id
}

resource "cloudflare_workers_custom_domain" "playground" {
  account_id = var.account_id
  hostname   = "play.${var.zone_name}"
  service    = var.playground_worker_name
  zone_id    = cloudflare_zone.site.id
}
