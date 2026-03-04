# QuickBooks Bridge - Troubleshooting Guide

## Common Issues and Solutions

### 1. Authorization Errors

#### Error: 0x80040418 - QuickBooks Authorization Required

**Symptoms:**
```json
{
  "errorCode": "QBSDK_COM_0x80040418",
  "errorMessage": "QuickBooks authorization required..."
}
```

**Root Cause:**
- The application hasn't been authorized in QuickBooks
- Authorization was revoked
- QuickBooks needs admin approval

**Solution:**

1. **Close QuickBooks completely**
2. **Open QuickBooks as Administrator** (right-click → Run as Administrator)
3. **Open the company file** you want to use
4. **Start the QB Agent** (if not running): `.\AFCQbAgent.exe`
5. **Watch for the authorization dialog** in QuickBooks
6. **Click "Yes, always"** and check "Allow access even if QuickBooks is not running"
7. **Grant required permissions**:
   - ✅ Read/Write Inventory
   - ✅ Read/Write Sales Orders
   - ✅ Read/Write Estimates
   - ✅ Read/Write Invoices

**Verify Fix:**
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:5055/health/qb"
```

#### Error: Authorization Revoked

**If already authorized but getting errors:**

1. Open QuickBooks as Administrator
2. Go to **Edit → Preferences**
3. Select **Integrated Applications** → **Company Preferences**
4. Find "AFC QuickBooks Agent" in the list
5. Click **Remove** then **Done**
6. Restart the QB Agent to trigger re-authorization

---

### 2. Connection Errors

#### Error: Connection Timeout

**Symptoms:**
```json
{
  "errorCode": "QBSDK_ERROR",
  "errorMessage": "QuickBooks SDK operation timed out after 30 seconds"
}
```

**Possible Causes:**
- QuickBooks is not running
- QuickBooks is busy/frozen
- Company file is very large
- Network issues (if company file is on network drive)

**Solution:**

1. **Verify QuickBooks is running:**
   ```powershell
   Get-Process | Where-Object { $_.ProcessName -like "*QuickBooks*" }
   ```

2. **Check if company file is open:**
   - Look at QuickBooks title bar
   - Verify it's the correct company file

3. **Increase timeout** in `appsettings.json`:
   ```json
   {
     "Connection": {
       "TimeoutSeconds": 60
     }
   }
   ```

4. **Restart QuickBooks** if it appears frozen

5. **Run QuickBooks file maintenance:**
   - File → Utilities → Verify Data
   - File → Utilities → Rebuild Data (if errors found)

#### Error: QuickBooks Not Found

**Symptoms:**
- Agent fails to start
- COM errors on startup

**Solution:**

1. **Verify QuickBooks Desktop is installed:**
   ```powershell
   Get-ItemProperty HKLM:\Software\Intuit\QuickBooks
   ```

2. **Install QuickBooks SDK:**
   - Download from [Intuit Developer site](https://developer.intuit.com/app/developer/qbdesktop/docs/get-started)
   - Run installer
   - Restart the QB Agent

3. **Verify QBXMLRP2.dll is registered:**
   ```powershell
   Get-ChildItem "C:\Program Files*\Intuit\QuickBooks*" -Recurse -Filter "QBXMLRP2.dll"
   ```

---

### 3. Authentication Issues

#### Error: 401 Unauthorized

**Symptoms:**
```json
{
  "error": "Unauthorized. Valid X-API-Key header required."
}
```

**Cause:**
- Missing X-API-Key header
- Incorrect API key
- Authentication enabled but key not configured

**Solution:**

1. **Verify API key is configured** in backend:
   ```python
   print(os.getenv("QB_API_KEY"))  # Should not be None
   ```

2. **Check header is being sent:**
   ```python
   headers = {"X-API-Key": os.getenv("QB_API_KEY")}
   response = requests.post(url, json=data, headers=headers)
   ```

3. **Verify key matches** in appsettings.json:
   ```json
   {
     "Security": {
       "ApiKey": "same-key-as-backend"
     }
   }
   ```

4. **For testing, temporarily disable auth:**
   ```json
   {
     "Security": {
       "EnableAuthentication": false
     }
   }
   ```
   ⚠️ **Never disable authentication in production!**

---

### 4. Rate Limiting Issues

#### Error: 429 Too Many Requests

**Symptoms:**
```json
{
  "error": "Too many requests. Please try again later.",
  "retryAfter": 60
}
```

**Cause:**
- Exceeded 100 requests per minute from same IP
- Burst of requests from backend

**Solution:**

1. **Implement retry with backoff** in backend:
   ```python
   import time
   
   def call_qb_agent(data, max_retries=3):
       for attempt in range(max_retries):
           response = requests.post(url, json=data, headers=headers)
           if response.status_code == 429:
               retry_after = response.json().get("retryAfter", 60)
               time.sleep(retry_after)
               continue
           return response
       raise Exception("Max retries exceeded")
   ```

2. **Increase rate limit** in Program.cs (if legitimate traffic):
   ```csharp
   PermitLimit = 200,  // Increase from 100
   Window = TimeSpan.FromMinutes(1)
   ```

3. **Batch requests** if making many calls:
   - Queue requests in backend
   - Process with controlled rate

---

### 5. Service Issues

#### Error: Service Won't Start

**Check Windows Event Log:**
```powershell
Get-EventLog -LogName Application -Source AFCQbAgent -Newest 10
```

**Common Causes:**

1. **Port already in use:**
   ```powershell
   netstat -ano | findstr :5055
   ```
   - Kill the process or change port

2. **Missing dependencies:**
   - Verify .NET 10.0 is installed
   - Check QBXMLRP2 SDK is installed

3. **Permission issues:**
   - Run as Administrator
   - Check service account permissions

4. **Configuration errors:**
   - Validate appsettings.json syntax
   - Check for missing required fields

#### Error: Service Crashes Frequently

**Collect crash information:**
```powershell
# Check service status
Get-Service AFCQbAgent

