terraform {
  required_version = ">= 1.11"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.24"
    }
  }

  # state は置き場そのものを作る段のためローカルに残す。commit しない
}

# api_token は CLOUDFLARE_API_TOKEN から読む
provider "cloudflare" {}
