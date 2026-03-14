param(
  [string]$Tag = "latest"
)

$ErrorActionPreference = "Stop"

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