# View crash logs
Get-EventLog -LogName Application -EntryType Error -Newest 50 | 
  Where-Object { $_.Source -eq "AFCQbAgent" }
```

**Common fixes:**

1. **Memory issues:**
   - Enable nightly service restart
   - Increase server memory
   - Check for memory leaks in Event Viewer

2. **QuickBooks crashes:**
   - Update QuickBooks to latest version
   - Run QuickBooks database verification
   - Check QuickBooks error logs

3. **COM errors:**
   - Reinstall QuickBooks SDK
   - Re-register COM components
   - Run QuickBooks repair

---

### 6. Data Issues

#### Error: No Data Returned

**When queries return empty results:**

1. **Verify reference number exists** in QuickBooks:
   - Open QuickBooks
   - Search for the reference number manually

2. **Check entity type** matches:
   - Sales Order vs. Estimate vs. Invoice
   - Spelling and capitalization

3. **Review QBXML request** in response:
   ```json
   {
     "qbxmlRequest": "<?xml version=\"1.0\"?>..."
   }
   ```
   - Verify the query parameters are correct

4. **Test in QuickBooks directly:**
   - Use OSR (Online SDK Reference) to test QBXML
   - Verify expected behavior

#### Error: Invalid Data in Response

**When data doesn't match expectations:**

1. **Check QBXML response** for errors:
   ```xml
   <QBXMLMsgsRs>
     <StatusCode>0</StatusCode>  <!-- 0 = success -->
     <StatusMessage>...</StatusMessage>
   </QBXMLMsgsRs>
   ```

2. **Validate in backend parser:**
   - Check XML parsing logic
   - Handle missing/optional fields
   - Verify data type conversions

---

### 7. Performance Issues

#### Slow Responses

**Symptoms:**
- Requests taking > 30 seconds
- Frequent timeouts

**Diagnosis:**

1. **Check QuickBooks performance:**
   - Company file size
   - Number of transactions
   - QuickBooks version

2. **Monitor agent performance:**
   ```powershell
   Get-Process AFCQbAgent | Select-Object CPU, WorkingSet
   ```

3. **Review logs** for slow operations:
   ```powershell
   Get-EventLog -LogName Application -Source AFCQbAgent | 
     Where-Object { $_.Message -like "*timeout*" }
   ```

**Solutions:**

1. **Increase timeout:**
   ```json
   {
     "Connection": {
       "TimeoutSeconds": 60
     }
   }
   ```

2. **Optimize QuickBooks:**
   - Condense transaction log (File → Utilities → Condense Data)
   - Run on local drive (not network)
   - Upgrade QuickBooks hardware

3. **Limit data returned:**
   - Use specific queries (RefNumber vs. listing all)
   - Avoid large date ranges

#### High Memory Usage

**Symptoms:**
- Agent using > 500 MB RAM
- Memory grows over time
- System slow/crashes

**Diagnosis:**
```powershell
while ($true) {
    $proc = Get-Process AFCQbAgent
    Write-Host "$($proc.WorkingSet / 1MB) MB"
    Start-Sleep -Seconds 60
}
```

**Solutions:**

1. **Restart service nightly:**
   - See DEPLOYMENT.md for scheduled task

2. **Check for leaks:**
   - Review recent changes
   - Monitor after each request type

3. **Limit concurrent requests:**
   - Ensure backend isn't overwhelming agent
   - Check rate limiting is working

---

## Diagnostic Tools

### Health Check Script

```powershell
# comprehensive-health-check.ps1

