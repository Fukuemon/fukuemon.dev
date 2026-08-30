# zone は Cloudflare Registrar が作成済みのため、apply のたびに state へ取り込む。
# import ブロックが無いと、state が空の環境で apply したときに作成を試みる
import {
  to = cloudflare_zone.site
  id = var.zone_id
}

resource "cloudflare_zone" "site" {
  account = {
    id = var.account_id
  }
  name = var.zone_name
  type = "full"

  lifecycle {
    prevent_destroy = true
  }
}
