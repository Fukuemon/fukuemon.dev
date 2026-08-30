resource "cloudflare_zone" "site" {
  account = {
    id = var.account_id
  }
  name = var.zone_name
  type = "full"
}

# レジストラ側で設定する。zone が active になるまで custom domain は解決しない
output "name_servers" {
  description = "レジストラへ設定する Cloudflare のネームサーバ"
  value       = cloudflare_zone.site.name_servers
}
