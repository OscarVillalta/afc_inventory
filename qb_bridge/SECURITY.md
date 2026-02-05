# Security Considerations - AFC QuickBooks Bridge

## Overview

This document outlines the security measures implemented in the QuickBooks Bridge agent and recommendations for secure deployment.

## Implemented Security Features

### 1. Authentication & Authorization

#### API Key Authentication
- **Status**: ✅ Implemented
- **Configuration**: `Security:EnableAuthentication` in appsettings.json
- **Header**: `X-API-Key`
- All endpoints except `/health` require valid API key
- Configurable per environment (disabled in dev, enabled in prod)

**Recommendation**: 
- Use a cryptographically secure random key (minimum 32 bytes)
- Rotate API keys regularly (every 90 days)
- Never commit API keys to source control

### 2. Rate Limiting

#### Fixed Window Rate Limiter
- **Status**: ✅ Implemented
- **Default Limit**: 100 requests per minute per IP address
- **Queue**: 10 requests maximum
- **Response**: HTTP 429 (Too Many Requests) when exceeded

**Benefits**:
- Prevents DoS attacks
- Protects QuickBooks from overwhelming requests
- Fair resource distribution

**Tuning**: Adjust `PermitLimit` in Program.cs based on your needs.

### 3. CORS (Cross-Origin Resource Sharing)

#### Allowlist-Based CORS
- **Status**: ✅ Implemented
- **Configuration**: `Security:AllowedOrigins` in appsettings.json
- **Default**: `["http://localhost:6000"]`
- Only specified origins can make requests

**Recommendation**:
- Keep the allowlist as restrictive as possible
- Use specific URLs, avoid wildcards in production
- Include all necessary backend server URLs

### 4. Request Size Limits

#### Maximum Request Body Size
- **Status**: ✅ Implemented
- **Limit**: 10 MB per request
- **Configuration**: Kestrel limits in Program.cs

**Benefits**:
- Prevents memory exhaustion attacks
- Protects against large payload DoS

### 5. Input Validation

#### Strict QBXML Operation Allowlist
- **Status**: ✅ Implemented
- **Location**: QbxmlBuilder.cs
- **Allowed Operations**: query, create, add
- **Allowed Entities**: inventory, estimate, sales_order, invoice

**Benefits**:
- Prevents injection attacks via operation names
- Limits attack surface
- Predictable error messages

#### XML Input Sanitization
- **Status**: ✅ Implemented
- **Method**: `EscapeXml()` in QbxmlBuilder.cs
- Escapes: `&`, `<`, `>`, `"`, `'`

**Protection Against**:
- XML injection
- XXE (XML External Entity) attacks
- QBXML manipulation

### 6. Error Handling & Information Disclosure

#### Controlled Error Responses
- **Status**: ✅ Implemented
- **Production Mode**: Minimal error details
- **Debug Mode**: Full stack traces (controlled by logging level)
- Removed `ExceptionType` from public error responses

**Prevents**:
- Information leakage through stack traces
- Revealing internal implementation details
- Exposing file paths and system information

### 7. Logging Security

#### Structured Logging
- **Status**: ✅ Implemented
- **Framework**: Microsoft.Extensions.Logging
- Configurable log levels
- No sensitive data logged

**Best Practices**:
- Never log API keys, passwords, or tokens
- Log authentication failures for monitoring
- Use appropriate log levels (Debug/Info/Warning/Error)

## Security Vulnerabilities Addressed

### CRITICAL

#### 1. Hardcoded Credentials ✅ FIXED
- **Issue**: API key "dev-key-change-me" in appsettings.json
- **Risk**: Unauthorized access if default key used in production
- **Fix**: Removed default key, requires configuration
- **Verification**: Build fails without configured key in production

#### 2. No Authentication ✅ FIXED
- **Issue**: All endpoints were publicly accessible
- **Risk**: Anyone could execute QuickBooks operations
- **Fix**: Added API key middleware
- **Verification**: Test with/without X-API-Key header

#### 3. Unbounded Request Processing ✅ FIXED
- **Issue**: No timeout or size limits
- **Risk**: Resource exhaustion, DoS
- **Fix**: Added timeouts, request size limits, rate limiting

### HIGH

#### 4. Unrestricted CORS ✅ FIXED
- **Issue**: No CORS policy (default: allow all)
- **Risk**: Cross-site request forgery, data theft
- **Fix**: Allowlist-based CORS
- **Verification**: Test from unauthorized origin

#### 5. Information Disclosure ✅ FIXED
- **Issue**: Full stack traces in all error responses
- **Risk**: Reveals internal implementation, aids attackers
- **Fix**: Conditional stack traces (debug mode only)

#### 6. No Rate Limiting ✅ FIXED
- **Issue**: Unlimited requests per client
- **Risk**: DoS attacks, QuickBooks overwhelmed
- **Fix**: 100 req/min per IP with queue

### MEDIUM

#### 7. XML Injection Risk ✅ MITIGATED
- **Issue**: User input in QBXML
- **Risk**: XML injection, malformed requests
- **Fix**: Strict input sanitization with `EscapeXml()`

#### 8. No Input Validation ✅ FIXED
- **Issue**: Any operation/entity accepted
- **Risk**: Unexpected behavior, errors
- **Fix**: Strict allowlists for operations and entities

## Remaining Security Considerations

### Transport Layer Security

#### HTTPS/TLS
- **Status**: ⚠️ NOT IMPLEMENTED
- **Current**: HTTP only (localhost)
- **Risk**: Man-in-the-middle attacks on network traffic
- **Recommendation**: 
  - For local-only deployment (127.0.0.1): Current setup is acceptable
  - For network deployment: **MUST** implement HTTPS
  
