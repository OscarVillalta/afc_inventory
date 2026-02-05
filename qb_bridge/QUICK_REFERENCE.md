# QuickBooks Bridge - Quick Reference Card

## 🚀 Quick Start

### 1. Configuration (Required)
```json
{
  "QuickBooks": {
    "AppId": "YOUR_APP_ID",
    "AppName": "AFC QuickBooks Agent"
  },
  "Security": {
    "ApiKey": "YOUR_SECURE_KEY",
    "AllowedOrigins": ["http://your-backend:6000"],
    "EnableAuthentication": true
  }
}
```

### 2. Generate API Key (PowerShell)
```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

### 3. Start Service
```bash
dotnet run  # Development
.\AFCQbAgent.exe  # Production
```

### 4. Verify
```bash
curl http://127.0.0.1:5055/health
curl http://127.0.0.1:5055/health/qb
```

## 🔒 Security Checklist

- [ ] Strong API key configured (32+ bytes)
- [ ] `EnableAuthentication: true` in production
- [ ] `AllowedOrigins` set to backend URL only
- [ ] QuickBooks authorized (Edit → Preferences → Integrated Applications)
- [ ] Firewall configured (port 5055, specific IPs)

## 📊 API Endpoints

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/health` | GET | No | Basic health check |
| `/health/qb` | GET | No | QuickBooks connection test |
| `/jobs` | POST | Yes | Execute QB operations |

## 🔑 Authentication

All `/jobs` requests require:
```http
X-API-Key: your-api-key-here
```

## 🎯 Common Operations

### Query Sales Order
```json
{
  "op": "query",
  "entity": "sales_order",
  "params": {
    "refnumber": "8800"
  }
}
```

### Query Inventory
```json
{
  "op": "query",
  "entity": "inventory",
  "params": {
    "active_status": "ActiveOnly"
  }
}
```

### Create Sales Order
```json
{
  "op": "create",
  "entity": "sales_order",
  "payload": {
    "customer_full_name": "ABC Company",
    "refnumber": "SO-001",
    "items": [
      {
        "item_full_name": "FILTER-001",
        "quantity": 10,
        "rate": 25.00
      }
    ]
  }
}
```

## ⚙️ Default Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| Port | 5055 | HTTP listen port |
| Timeout | 30s | QB operation timeout |
| Max Retries | 3 | Retry attempts |
| Rate Limit | 100/min | Per IP address |
| Max Request | 10MB | Body size limit |

## 🛠️ Troubleshooting

### Common Error Codes

| Code | Meaning | Solution |
|------|---------|----------|
| `0x80040418` | Not authorized | Open QB as Admin, authorize app |
| `401` | Invalid API key | Check X-API-Key header |
| `429` | Rate limited | Wait 60s or increase limit |
| `Timeout` | QB slow/busy | Increase TimeoutSeconds |

### Quick Diagnostics
```powershell
# Service status
Get-Service AFCQbAgent

# Memory usage
Get-Process AFCQbAgent | Select CPU, @{N='Memory(MB)';E={$_.WorkingSet/1MB}}

# Recent errors
Get-EventLog -LogName Application -Source AFCQbAgent -EntryType Error -Newest 5

# Test connection
Invoke-RestMethod http://127.0.0.1:5055/health/qb
```

## 📚 Documentation

- **README.md** - Setup and configuration
- **DEPLOYMENT.md** - Production deployment
- **SECURITY.md** - Security features and testing
- **TROUBLESHOOTING.md** - Detailed problem solving
- **REVIEW_SUMMARY.md** - Security review results

## 🔧 Configuration Tuning

### High Volume
```json
{
  "Connection": {
    "TimeoutSeconds": 60,
    "MaxRetries": 5
  }
}
```

### Low Latency
```json
{
  "Connection": {
    "TimeoutSeconds": 15,
    "MaxRetries": 1
  }
}
```

## 📞 Support

| Issue Type | Resource |
|------------|----------|
| Setup | README.md |
| Deployment | DEPLOYMENT.md |
| Errors | TROUBLESHOOTING.md |
| Security | SECURITY.md |
| QB SDK | [Intuit Developer Support](https://developer.intuit.com) |

## ⚡ Performance Tips

1. **Memory**: Schedule nightly restart
2. **Speed**: Keep QB company file on local SSD
3. **Reliability**: Use specific queries (RefNumber vs listing all)
4. **Monitoring**: Check `/health/qb` every 5 minutes

## 🎯 Production Checklist

- [ ] Configuration reviewed (no dev values)
- [ ] API key is strong and unique
- [ ] CORS allowlist is restrictive
- [ ] QuickBooks authorized
- [ ] Installed as Windows Service
- [ ] Firewall configured
- [ ] Health checks working
- [ ] Backend integration tested
- [ ] Monitoring configured
- [ ] Documentation accessible

---

**Version**: 1.0.0  
**Last Updated**: 2024
