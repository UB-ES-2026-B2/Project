# Frontend de un entorno: bucket privado + distribución de CloudFront.
#   /*        -> bucket del frontend (con reescritura de rutas de la SPA)
#   /media/*  -> bucket de fotos (compartido)
#   /api/*    -> backend en la EC2 (si el entorno tiene api_port)

variable "environment" {
  type = string
}

variable "frontend_bucket_name" {
  type = string
}

variable "comment" {
  type = string
}

variable "origin_access_control_id" {
  type = string
}

variable "spa_rewrite_function_arn" {
  type = string
}

variable "media_bucket_regional_domain_name" {
  type = string
}

variable "api_origin_domain" {
  description = "DNS público de la EC2 del backend."
  type        = string
}

variable "api_port" {
  description = "Puerto del backend de este entorno en la EC2 (prod 8000, staging 8001). null = sin /api/*."
  type        = number
  default     = null
}

variable "media_response_headers_policy_id" {
  description = "Response headers policy de /media/* (Cache-Control largo para las fotos, US 1.1.3)."
  type        = string
  default     = null
}

variable "price_class" {
  description = "PriceClass_100: solo Europa y Norteamérica, la más barata."
  type        = string
  default     = "PriceClass_100"
}

locals {
  # Políticas gestionadas por AWS.
  caching_optimized_policy_id = "658327ea-f89d-4fab-a63d-7e88639e58f6" # Managed-CachingOptimized
  caching_disabled_policy_id  = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad" # Managed-CachingDisabled
  # Managed-AllViewerExceptHostHeader: pasa cabeceras (Authorization incluida), query y cookies.
  all_viewer_except_host_policy_id = "b689b0a8-53d0-40ab-baf2-68738e2966ac"
}

# --- Bucket del frontend -----------------------------------------------------

resource "aws_s3_bucket" "frontend" {
  bucket = var.frontend_bucket_name
}

resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket                  = aws_s3_bucket.frontend.id
  block_public_acls       = true
  ignore_public_acls      = true
  block_public_policy     = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "frontend" {
  bucket = aws_s3_bucket.frontend.id
  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "frontend" {
  bucket = aws_s3_bucket.frontend.id
  rule {
    bucket_key_enabled = false
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_policy" "frontend" {
  bucket = aws_s3_bucket.frontend.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "AllowCloudFrontOAC"
      Effect    = "Allow"
      Principal = { Service = "cloudfront.amazonaws.com" }
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.frontend.arn}/*"
      Condition = {
        StringEquals = { "AWS:SourceArn" = aws_cloudfront_distribution.this.arn }
      }
    }]
  })
}

# --- CloudFront --------------------------------------------------------------

resource "aws_cloudfront_distribution" "this" {
  enabled             = true
  comment             = var.comment
  default_root_object = "index.html"
  http_version        = "http2and3"
  is_ipv6_enabled     = true
  price_class         = var.price_class

  origin {
    origin_id                = "s3-frontend"
    domain_name              = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_access_control_id = var.origin_access_control_id
  }

  origin {
    origin_id                = "s3-media"
    domain_name              = var.media_bucket_regional_domain_name
    origin_access_control_id = var.origin_access_control_id
  }

  # Backend en la EC2 por HTTP. El security group solo deja entrar a CloudFront.
  dynamic "origin" {
    for_each = var.api_port == null ? [] : [var.api_port]
    content {
      origin_id   = "ec2-api"
      domain_name = var.api_origin_domain

      custom_origin_config {
        http_port                = origin.value
        https_port               = 443
        origin_protocol_policy   = "http-only"
        origin_ssl_protocols     = ["TLSv1.2"]
        origin_keepalive_timeout = 5
        origin_read_timeout      = 30
      }
    }
  }

  default_cache_behavior {
    target_origin_id       = "s3-frontend"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true
    cache_policy_id        = local.caching_optimized_policy_id

    function_association {
      event_type   = "viewer-request"
      function_arn = var.spa_rewrite_function_arn
    }
  }

  # El orden importa: CloudFront evalúa los comportamientos de arriba abajo.
  dynamic "ordered_cache_behavior" {
    for_each = var.api_port == null ? [] : [var.api_port]
    content {
      path_pattern             = "/api/*"
      target_origin_id         = "ec2-api"
      viewer_protocol_policy   = "redirect-to-https"
      allowed_methods          = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
      cached_methods           = ["GET", "HEAD"]
      compress                 = true
      cache_policy_id          = local.caching_disabled_policy_id
      origin_request_policy_id = local.all_viewer_except_host_policy_id
    }
  }

  ordered_cache_behavior {
    path_pattern               = "/media/*"
    target_origin_id           = "s3-media"
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["GET", "HEAD"]
    cached_methods             = ["GET", "HEAD"]
    compress                   = true
    cache_policy_id            = local.caching_optimized_policy_id
    response_headers_policy_id = var.media_response_headers_policy_id
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # Sin dominio propio: certificado *.cloudfront.net (ver .checkov.yaml).
  viewer_certificate {
    cloudfront_default_certificate = true
  }
}

# --- Salidas -----------------------------------------------------------------

output "bucket_name" {
  value = aws_s3_bucket.frontend.bucket
}

output "bucket_arn" {
  value = aws_s3_bucket.frontend.arn
}

output "distribution_id" {
  value = aws_cloudfront_distribution.this.id
}

output "distribution_arn" {
  value = aws_cloudfront_distribution.this.arn
}

output "domain_name" {
  value = aws_cloudfront_distribution.this.domain_name
}
