# Piezas de CloudFront compartidas y un module.site (bucket + distribución) por entorno.

# Un solo OAC para todos los buckets: CloudFront firma las peticiones a S3 con SigV4.
resource "aws_cloudfront_origin_access_control" "s3" {
  name                              = "es-b2-s3-oac"
  description                       = "OAC para buckets es-b2"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# Rutas de la SPA (sin extensión) -> /index.html. trimspace: el código publicado no
# termina en salto de línea y así no aparece una diferencia falsa.
resource "aws_cloudfront_function" "spa_rewrite" {
  name    = "es-b2-spa-rewrite"
  runtime = "cloudfront-js-2.0"
  comment = "Rutas de React Router a index.html"
  publish = true
  code    = trimspace(file("${path.module}/functions/spa-rewrite.js"))
}

module "site" {
  source   = "./modules/site"
  for_each = var.environments

  environment                       = each.key
  frontend_bucket_name              = each.value.frontend_bucket
  comment                           = each.value.comment
  origin_access_control_id          = aws_cloudfront_origin_access_control.s3.id
  spa_rewrite_function_arn          = aws_cloudfront_function.spa_rewrite.arn
  media_bucket_regional_domain_name = aws_s3_bucket.media.bucket_regional_domain_name
}
