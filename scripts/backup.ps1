# Резервная копия базы Art.Teach.
#
# Запуск: правой кнопкой по файлу -> «Выполнить с помощью PowerShell»,
# либо в терминале:  powershell -File scripts\backup.ps1
#
# Копии складываются в D:\kabinet-backups. Старше 30 дней удаляются, но
# последние 10 сохраняются всегда — чтобы длинный перерыв в работе не оставил
# вас без копий вообще.

$ErrorActionPreference = "Stop"

$PgBin   = "C:\Program Files\PostgreSQL\16\bin"
$OutDir  = "D:\kabinet-backups"
$Db      = "kabinet"
$User    = "crm"
$env:PGPASSWORD = "crm"

if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir | Out-Null }

$stamp = Get-Date -Format "yyyy-MM-dd_HHmm"
$file  = Join-Path $OutDir "kabinet_$stamp.dump"

& "$PgBin\pg_dump.exe" -U $User -h localhost -p 5432 -d $Db -Fc -f $file
if ($LASTEXITCODE -ne 0) { throw "pg_dump завершился с ошибкой $LASTEXITCODE" }

# Копия считается годной, только если её удалось прочитать.
$tables = (& "$PgBin\pg_restore.exe" -l $file | Select-String "TABLE DATA").Count
if ($tables -lt 10) { throw "Копия выглядит неполной: таблиц с данными $tables" }

$size = [math]::Round((Get-Item $file).Length / 1KB, 1)
"Копия готова: $file ($size КБ, таблиц с данными: $tables)"

$all = Get-ChildItem $OutDir -Filter "kabinet_*.dump" | Sort-Object LastWriteTime -Descending
$old = $all | Select-Object -Skip 10 | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) }
if ($old) { $old | Remove-Item -Force; "Удалено старых копий: $($old.Count)" }
