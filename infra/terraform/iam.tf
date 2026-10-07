# GitHub Actions -> AWS con OIDC. Sin claves de acceso.

resource "aws_iam_openid_connect_provider" "github" {
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
  thumbprint_list = [
    "6938fd4d98bab03faadb97b34396831e3780aea1",
    "1c58a3a8518e8759bf075b76b750d4f2df264fcd",
  ]
}

# --- Rol de despliegue (deploy-staging.yml / deploy-prod.yml) -----------------

resource "aws_iam_role" "github_deploy" {
  name                 = "es-b2-github-deploy"
  description          = "Despliegue desde GitHub Actions (UB-ES-2026-B2/Project)"
  max_session_duration = 3600

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = aws_iam_openid_connect_provider.github.arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = { "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com" }
        StringLike = {
          "token.actions.githubusercontent.com:sub" = [
            "repo:${var.github_oidc_subject_prefix}:ref:refs/heads/main",
            "repo:${var.github_oidc_subject_prefix}:ref:refs/heads/develop",
            "repo:${var.github_oidc_subject_prefix}:environment:*",
          ]
        }
      }
    }]
  })
}

# Mínimo privilegio: subir el frontend de cada entorno e invalidar su caché.
resource "aws_iam_role_policy" "github_deploy_frontend" {
  name = "deploy-frontend"
  role = aws_iam_role.github_deploy.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "FrontendList"
        Effect   = "Allow"
        Action   = ["s3:ListBucket"]
        Resource = [for s in module.site : s.bucket_arn]
      },
      {
        Sid      = "FrontendWrite"
        Effect   = "Allow"
        Action   = ["s3:PutObject", "s3:DeleteObject", "s3:GetObject"]
        Resource = [for s in module.site : "${s.bucket_arn}/*"]
      },
      {
        Sid      = "Invalidate"
        Effect   = "Allow"
        Action   = ["cloudfront:CreateInvalidation", "cloudfront:GetInvalidation"]
        Resource = [for s in module.site : s.distribution_arn]
      },
    ]
  })
}
