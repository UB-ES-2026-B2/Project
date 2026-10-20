# Infraestructura de ES-B2 en AWS. Un solo estado para todos los entornos:
# staging y prod comparten EC2, bucket de fotos, rol de GitHub y presupuesto
# (ver docs/decisiones.md, D8). Lo que es de cada entorno va en module.site.

terraform {
  required_version = ">= 1.11"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }

  # El bucket del estado se crea a mano una sola vez (ver infra/README.md, "Arranque").
  # use_lockfile: bloqueo nativo de S3, sin DynamoDB.
  backend "s3" {
    bucket       = "es-b2-tfstate-891377256343"
    key          = "es-b2/terraform.tfstate"
    region       = "eu-west-1"
    encrypt      = true
    use_lockfile = true
  }
}

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      project = "es-b2"
    }
  }
}

data "aws_caller_identity" "current" {}

locals {
  account_id = data.aws_caller_identity.current.account_id
}
