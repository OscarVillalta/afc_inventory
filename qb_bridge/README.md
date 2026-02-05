# AFC QuickBooks Bridge Agent

A secure, production-ready API server that connects the AFC Inventory web application to QuickBooks Desktop via the QuickBooks SDK.

## Overview

This .NET application provides a lightweight REST API that translates HTTP requests into QBXML queries and executes them against QuickBooks Desktop using the QuickBooks SDK COM library.

## Features

- ✅ **Security**: API key authentication, CORS protection, rate limiting, request size limits
- ✅ **Reliability**: Automatic retries, timeout handling, graceful shutdown
- ✅ **Monitoring**: Structured logging, health check endpoints
- ✅ **Production-ready**: Error handling, configuration validation, proper resource cleanup

## Requirements

- **Windows OS** (QuickBooks Desktop is Windows-only)
- **.NET 10.0 or higher**
- **QuickBooks Desktop** installed and running
- **QuickBooks SDK (QBXMLRP2)** installed
- **Windows for building** - The COM reference cannot be built on Linux/Mac

> ⚠️ **Important**: This application can only be built and run on Windows due to QuickBooks Desktop's dependency on the Windows-only QBXMLRP2 COM library. Building on Linux or macOS will fail with error MSB4803.

## Configuration

### appsettings.json (Production)

Create or update `appsettings.json`:

```json
{
  "QuickBooks": {
    "AppId": "YOUR_UNIQUE_APP_ID",
    "AppName": "AFC QuickBooks Agent",
    "CompanyFilePath": ""
  },
  "Security": {
    "ApiKey": "YOUR_SECURE_API_KEY_HERE",
    "AllowedOrigins": ["http://localhost:6000"],
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

### Environment Variables (Alternative)

You can also configure via environment variables:

```bash
# QuickBooks
QB_APP_ID=YOUR_APP_ID
QB_APP_NAME=AFC QuickBooks Agent
QB_COMPANY_FILE=

# Security
Security__ApiKey=YOUR_SECURE_API_KEY
```

### Configuration Options

#### QuickBooks Settings

- **AppId**: Unique identifier for your application (registered with QuickBooks)
- **AppName**: Display name shown in QuickBooks
- **CompanyFilePath**: Path to .qbw file (empty = use currently open file)

#### Security Settings

- **ApiKey**: Required for production. Use a strong, randomly generated key
- **AllowedOrigins**: List of allowed CORS origins (your backend URL)
- **EnableAuthentication**: Set to `true` in production, `false` for development

#### Connection Settings

- **TimeoutSeconds**: How long to wait for QB operations (default: 30)
- **MaxRetries**: Number of retry attempts for transient failures (default: 3)
- **RetryDelaySeconds**: Base delay between retries (default: 2, uses exponential backoff)

## QuickBooks Setup

### 1. Authorize the Application

1. Open QuickBooks Desktop as an Administrator
2. Run the QB Agent for the first time
3. QuickBooks will prompt you to authorize the application
4. Click "Yes, always allow access" or configure permissions as needed

### 2. Configure Integrated Applications

If you need to modify permissions later:

1. In QuickBooks, go to **Edit → Preferences**
2. Select **Integrated Applications** → **Company Preferences**
3. Find "AFC QuickBooks Agent" in the list
4. Configure access permissions as needed

## Running the Application

### Development Mode

```bash
cd AFCQbAgent
dotnet run
```

The server will start on `http://127.0.0.1:5055`

### Production Mode

```bash
cd AFCQbAgent
dotnet publish -c Release
cd bin/Release/net10.0/publish
./AFCQbAgent.exe
```

### As a Windows Service