**Future Implementation**:
```csharp
builder.WebHost.UseUrls("https://127.0.0.1:5055");
builder.WebHost.ConfigureKestrel(options =>
{
    options.Listen(IPAddress.Loopback, 5055, listenOptions =>
    {
        listenOptions.UseHttps("certificate.pfx", "password");
    });
});
```

### Secrets Management

#### Current: Configuration Files
- **Status**: ⚠️ BASIC PROTECTION
- **Storage**: appsettings.json, environment variables
- **Risk**: Secrets in config files

**Recommendations for Production**:
1. **Azure Key Vault** (if using Azure)
2. **HashiCorp Vault**
3. **Windows Credential Manager**
4. **.NET User Secrets** (development only)

### Authentication Methods

#### Current: Static API Key
- **Status**: ⚠️ BASIC
- **Limitation**: Shared secret, no per-user auth

**Future Enhancements**:
1. **OAuth 2.0/OpenID Connect**: For user-level authentication
2. **Certificate-based Auth**: Mutual TLS
3. **JWT Tokens**: Stateless, time-limited tokens

### Audit Logging

#### Current: Basic Logging
- **Status**: ⚠️ MINIMAL
- **Logs**: Operation attempts, errors
- **Missing**: Who did what, when, from where

**Recommendations**:
1. Log all authenticated requests with:
   - Timestamp
   - Source IP
   - User/API key identifier
   - Operation attempted
   - Success/failure
2. Store logs securely
3. Regular log review
4. Set up alerts for suspicious patterns

## Deployment Security Checklist

### Pre-Deployment

- [ ] Generate strong API key (32+ bytes, cryptographically random)
- [ ] Configure CORS allowlist (backend URL only)
- [ ] Enable authentication (`Security:EnableAuthentication: true`)
- [ ] Remove development settings from production config
- [ ] Review and configure rate limits
- [ ] Set up HTTPS (if exposing beyond localhost)
- [ ] Configure Windows Firewall (port 5055, specific IPs only)

### Production Environment

- [ ] Run service with minimum required privileges
- [ ] Enable Windows Event Log logging
- [ ] Set up monitoring and alerting
- [ ] Regular security updates (.NET, Windows, QuickBooks)
- [ ] Backup configuration securely
- [ ] Document incident response procedures

### Ongoing Maintenance

- [ ] Rotate API keys every 90 days
- [ ] Review access logs monthly
- [ ] Update dependencies regularly
- [ ] Monitor for security advisories
- [ ] Conduct periodic security assessments

## Security Testing

### Authentication Tests

```powershell
# Test without API key (should fail)
Invoke-WebRequest -Uri "http://127.0.0.1:5055/jobs" -Method Post -Body '{}' -ContentType "application/json"
# Expected: 401 Unauthorized

# Test with invalid API key (should fail)
$headers = @{ "X-API-Key" = "invalid-key" }
Invoke-WebRequest -Uri "http://127.0.0.1:5055/jobs" -Method Post -Body '{}' -Headers $headers
# Expected: 401 Unauthorized

# Test with valid API key (should succeed)
$headers = @{ "X-API-Key" = "YOUR_VALID_KEY" }
Invoke-WebRequest -Uri "http://127.0.0.1:5055/jobs" -Method Post -Body '{"op":"ping","entity":"quickbooks"}' -Headers $headers
# Expected: 200 OK
```

### Rate Limiting Tests

```powershell
# Flood the endpoint
1..150 | ForEach-Object {
    Invoke-WebRequest -Uri "http://127.0.0.1:5055/health" -Method Get
}
# Expected: Last 50 requests should get 429 Too Many Requests
```

### Input Validation Tests

```powershell
# Test invalid operation
$body = @{ op = "delete"; entity = "sales_order" } | ConvertTo-Json
Invoke-WebRequest -Uri "http://127.0.0.1:5055/jobs" -Method Post -Body $body -Headers $headers
# Expected: Error about unsupported operation

# Test XML injection attempt
$body = @{ 
    op = "query"; 
    entity = "sales_order"; 
    params = @{ refnumber = "123</RefNumber><Evil>payload</Evil><RefNumber>" }
} | ConvertTo-Json
Invoke-WebRequest -Uri "http://127.0.0.1:5055/jobs" -Method Post -Body $body -Headers $headers
# Expected: XML properly escaped in request
```

## Incident Response

### Security Event Detection

Monitor for:
1. **Repeated 401 errors**: Brute force attempts
2. **Repeated 429 errors**: DoS attempts
3. **Invalid operation attempts**: Reconnaissance
4. **Unusual access patterns**: Compromised credentials

### Response Procedures

1. **Suspected Compromise**:
   - Immediately rotate API keys
   - Review all recent access logs
   - Check for unauthorized QuickBooks operations
   - Notify relevant stakeholders

2. **Active Attack**:
   - Stop the service temporarily
   - Block attacking IP at firewall
   - Review and strengthen security settings
   - Restart with new API key

3. **Data Breach**:
   - Document all affected operations
   - Review QuickBooks audit logs
   - Notify affected parties
   - Conduct post-incident review

## Compliance Considerations

### Data Protection

- QuickBooks data may contain:
  - Customer information (names, addresses)
  - Financial data (prices, payments)
  - Business confidential information

**Requirements**:
- Secure transmission (HTTPS for network deployments)
- Access logging and audit trails
- Regular security assessments
- Data retention policies

### QuickBooks License Agreement

Ensure compliance with:
- Intuit Developer Agreement
- QuickBooks SDK License
- Data usage restrictions

## Security Contact

For security issues or questions:
- Internal Security Team: [Contact]
- Report vulnerabilities: [Email/System]

---

**Document Version**: 1.0  
**Last Updated**: 2024  
**Review Frequency**: Quarterly
