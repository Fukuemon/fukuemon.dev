# docs_allowed_emails の validation が、空のリストとメールアドレスの形でない値で plan を止めることを確かめる。
# provider を mock にするので、credential と state なしで流せる
mock_provider "cloudflare" {}

# mock の provider は import を受け付けないので、zone.tf が import する zone を置き換える
override_resource {
  target = cloudflare_zone.site
}

variables {
  account_id          = "0123456789abcdef0123456789abcdef"
  zone_id             = "0123456789abcdef0123456789abcdef"
  zone_name           = "example.com"
  docs_allowed_emails = ["a@example.com", "b@example.com"]
}

run "メールアドレスのリストを受け付ける" {
  command = plan
}

run "空のリストで止まる" {
  command = plan
  variables {
    docs_allowed_emails = []
  }
  expect_failures = [var.docs_allowed_emails]
}

run "アットマークの無い値で止まる" {
  command = plan
  variables {
    docs_allowed_emails = ["a@example.com", "not-an-email"]
  }
  expect_failures = [var.docs_allowed_emails]
}

run "空白を含む値で止まる" {
  command = plan
  variables {
    docs_allowed_emails = ["a b@example.com"]
  }
  expect_failures = [var.docs_allowed_emails]
}

run "アットマークを重ねた値で止まる" {
  command = plan
  variables {
    docs_allowed_emails = ["a@b@example.com"]
  }
  expect_failures = [var.docs_allowed_emails]
}

run "空の文字列で止まる" {
  command = plan
  variables {
    docs_allowed_emails = [""]
  }
  expect_failures = [var.docs_allowed_emails]
}

run "改行を含む値で止まる" {
  command = plan
  variables {
    docs_allowed_emails = ["a@example.com\n"]
  }
  expect_failures = [var.docs_allowed_emails]
}
