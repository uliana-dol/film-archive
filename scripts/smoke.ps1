param([string]$BaseUrl = 'http://localhost:3000')
$ErrorActionPreference = 'Stop'
$BaseUrl = $BaseUrl.TrimEnd('/')
$u = ('lab2_' + [DateTimeOffset]::UtcNow.ToUnixTimeSeconds())
$p = 'Lab2-test-only-123!'
$j = @{ username=$u; password=$p } | ConvertTo-Json
Write-Host '1/5 Register and log in'
Invoke-RestMethod -Uri "$BaseUrl/api/auth/register" -Method Post -ContentType application/json -Body $j | Out-Null
$auth = Invoke-RestMethod -Uri "$BaseUrl/api/auth/login" -Method Post -ContentType application/json -Body $j
$headers = @{ Authorization="Bearer $($auth.token)" }
Write-Host '2/5 GET profile'
$profile=Invoke-RestMethod -Uri "$BaseUrl/api/media/me" -Headers $headers
Write-Host "Authenticated user id: $($profile.id)"
Write-Host '3/5 Test Idempotency-Key: same result, one DB record'
$key = 'smoke-' + [guid]::NewGuid().ToString()
$headers['Idempotency-Key'] = $key
$body = @{title="k6-smoke-$(Get-Random)";media_type='LoadTest'} | ConvertTo-Json
$a = Invoke-RestMethod -Uri "$BaseUrl/api/media" -Headers $headers -Method Post -ContentType application/json -Body $body
$b = Invoke-RestMethod -Uri "$BaseUrl/api/media" -Headers $headers -Method Post -ContentType application/json -Body $body
if($a.id -ne $b.id) { throw "Idempotency failed: $($a.id) vs $($b.id)" }
$headers.Remove('Idempotency-Key')
$list=Invoke-RestMethod -Uri "$BaseUrl/api/media" -Headers $headers
$matches=@($list | Where-Object {$_.id -eq $a.id})
if($matches.Count -ne 1) {throw "Expected 1 record, found $($matches.Count)"}
Write-Host "Idempotency OK, one media id=$($a.id)"
Write-Host '4/5 Test cache stats and GET single media'
Invoke-RestMethod -Uri "$BaseUrl/api/media/$($a.id)" -Headers $headers | Out-Null
Invoke-RestMethod -Uri "$BaseUrl/api/media" -Headers $headers | Out-Null
$stats=Invoke-RestMethod -Uri "$BaseUrl/api/media/cache-stats" -Headers $headers
Write-Host "Cache hits $($stats.hits), misses $($stats.misses), hit ratio $($stats.hit_ratio)"
Write-Host '5/5 Test async creation and poll job'
$q = @{title="k6-async-$(Get-Random)";media_type='LoadTest'} | ConvertTo-Json
$result = Invoke-RestMethod -Uri "$BaseUrl/api/media/async" -Headers $headers -Method Post -ContentType application/json -Body $q
if(-not $result.job_id) {throw 'Missing job id'}; Write-Host "SQS Job ID: $($result.job_id)"
$done=$false
for($i=0;$i -lt 120;$i++){
  Start-Sleep -Seconds 2
  $status=Invoke-RestMethod -Uri "$BaseUrl/api/media/jobs/$($result.job_id)" -Headers $headers
  if($status.state -eq 'done'){$done=$true;Write-Host "Async OK, id=$($status.media_id)";break}
  if($status.state -eq 'failed'){throw 'Worker failed'}
}
if(-not $done){ throw 'Timed out; check docker compose logs worker' }
Write-Host 'Local tests passed.'
