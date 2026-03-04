# QuickBooks Bridge - Production Deployment Guide

## Pre-Deployment Checklist

### 1. Environment Setup

- [ ] Windows Server (or Windows 10/11 Pro)
- [ ] .NET 10.0 Runtime installed
- [ ] QuickBooks Desktop installed
- [ ] QuickBooks SDK (QBXMLRP2) installed
- [ ] Company file accessible

### 2. Security Configuration

#### Generate Strong API Key

```powershell
# PowerShell command to generate a secure API key
$apiKey = [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
Write-Host "Generated API Key: $apiKey"
```

Save this key securely - you'll need it for both the QB agent and the backend.

#### Update appsettings.json

```json
{
  "QuickBooks": {
    "AppId": "AFC_QB_PROD",
    "AppName": "AFC QuickBooks Agent",
    "CompanyFilePath": ""
  },
  "Security": {
    "ApiKey": "YOUR_GENERATED_API_KEY_HERE",
    "AllowedOrigins": ["http://your-backend-server:6000"],
    "EnableAuthentication": true
  },
  "Connection": {
    "TimeoutSeconds": 30,
    "MaxRetries": 3,
    "RetryDelaySeconds": 2
  },
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  }
}
```

### 3. QuickBooks Configuration

#### Initial Authorization

1. Open QuickBooks Desktop as **Administrator**
2. Open the company file you want to use
3. Run the QB Agent for the first time: `.\AFCQbAgent.exe`
4. QuickBooks will display an authorization prompt
5. Click **"Yes, always; allow access even if QuickBooks is not running"**
6. Grant permissions:
   - [x] Read/Write access to required entities (Inventory, Sales Orders, Estimates, Invoices)
   - [x] Allow even when QuickBooks is closed (optional, for unattended operation)

#### Verify Authorization

```powershell
# Test the connection
Invoke-RestMethod -Uri "http://127.0.0.1:5055/health/qb" -Method Get
```

Expected response:
```json
{
  "ok": true,
  "qb": "reachable",
  "jobId": "..."
}
```

### 4. Build and Publish

```powershell
# Navigate to project directory
cd qb_bridge\AFCQbAgent

# Build for Release
dotnet publish -c Release -r win-x64 --self-contained false

# Files will be in: bin\Release\net10.0\win-x64\publish\
```

### 5. Install as Windows Service

#### Option A: Using NSSM (Recommended)

