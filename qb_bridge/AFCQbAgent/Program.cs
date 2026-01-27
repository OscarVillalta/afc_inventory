using AfcQbAgent;

var builder = WebApplication.CreateBuilder(args);

// Set the URL to listen on
builder.WebHost.UseUrls("http://127.0.0.1:5055");

// DI
builder.Services.AddSingleton<QbSdk>();
builder.Services.AddSingleton<QbxmlBuilder>();
builder.Services.AddSingleton<JobRouter>();

// JSON settings (important for dictionary/object + JsonElement handling)
builder.Services.ConfigureHttpJsonOptions(o =>
{
    // keep defaults; your JsonElementExtensions handles JsonElement conversion
});

var app = builder.Build();

// ---------- Health (no QB call) ----------
app.MapGet("/health", () => Results.Ok(new
{
    ok = true,
    service = "afc-qb-agent",
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
                ["errorCode"] = result.ErrorCode,
                ["exceptionType"] = result.ExceptionType
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

app.Run();
