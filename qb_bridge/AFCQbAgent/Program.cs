using AfcQbAgent;
using Microsoft.AspNetCore.RateLimiting;
using System.Security.Cryptography;
using System.Text;
using System.Threading.RateLimiting;

var builder = WebApplication.CreateBuilder(args);

// Support running as a Windows Service (24/7 background service)
builder.Host.UseWindowsService();

// Configure Kestrel to listen strictly on localhost:5000 (behind Cloudflare Tunnel)
builder.WebHost.ConfigureKestrel(options =>
{
    options.ListenLocalhost(5000);
    options.Limits.MaxRequestBodySize = 10 * 1024 * 1024; // 10MB max
});

// DI
builder.Services.AddSingleton<QbSdk>();
builder.Services.AddSingleton<QbxmlBuilder>();
builder.Services.AddSingleton<JobRouter>();

// CORS configuration
var allowedOrigins = builder.Configuration.GetSection("Security:AllowedOrigins").Get<string[]>() 
    ?? new[] { "http://localhost:6000" };

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins(allowedOrigins)
              .AllowAnyMethod()
              .AllowAnyHeader()
              .SetIsOriginAllowedToAllowWildcardSubdomains();
    });
});

// Rate limiting to prevent DoS
builder.Services.AddRateLimiter(options =>
{
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: partition => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 100,
                Window = TimeSpan.FromMinutes(1),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 10
            }));
    
    options.OnRejected = async (context, token) =>
    {
        context.HttpContext.Response.StatusCode = 429;
        await context.HttpContext.Response.WriteAsJsonAsync(new
        {
            error = "Too many requests. Please try again later.",
            retryAfter = context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter) 
                ? retryAfter.TotalSeconds 
                : 60
        }, cancellationToken: token);
    };
});

// JSON settings (important for dictionary/object + JsonElement handling)
builder.Services.ConfigureHttpJsonOptions(o =>
{
    // keep defaults; your JsonElementExtensions handles JsonElement conversion
});

var app = builder.Build();

// Enable CORS
app.UseCors();

// Enable rate limiting
app.UseRateLimiter();

// API Key authentication middleware (Bearer token required on all non-health endpoints)
var agentApiKey = builder.Configuration["AgentApiKey"];

app.Use(async (context, next) =>
{
    // Skip auth for health endpoint (monitoring/uptime probes)
    if (context.Request.Path.StartsWithSegments("/health"))
    {
        await next();
        return;
    }

    // Require "Authorization: Bearer <token>" header
    var authHeader = context.Request.Headers["Authorization"].FirstOrDefault();
    var token = authHeader?.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase) == true
        ? authHeader["Bearer ".Length..].Trim()
        : null;

    if (string.IsNullOrWhiteSpace(token) || string.IsNullOrWhiteSpace(agentApiKey) ||
        !CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(token),
            Encoding.UTF8.GetBytes(agentApiKey)))
    {
        context.Response.StatusCode = 401;
        await context.Response.WriteAsJsonAsync(new
        {
            error = "Unauthorized. Valid 'Authorization: Bearer <token>' header required."
        });
        return;
    }

    await next();
});

// ---------- Health (no QB call) ----------
app.MapGet("/health", () => Results.Ok(new
{
    ok = true,
    service = "afc-qb-agent",
    version = "1.0.0",
    timeUtc = DateTime.UtcNow
}));

// ---------- Health (QB call) ----------
app.MapGet("/health/qb", async (JobRouter router, CancellationToken ct) =>
{
    var job = new JobDto
    {
        Op = "ping",
        Entity = "quickbooks"
    };

    var result = await router.ExecuteJobAsync(job, ct);

    return result.Success
        ? Results.Ok(new { ok = true, qb = "reachable", jobId = result.JobId })
        : Results.Problem(
            title: "QuickBooks not reachable",
            detail: result.ErrorMessage,
            statusCode: 503,
            extensions: new Dictionary<string, object?>
            {
                ["jobId"] = result.JobId,
                ["errorCode"] = result.ErrorCode
                // Note: Removed sensitive fields like stack trace and exception type
            });
});

// ---------- Main job endpoint ----------
app.MapPost("/jobs", async (JobDto job, JobRouter router, CancellationToken ct) =>
{
    // Guarantee JobId exists for correlation
    if (string.IsNullOrWhiteSpace(job.JobId))
        job.JobId = Guid.NewGuid().ToString("N");

    var result = await router.ExecuteJobAsync(job, ct);

    // Always 200 with structured payload (Flask can decide what to do)
    // If you prefer HTTP error codes, we can change this later.
    return Results.Ok(result);
});

// ---------- Execute endpoint (Cloudflare Tunnel / Python backend) ----------
app.MapPost("/api/qb/execute", async (JobDto job, JobRouter router, CancellationToken ct) =>
{
    // Guarantee JobId exists for correlation
    if (string.IsNullOrWhiteSpace(job.JobId))
        job.JobId = Guid.NewGuid().ToString("N");

    var result = await router.ExecuteJobAsync(job, ct);

    if (!result.Success)
    {
        return Results.Json(result, statusCode: result.ErrorCode?.StartsWith("QBSDK_COM") == true ? 500 : 400);
    }

    return Results.Ok(result);
});

// Graceful shutdown
var lifetime = app.Services.GetRequiredService<IHostApplicationLifetime>();
lifetime.ApplicationStopping.Register(() =>
{
    Console.WriteLine("[Shutdown] AFC QB Agent is shutting down gracefully...");
});

app.Run();
