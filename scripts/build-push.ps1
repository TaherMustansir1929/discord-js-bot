param(
  [string]$Tag = "latest"
)

$ErrorActionPreference = "Stop"

$null = Get-Command docker -ErrorAction Stop
try {
  docker info | Out-Null
} catch {
  Write-Error "Docker engine is not running. Please start Docker Desktop or the Docker service, then try again."
  exit 1
}

$LocalImage = "discord-js-bot"
$RemoteImage = "ghcr.io/tahermustansir1929/discord-js-bot:$Tag"

docker build -t $LocalImage .
docker tag $LocalImage $RemoteImage
docker push $RemoteImage

Write-Host "Image pushed to GitHub Container Registry: $RemoteImage"

Write-Host "======= Deploying to VPS ======="

ssh -i ~/.ssh/second-amd-vps.key ubuntu@138.2.104.150 @'
set -e
cd /home/ubuntu/discord-js-bot
./login-ghcr.sh
./start-container.sh
'@
