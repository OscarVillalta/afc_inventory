using System;
using System.Collections.Generic;
using System.Net;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace AfcQbAgent;

/// <summary>
/// Background service that implements the outbound-only polling architecture.
///
/// On each cycle the worker:
///   1. Calls GET {BackendBaseUrl}/api/qb/jobs to retrieve pending QB tasks.
///   2. For each job, builds QBXML and executes it against QuickBooks Desktop.
///   3. Posts the result to POST {BackendBaseUrl}/api/qb/results.
///
/// The HttpClient named "Backend" is pre-configured with the
/// Authorization: Bearer {AgentApiKey} header so no inbound ports are required
/// on the local network.
/// </summary>
public sealed class PollingWorker : BackgroundService
{
    private static readonly JsonSerializerOptions _jsonOptions =
        new() { PropertyNameCaseInsensitive = true };

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly JobRouter _jobRouter;
    private readonly PollingPolicy _policy;
    private readonly AgentConfig _config;
    private readonly ILogger<PollingWorker> _logger;

    public PollingWorker(
        IHttpClientFactory httpClientFactory,
        JobRouter jobRouter,
        PollingPolicy policy,
        AgentConfig config,
        ILogger<PollingWorker> logger)
    {
        _httpClientFactory = httpClientFactory;
        _jobRouter = jobRouter;
        _policy = policy;
        _config = config;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (string.IsNullOrWhiteSpace(_config.BackendBaseUrl))
        {
            _logger.LogWarning(
                "[PollingWorker] BackendBaseUrl is not configured. Polling disabled.");
            return;
        }

        _logger.LogInformation(
            "[PollingWorker] Starting. Backend: {Url}  Poll interval: {Secs}s",
            _config.BackendBaseUrl, _config.IdlePollSeconds);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await PollCycleAsync(stoppingToken);
                _policy.ResetErrors();
                await Task.Delay(_policy.IdleDelay(_config), stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[PollingWorker] Unhandled error during polling cycle");
                await Task.Delay(_policy.NextErrorDelay(_config), stoppingToken);
            }
        }

        _logger.LogInformation("[PollingWorker] Stopped.");
    }

    // -------------------------------------------------------------------------

    private async Task PollCycleAsync(CancellationToken ct)
    {
        var client = _httpClientFactory.CreateClient("Backend");

        // 1. Fetch pending jobs from the backend ---------------------------------
        HttpResponseMessage jobsResponse;
        try
        {
            jobsResponse = await client.GetAsync("/api/qb/jobs", ct);
        }
        catch (HttpRequestException ex)
        {
            _logger.LogWarning(ex,
                "[PollingWorker] Could not reach backend at {Url}", _config.BackendBaseUrl);
            throw;
        }

        if (jobsResponse.StatusCode == HttpStatusCode.NoContent)
        {
            _logger.LogDebug("[PollingWorker] No pending jobs.");
            return;
        }

        jobsResponse.EnsureSuccessStatusCode();

        var jobs = await jobsResponse.Content
            .ReadFromJsonAsync<List<JobDto>>(_jsonOptions, cancellationToken: ct);

        if (jobs == null || jobs.Count == 0)
        {
            _logger.LogDebug("[PollingWorker] Job list was empty.");
            return;
        }

        _logger.LogInformation("[PollingWorker] Received {Count} job(s).", jobs.Count);

        // 2 & 3. Execute each job and post the result back ----------------------
        foreach (var job in jobs)
        {
            if (ct.IsCancellationRequested)
                break;

            if (string.IsNullOrWhiteSpace(job.JobId))
                job.JobId = Guid.NewGuid().ToString("N");

            _logger.LogDebug(
                "[PollingWorker] Processing job {JobId}: {Op}/{Entity}",
                job.JobId, job.Op, job.Entity);

            var result = await _jobRouter.ExecuteJobAsync(job, ct);

            var postResponse = await client.PostAsJsonAsync(
                "/api/qb/results", result, _jsonOptions, ct);

            if (!postResponse.IsSuccessStatusCode)
            {
                _logger.LogWarning(
                    "[PollingWorker] Backend rejected result for job {JobId}: HTTP {Status}",
                    job.JobId, (int)postResponse.StatusCode);
            }
            else
            {
                _logger.LogDebug(
                    "[PollingWorker] Result accepted for job {JobId} (success={Success})",
                    job.JobId, result.Success);
            }
        }
    }
}
