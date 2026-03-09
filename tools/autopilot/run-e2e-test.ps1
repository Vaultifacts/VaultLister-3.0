$env:PORT = '3100'
$env:NODE_ENV = 'test'
Set-Location (Join-Path $PSScriptRoot '../..')
npx playwright test --reporter=line