1. Download [NSSM](https://nssm.cc/download)
2. Install the service:

```powershell
# Run as Administrator
nssm install AFCQbAgent "C:\path\to\AFCQbAgent.exe"

# Configure startup
nssm set AFCQbAgent Start SERVICE_AUTO_START

# Set working directory
nssm set AFCQbAgent AppDirectory "C:\path\to\publish"

# Start the service
nssm start AFCQbAgent
```

#### Option B: Using sc.exe

```powershell
# Run as Administrator
sc create AFCQbAgent binPath="C:\path\to\AFCQbAgent.exe" start=auto
sc description AFCQbAgent "AFC QuickBooks Integration Agent"
sc start AFCQbAgent
```

### 6. Firewall Configuration

```powershell
# Allow inbound connections on port 5055
New-NetFirewallRule -DisplayName "AFC QB Agent" -Direction Inbound -LocalPort 5055 -Protocol TCP -Action Allow
```

### 7. Configure Backend

Update your backend `.env` file:

```bash
QB_AGENT_URL=http://127.0.0.1:5055
QB_API_KEY=YOUR_GENERATED_API_KEY_HERE
```

Update backend code to include the API key:

```python
headers = {
    "Content-Type": "application/json",
    "X-API-Key": os.getenv("QB_API_KEY")
}
response = requests.post(f"{QB_AGENT_URL}/jobs", json=job, headers=headers)
```

## Post-Deployment Verification

### 1. Service Health Check

```powershell
# Check if service is running
Get-Service AFCQbAgent

# Test basic health
Invoke-RestMethod -Uri "http://127.0.0.1:5055/health" -Method Get

# Test QB connection
Invoke-RestMethod -Uri "http://127.0.0.1:5055/health/qb" -Method Get
```

### 2. Test API Authentication

```powershell
# Should fail without API key
Invoke-RestMethod -Uri "http://127.0.0.1:5055/jobs" -Method Post -Body '{"op":"ping","entity":"quickbooks"}' -ContentType "application/json"

# Should succeed with API key
$headers = @{ "X-API-Key" = "YOUR_API_KEY" }
Invoke-RestMethod -Uri "http://127.0.0.1:5055/jobs" -Method Post -Body '{"op":"ping","entity":"quickbooks"}' -ContentType "application/json" -Headers $headers
```

### 3. Test End-to-End Integration

From your backend:

```bash
curl -X POST http://your-backend:6000/api/orders/from-qb \
  -H "Content-Type: application/json" \
  -d '{"reference_number": "TEST-001", "qb_doc_type": "sales_order"}'
```

## Monitoring

### Windows Event Log

The service logs to console by default. To log to Windows Event Log, update `appsettings.json`:

```json
{
  "Logging": {
    "EventLog": {
      "SourceName": "AFCQbAgent",
      "LogName": "Application",
      "LogLevel": {
        "Default": "Information"
      }
    }
  }
}
```

### View Service Logs

```powershell
# View recent logs
Get-EventLog -LogName Application -Source AFCQbAgent -Newest 50
```

### Performance Monitoring

```powershell
# Check memory usage
Get-Process AFCQbAgent | Select-Object ProcessName, WorkingSet, CPU

# Monitor over time
while ($true) {
    Get-Process AFCQbAgent | Select-Object ProcessName, @{N='Memory(MB)';E={$_.WorkingSet / 1MB}}, CPU
    Start-Sleep -Seconds 5
}
```

## Maintenance

### Scheduled Restart (Recommended)

Create a scheduled task to restart the service nightly:

```powershell
# Create scheduled task (run as Administrator)
$action = New-ScheduledTaskAction -Execute "sc.exe" -Argument "stop AFCQbAgent; Start-Sleep -Seconds 5; sc.exe start AFCQbAgent"
$trigger = New-ScheduledTaskTrigger -Daily -At 3:00AM
Register-ScheduledTask -Action $action -Trigger $trigger -TaskName "Restart AFCQbAgent" -Description "Nightly restart of QB Agent to free memory"
```

### Updating the Service

```powershell
# Stop the service
Stop-Service AFCQbAgent

# Replace files in publish directory
# ... copy new files ...

# Start the service
Start-Service AFCQbAgent
```

### Backup Configuration

Regularly backup:
- `appsettings.json` (without sensitive data)
- QuickBooks authorization settings
- Service configuration

## Troubleshooting

### Service Won't Start

1. Check Windows Event Log
2. Verify QuickBooks is installed
3. Check QBXMLRP2 SDK is installed
4. Run as Administrator manually to see errors

### Authorization Errors

1. Open QuickBooks as Admin
2. Edit → Preferences → Integrated Applications
3. Remove and re-authorize the app

### High Memory Usage

1. Restart the service
2. Enable nightly scheduled restart
3. Check for QB Desktop updates
4. Reduce MaxRetries if appropriate

### Connection Timeouts

1. Increase `Connection:TimeoutSeconds`
2. Check QuickBooks performance
3. Verify company file isn't too large
4. Consider QuickBooks database maintenance

## Security Best Practices

1. **API Key**: Use a strong, randomly generated key (32+ bytes)
2. **Firewall**: Only allow connections from the backend server
3. **HTTPS**: Consider adding HTTPS in future versions
4. **Updates**: Keep .NET runtime and QuickBooks updated
5. **Monitoring**: Set up alerts for service failures
6. **Access Control**: Run service with minimum required privileges
7. **Audit Logs**: Regularly review QuickBooks access logs

## Performance Tuning

### Recommended Settings for High-Volume

```json
{
  "Connection": {
    "TimeoutSeconds": 60,
    "MaxRetries": 5,
    "RetryDelaySeconds": 3
  }
}
```

### Rate Limiting Adjustment

In `Program.cs`, adjust the rate limiter if needed:

```csharp
PermitLimit = 200,  // Increase from 100 if needed
Window = TimeSpan.FromMinutes(1)
```

## Support Contacts

- Internal Support: [Your team contact]
- QuickBooks SDK: [Intuit Developer Support](https://developer.intuit.com/app/developer/qbdesktop/docs/get-started)

---

**Last Updated**: [Date]
**Version**: 1.0.0
