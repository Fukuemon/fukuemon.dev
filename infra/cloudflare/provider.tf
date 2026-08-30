terraform {
  required_version = ">= 1.11"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.24"
    }
  }

  # bucket / endpoints / 認証情報は account ID を含むため commit しない。
  # `terraform init -backend-config=backend.tfvars` で渡す (README.md)
  backend "s3" {
    key    = "cloudflare/main/terraform.tfstate"
    region = "auto"

    skip_credentials_validation = true # STS が無い
    skip_region_validation      = true # auto は AWS のリージョン名でない
    skip_requesting_account_id  = true # IAM / STS / metadata API が無い
    skip_s3_checksum            = true # R2 のチェックサム対応が限定的
    use_path_style              = true
    use_lockfile                = true
  }
}

# api_token は CLOUDFLARE_API_TOKEN から読む
provider "cloudflare" {}
