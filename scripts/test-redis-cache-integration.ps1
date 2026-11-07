[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$workspace = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$savedEnvironment = @{}
$environmentNames = @(
  'REDIS_ENABLED', 'REDIS_URL', 'REDIS_PASSWORD', 'REDISCLI_AUTH',
  'POSTGRES_PASSWORD', 'PCN_SESSION_SECRET', 'PCN_DATABASE_URL',
  'GEMINI_API_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'SERVICE_ROLE_KEY'
)
foreach ($name in $environmentNames) {
  $savedEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
}

$token = [guid]::NewGuid().ToString('N')
$networkName = "pgdcn-redis-it-$token"
$containerName = "pgdcn-redis-it-$token"
$networkId = $null
$containerId = $null
$containerRemoved = $false
$temporaryEnvFile = Join-Path ([System.IO.Path]::GetTempPath()) "pgdcn-redis-compose-$token.env"

function Invoke-RedisCacheTest {
  param([Parameter(Mandatory = $true)][string]$TestPath)

  Write-Host "Running $TestPath"
  & node --test-force-exit --require ./scripts/native-dev-preload.cjs --import tsx --test $TestPath
  if ($LASTEXITCODE -ne 0) {
    throw "Redis cache integration test failed: $TestPath"
  }
}

function Remove-OwnedRedisContainer {
  param([Parameter(Mandatory = $true)][string]$Id)

  $actualName = docker inspect --format '{{.Name}}' $Id 2>$null
  $labelsJson = docker inspect --format '{{json .Config.Labels}}' $Id 2>$null
  if ($LASTEXITCODE -ne 0 -or $actualName -ne "/$containerName") {
    throw 'Refusing Redis test cleanup because the container name does not match the generated test name.'
  }
  $labels = $labelsJson | ConvertFrom-Json
  if ($labels.'com.tvci.redis-integration' -ne 'pgdcn') {
    throw 'Refusing Redis test cleanup because the ownership label does not match.'
  }

  docker rm --force $Id | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw 'Could not remove the owned ephemeral Redis container.'
  }
}

