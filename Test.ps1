Write-Host "🚩 [시작] 공격 시뮬레이션을 시작합니다..."

# 1. '의심스러운' 파일 다운로드 시뮬레이션 (실제 다운로드 아님)
"fake malware binary content" | Out-File "$env:Temp\malicious.exe"
Write-Host "[+] 의심스러운 파일 생성 완료"

# 2. 다운로드한 파일 실행 시뮬레이션
Start-Process -FilePath "cmd.exe" -ArgumentList "/c echo malicious.exe executed"
Write-Host "[+] 가짜 파일 실행 완료"

# 3. 시스템 정보 수집
Get-Process | Out-Null
Get-Service | Out-Null
Get-WmiObject Win32_OperatingSystem | Out-Null
Write-Host "[+] 시스템 정보 수집 시도"

# 4. 네트워크 연결 시뮬레이션
Invoke-WebRequest -Uri "https://example.com" -UseBasicParsing -OutFile "$env:Temp\net_test.html"
Write-Host "[+] 외부 네트워크 연결 시도 완료"

# 5. 로그 파일 생성 후 삭제
"stolen credentials" | Out-File "$env:Temp\secret.log"
Remove-Item "$env:Temp\secret.log" -Force
Write-Host "[+] 로그 파일 생성 및 제거"

# 6. 레지스트리 조작 및 제거
New-Item -Path "HKCU:\Software\AttackSim" -Force | Out-Null
New-ItemProperty -Path "HKCU:\Software\AttackSim" -Name "Payload" -Value "evil" -PropertyType String -Force
Remove-Item "HKCU:\Software\AttackSim" -Recurse -Force
Write-Host "[+] 레지스트리 수정 완료"

# 7. 추가 명령 실행 (whoami)
Start-Process "powershell.exe" -ArgumentList "-Command whoami"
Write-Host "[+] 사용자 정보 명령 실행"

Write-Host "✅ [완료] 공격 시뮬레이션이 정상적으로 완료되었습니다."