Write-Host "=== QB Agent Health Check ===" -ForegroundColor Cyan

# 1. Service Status
Write-Host "`n1. Service Status:" -ForegroundColor Yellow
$service = Get-Service AFCQbAgent -ErrorAction SilentlyContinue
if ($service) {
    Write-Host "   Status: $($service.Status)" -ForegroundColor $(if($service.Status -eq 'Running'){'Green'}else{'Red'})
} else {
    Write-Host "   Service not found!" -ForegroundColor Red
}

# 2. Process Info
Write-Host "`n2. Process Info:" -ForegroundColor Yellow
$proc = Get-Process AFCQbAgent -ErrorAction SilentlyContinue
if ($proc) {
    Write-Host "   PID: $($proc.Id)"
    Write-Host "   Memory: $([math]::Round($proc.WorkingSet / 1MB, 2)) MB"
    Write-Host "   CPU: $($proc.CPU) seconds"
} else {
    Write-Host "   Process not running!" -ForegroundColor Red
}

# 3. Basic Health
Write-Host "`n3. Basic Health:" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "http://127.0.0.1:5055/health" -Method Get -TimeoutSec 5
    Write-Host "   Service: OK" -ForegroundColor Green
    Write-Host "   Version: $($response.version)"
} catch {
    Write-Host "   Service: FAILED - $($_.Exception.Message)" -ForegroundColor Red
}

# 4. QuickBooks Connection
Write-Host "`n4. QuickBooks Connection:" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "http://127.0.0.1:5055/health/qb" -Method Get -TimeoutSec 30
    Write-Host "   QuickBooks: REACHABLE" -ForegroundColor Green
} catch {
    Write-Host "   QuickBooks: UNREACHABLE - $($_.Exception.Message)" -ForegroundColor Red
}

# 5. Recent Errors
Write-Host "`n5. Recent Errors:" -ForegroundColor Yellow
$errors = Get-EventLog -LogName Application -Source AFCQbAgent -EntryType Error -Newest 5 -ErrorAction SilentlyContinue
if ($errors) {
    $errors | ForEach-Object {
        Write-Host "   $($_.TimeGenerated): $($_.Message.Substring(0, [Math]::Min(100, $_.Message.Length)))"
    }
} else {
    Write-Host "   No recent errors" -ForegroundColor Green
}

Write-Host "`n=== End Health Check ===" -ForegroundColor Cyan
```

### Enable Debug Logging

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Debug",
      "AfcQbAgent": "Debug"
    }
  }
}
```

---

## Getting Help

### Information to Collect

When reporting issues, include:

1. **Error message** (full JSON response)
2. **QBXML request** (from response if available)
3. **Configuration** (appsettings.json, redacted)
4. **Environment**:
   - Windows version
   - .NET version: `dotnet --version`
   - QuickBooks version
5. **Logs** (recent Event Log entries)
6. **Steps to reproduce**

### Contact

- GitHub Issues: [Repository URL]
- Internal Support: [Contact]
- QuickBooks SDK Support: [Intuit Developer Support](https://developer.intuit.com/app/developer/qbdesktop/docs/get-started)

---

**Last Updated**: 2024  
**Version**: 1.0.0