try {
  Push-Location $workspace

  docker info --format '{{.ServerVersion}}' | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw 'Docker Desktop is unavailable; no Redis integration resources were created.'
  }
  docker image inspect redis:7-alpine --format '{{.Id}}' | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw 'The redis:7-alpine image is not cached locally; the test will not pull images.'
  }

  $dummyValues = @(
    'POSTGRES_PASSWORD=compose-config-only'
    'PCN_SESSION_SECRET=compose-config-only'
    'REDIS_ENABLED=true'
    'REDIS_URL=redis://redis:6379'
    'REDIS_PASSWORD=compose-config-only'
    'PCN_DATABASE_URL=postgresql://postgres:compose-config-only@127.0.0.1:5432/pcn_certification'
    'GEMINI_API_KEY=compose-config-only'
    'SUPABASE_SERVICE_ROLE_KEY=compose-config-only'
    'SERVICE_ROLE_KEY=compose-config-only'
  )
  [System.IO.File]::WriteAllLines($temporaryEnvFile, $dummyValues, (New-Object System.Text.UTF8Encoding($false)))

  # Keep inherited runtime secrets out of the validation-only Compose config.
  $env:POSTGRES_PASSWORD = 'compose-config-only'
  $env:PCN_SESSION_SECRET = 'compose-config-only'
  $env:PCN_DATABASE_URL = 'postgresql://postgres:compose-config-only@127.0.0.1:5432/pcn_certification'
  $env:GEMINI_API_KEY = 'compose-config-only'
  $env:SUPABASE_SERVICE_ROLE_KEY = 'compose-config-only'
  $env:SERVICE_ROLE_KEY = 'compose-config-only'
  $env:REDIS_ENABLED = 'true'
  $env:REDIS_URL = 'redis://redis:6379'
  $env:REDIS_PASSWORD = 'compose-config-only'
  $composeJson = docker compose --env-file $temporaryEnvFile -f docker-compose.yml -f docker-compose.redis-cache.yml config --format json
  if ($LASTEXITCODE -ne 0) {
    throw 'The opt-in Redis Compose overlay did not validate.'
  }
  $composeConfig = $composeJson | ConvertFrom-Json
  $webapp = $composeConfig.services.webapp
  $serviceNetworkNames = @($webapp.networks.PSObject.Properties | ForEach-Object { $_.Name })
  if ($webapp.environment.REDIS_ENABLED -ne 'true' -or
      $webapp.environment.REDIS_URL -ne 'redis://redis:6379' -or
      $webapp.environment.REDIS_PASSWORD -ne 'compose-config-only' -or
      $serviceNetworkNames -notcontains 'supabase_default' -or
      $serviceNetworkNames -notcontains 'redis_private' -or
      $composeConfig.networks.redis_private.external -ne $true -or
      $composeConfig.networks.redis_private.name -ne 'tvci_app_redis_private') {
    throw 'The Redis Compose overlay does not preserve the expected webapp environment and external network contract.'
  }
  Write-Host 'Opt-in Compose overlay validated; no Compose services were started.'

  $existingContainer = docker ps -a --filter ("name=^/{0}$" -f $containerName) --format '{{.ID}}'
  if ($LASTEXITCODE -ne 0 -or $existingContainer) {
    throw 'The generated ephemeral Redis container name is already in use; refusing to continue.'
  }
  $existingNetwork = docker network ls --filter ("name=^{0}$" -f $networkName) --format '{{.Name}}'
  if ($LASTEXITCODE -ne 0 -or $existingNetwork) {
    throw 'The generated ephemeral Redis network name is already in use; refusing to continue.'
  }

  $randomBytes = New-Object byte[] 36
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $rng.GetBytes($randomBytes)
  }
  finally {
    $rng.Dispose()
  }
  $env:REDIS_ENABLED = 'true'
  $env:REDIS_PASSWORD = [Convert]::ToBase64String($randomBytes)

  $networkId = [string](docker network create --driver bridge --label 'com.tvci.redis-integration=pgdcn' $networkName)
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($networkId)) {
    throw 'Could not create the uniquely named Redis integration network.'
  }
  $networkId = $networkId.Trim()

  $createdContainerId = docker run --detach `
    --name $containerName `
    --label 'com.tvci.redis-integration=pgdcn' `
    --network $networkName `
    --publish '127.0.0.1::6379' `
    --env REDIS_PASSWORD `
    redis:7-alpine sh -c 'exec redis-server --requirepass "$REDIS_PASSWORD" --enable-debug-command yes'
  if ($LASTEXITCODE -ne 0) {
    throw 'Could not start the uniquely named ephemeral Redis container.'
  }
  $containerId = [string](docker inspect --format '{{.Id}}' $containerName)
  if ($LASTEXITCODE -ne 0 -or $containerId -notmatch '^[0-9a-f]{64}$') {
    throw 'Could not verify the identity of the ephemeral Redis container.'
  }

  $portJson = docker inspect --format '{{json .NetworkSettings.Ports}}' $containerId
  if ($LASTEXITCODE -ne 0) {
    throw 'Could not inspect the ephemeral Redis port mapping.'
  }
  $portMappings = @((($portJson | ConvertFrom-Json).'6379/tcp'))
  if ($portMappings.Count -ne 1 -or $portMappings[0].HostIp -ne '127.0.0.1') {
    throw 'Ephemeral Redis must have exactly one host port mapping bound to 127.0.0.1.'
  }
  $hostPort = 0
  if (-not [int]::TryParse([string]$portMappings[0].HostPort, [ref]$hostPort)) {
    throw 'Docker did not assign a dynamic host port to ephemeral Redis.'
  }

  $env:REDIS_URL = "redis://127.0.0.1:$hostPort"
  $env:REDISCLI_AUTH = $env:REDIS_PASSWORD
  $ready = $false
  for ($attempt = 0; $attempt -lt 40; $attempt++) {
    $pong = docker exec --env REDISCLI_AUTH $containerId redis-cli ping 2>$null
    if ($LASTEXITCODE -eq 0 -and ($pong -join '').Trim() -eq 'PONG') {
      $ready = $true
      break
    }
    Start-Sleep -Milliseconds 250
  }
  if (-not $ready) {
    throw 'The owned ephemeral Redis server did not become ready with password authentication.'
  }

  Write-Host "Ephemeral authenticated Redis is ready on loopback port $hostPort."
  Invoke-RedisCacheTest './test/redis-cache-live.test.ts'

  Remove-OwnedRedisContainer -Id $containerId
  $containerRemoved = $true
  Invoke-RedisCacheTest './test/redis-cache-live-failover.test.ts'
}
finally {
  foreach ($name in $environmentNames) {
    $oldValue = $savedEnvironment[$name]
    if ($null -eq $oldValue) {
      Remove-Item -LiteralPath "Env:$name" -ErrorAction SilentlyContinue
    }
    else {
      [Environment]::SetEnvironmentVariable($name, $oldValue, 'Process')
    }
  }

  if ($containerId -and -not $containerRemoved) {
    Remove-OwnedRedisContainer -Id $containerId
    $containerRemoved = $true
  }
  if ($networkId) {
    $networkInfo = @(docker network inspect $networkId 2>$null | ConvertFrom-Json)[0]
    if ($LASTEXITCODE -eq 0 -and $networkInfo.Id -eq $networkId -and
        $networkInfo.Name -eq $networkName -and
        $networkInfo.Labels.'com.tvci.redis-integration' -eq 'pgdcn') {
      $attachedContainerIds = @($networkInfo.Containers.PSObject.Properties | ForEach-Object { $_.Name })
      if ($attachedContainerIds.Count -ne 0) {
        throw 'Refusing to remove the ephemeral network because it still has attached containers.'
      }
      docker network rm $networkId | Out-Null
      if ($LASTEXITCODE -ne 0) {
        throw 'Could not remove the owned ephemeral Redis network.'
      }
    }
    elseif ($LASTEXITCODE -eq 0) {
      throw 'Refusing Redis test network cleanup because its identity/ownership did not match.'
    }
  }
  if (Test-Path -LiteralPath $temporaryEnvFile) {
    Remove-Item -LiteralPath $temporaryEnvFile -Force
  }
  if ((Get-Location).Path -eq $workspace) {
    Pop-Location
  }
}
