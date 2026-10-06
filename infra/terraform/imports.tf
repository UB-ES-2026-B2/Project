# Recursos creados a mano antes de usar Terraform. Se incorporan al estado en el
# primer apply sin volver a crearlos. Después de ese apply estos bloques no hacen
# nada y se pueden borrar en una PR aparte.

# --- Frontend de producción --------------------------------------------------

import {
  to = module.site["prod"].aws_s3_bucket.frontend
  id = "es-b2-frontend-891377256343"
}

import {
  to = module.site["prod"].aws_s3_bucket_public_access_block.frontend
  id = "es-b2-frontend-891377256343"
}

import {
  to = module.site["prod"].aws_s3_bucket_ownership_controls.frontend
  id = "es-b2-frontend-891377256343"
}

import {
  to = module.site["prod"].aws_s3_bucket_server_side_encryption_configuration.frontend
  id = "es-b2-frontend-891377256343"
}

import {
  to = module.site["prod"].aws_s3_bucket_policy.frontend
  id = "es-b2-frontend-891377256343"
}

import {
  to = module.site["prod"].aws_cloudfront_distribution.this
  id = "E2JFW10E80A64"
}

# --- CloudFront compartido ---------------------------------------------------

import {
  to = aws_cloudfront_origin_access_control.s3
  id = "E3JFTN9XCQM9SW"
}

import {
  to = aws_cloudfront_function.spa_rewrite
  id = "es-b2-spa-rewrite"
}

# --- Fotos -------------------------------------------------------------------

import {
  to = aws_s3_bucket.media
  id = "es-b2-media-891377256343"
}

import {
  to = aws_s3_bucket_public_access_block.media
  id = "es-b2-media-891377256343"
}

import {
  to = aws_s3_bucket_ownership_controls.media
  id = "es-b2-media-891377256343"
}

import {
  to = aws_s3_bucket_server_side_encryption_configuration.media
  id = "es-b2-media-891377256343"
}

import {
  to = aws_s3_bucket_cors_configuration.media
  id = "es-b2-media-891377256343"
}

import {
  to = aws_s3_bucket_policy.media
  id = "es-b2-media-891377256343"
}

# --- Copias ------------------------------------------------------------------

import {
  to = aws_s3_bucket.backups
  id = "es-b2-backups-891377256343"
}

import {
  to = aws_s3_bucket_public_access_block.backups
  id = "es-b2-backups-891377256343"
}

import {
  to = aws_s3_bucket_ownership_controls.backups
  id = "es-b2-backups-891377256343"
}

import {
  to = aws_s3_bucket_server_side_encryption_configuration.backups
  id = "es-b2-backups-891377256343"
}

import {
  to = aws_s3_bucket_lifecycle_configuration.backups
  id = "es-b2-backups-891377256343"
}

# --- IAM ---------------------------------------------------------------------

import {
  to = aws_iam_openid_connect_provider.github
  id = "arn:aws:iam::891377256343:oidc-provider/token.actions.githubusercontent.com"
}

import {
  to = aws_iam_role.github_deploy
  id = "es-b2-github-deploy"
}

import {
  to = aws_iam_role_policy.github_deploy_frontend
  id = "es-b2-github-deploy:deploy-frontend"
}

# --- Presupuesto -------------------------------------------------------------

import {
  to = aws_budgets_budget.monthly
  id = "891377256343:es-b2-mensual"
}