Consider using [NSSM](https://nssm.cc/) or the built-in Windows Service capabilities:

```bash
# Using Microsoft.Extensions.Hosting.WindowsServices (already included)
# Build the application with:
dotnet publish -c Release

# Install as service using sc.exe or NSSM
```

## API Endpoints

### Health Check (No QB)

```http
GET /health
```

Returns basic service health without connecting to QuickBooks.

**Response:**
```json
{
  "ok": true,
  "service": "afc-qb-agent",
  "version": "1.0.0",
  "timeUtc": "2024-01-15T10:30:00Z"
}
```

### Health Check (With QB)

```http
GET /health/qb
```

Tests the connection to QuickBooks.

**Response (Success):**
```json
{
  "ok": true,
  "qb": "reachable",
  "jobId": "abc123"
}
```

### Execute Job

```http
POST /jobs
Content-Type: application/json
X-API-Key: your-api-key-here

{
  "jobId": "optional-correlation-id",
  "op": "query",
  "entity": "sales_order",
  "params": {
    "refnumber": "8800"
  }
}
```

**Supported Operations:**

- `op: "query"` - Query QuickBooks data
- `op: "create"` or `"add"` - Create new records

**Supported Entities:**

- `entity: "inventory"` - Inventory items
- `entity: "estimate"` - Estimates
- `entity: "sales_order"` - Sales orders
- `entity: "invoice"` - Invoices

## Security

### API Key Authentication

When `Security:EnableAuthentication` is `true`, all requests (except `/health`) must include:

```http
X-API-Key: your-api-key-here
```

### CORS Protection

Only origins listed in `Security:AllowedOrigins` can make requests to the API.

### Rate Limiting

Default: 100 requests per minute per IP address. Requests exceeding this limit receive a 429 status.

### Request Size Limits

Maximum request body size: 10 MB

## Error Handling

The API returns structured error responses:

```json
{
  "jobId": "abc123",
  "success": false,
  "errorCode": "QBSDK_COM_0x80040418",
  "errorMessage": "QuickBooks authorization required...",
  "exceptionType": "COMException"
}
```

### Common Error Codes

- `QBSDK_AUTH_REQUIRED` (0x80040418): QuickBooks hasn't authorized the app
- `QBSDK_COM_*`: QuickBooks SDK COM errors
- `QBSDK_ERROR`: General QuickBooks SDK errors
- `AGENT_ERROR`: Other application errors

## Troubleshooting

### QuickBooks Not Reachable

1. Ensure QuickBooks Desktop is running
2. Check that the company file is open
3. Verify the application is authorized (see QuickBooks Setup)

### Authorization Error (0x80040418)

1. Open QuickBooks as Administrator
2. Go to Edit → Preferences → Integrated Applications
3. Authorize "AFC QuickBooks Agent"

### Connection Timeout

1. Increase `Connection:TimeoutSeconds` in configuration
2. Check if QuickBooks is responding slowly
3. Review QuickBooks performance and database size

### High Memory Usage

The QB SDK COM library may retain memory between requests. Consider:
1. Restarting the service periodically
2. Monitoring memory usage
3. Implementing a scheduled restart (e.g., nightly)

## Monitoring

### Logging

Logs are written to console by default. Configure log levels in `appsettings.json`:

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "AfcQbAgent": "Debug"
    }
  }
}
```

### Recommended Production Logging

Consider adding:
- File logging (Serilog, NLog)
- Windows Event Log
- Application Insights or other APM tools

## Performance Considerations

### Connection Pooling

The QB SDK doesn't support true connection pooling. Each request:
1. Opens a connection to QuickBooks
2. Begins a session
3. Processes the request
4. Ends the session
5. Closes the connection

### Concurrent Requests

QuickBooks Desktop may have limitations on concurrent requests. The agent handles requests sequentially by default.

### Retry Logic

- Automatically retries transient failures up to `MaxRetries` times
- Uses exponential backoff between retries
- Authorization errors are not retried (fail immediately)

## Development

### Testing Without QuickBooks

The `/health` endpoint doesn't require QuickBooks and can be used for basic connectivity tests.

### Standalone Testing Mode

`Worker.cs` contains a standalone test mode (not used in production). To enable:

1. Add to Program.cs: `builder.Services.AddHostedService<Worker>();`
2. Run the application
3. It will execute test queries every 10 seconds

⚠️ **Do not enable Worker in production!**

## License

Internal use for AFC Inventory system.

## Support

For issues or questions, contact the development team.
