resource "cloudflare_zone" "site" {
  account = {
    id = var.account_id
  }
  name = var.zone_name
  type = "full"
}

output "name_servers" {
  description = "レジストラへ設定する Cloudflare のネームサーバ"
  value       = cloudflare_zone.site.name_servers
}
