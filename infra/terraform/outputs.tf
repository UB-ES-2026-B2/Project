output "sites" {
  description = "Por entorno: URL pública, distribución de CloudFront y bucket del frontend (para los workflows de despliegue)."
  value = {
    for env, s in module.site : env => {
      url             = "https://${s.domain_name}"
      distribution_id = s.distribution_id
      frontend_bucket = s.bucket_name
    }
  }
}

output "media_bucket" {
  value = aws_s3_bucket.media.bucket
}

output "backups_bucket" {
  value = aws_s3_bucket.backups.bucket
}

output "github_deploy_role_arn" {
  value = aws_iam_role.github_deploy.arn
}
