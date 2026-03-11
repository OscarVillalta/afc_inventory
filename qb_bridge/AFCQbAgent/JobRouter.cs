using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;

namespace AfcQbAgent;

public sealed class JobRouter
{
    private readonly QbSdk _qbSdk;
    private readonly QbxmlBuilder _qbxmlBuilder;
    private readonly ILogger<JobRouter>? _logger;

    public JobRouter(QbSdk qbSdk, QbxmlBuilder qbxmlBuilder, ILogger<JobRouter>? logger = null)
    {
        _qbSdk = qbSdk;
        _qbxmlBuilder = qbxmlBuilder;
        _logger = logger;
    }

    public async Task<JobResultDto> ExecuteJobAsync(JobDto job, CancellationToken ct)
    {
        if (job == null)
            throw new ArgumentNullException(nameof(job));

        _logger?.LogInformation("Executing job {JobId}: {Op}/{Entity}", job.JobId, job.Op, job.Entity);

        // Health check job (agent ping - no QB call)
        if (string.Equals(job.Op, "ping", StringComparison.OrdinalIgnoreCase) &&
            string.Equals(job.Entity, "agent", StringComparison.OrdinalIgnoreCase))
        {
            _logger?.LogDebug("Agent ping successful");
            return new JobResultDto
            {
                JobId = job.JobId,
                Success = true,
                QbxmlRequest = null,
                QbxmlResponse = "OK"
            };
        }

        try
        {
            string requestXml;

            if (!string.IsNullOrWhiteSpace(job.RawQbxml))
            {
                // Caller provided raw QBXML — send it directly to QuickBooks
                _logger?.LogDebug("Using raw QBXML for job {JobId}", job.JobId);
                requestXml = job.RawQbxml;
            }
            else
            {
                // 1) Build QBXML request from Op/Entity/Params
                _logger?.LogDebug("Building QBXML request for job {JobId}", job.JobId);
                requestXml = _qbxmlBuilder.Build(job);
            }

            // 2) Execute against QuickBooks (raw QBXML in / raw QBXML out)
            _logger?.LogDebug("Executing QBXML request for job {JobId}", job.JobId);
            var responseXml = await _qbSdk.ExecuteAsync(requestXml, ct);

            _logger?.LogInformation("Job {JobId} completed successfully", job.JobId);

            // 3) Return raw payloads only
            return new JobResultDto
            {
                JobId = job.JobId,
                Success = true,
                QbxmlRequest = requestXml,
                QbxmlResponse = responseXml
            };
        }
        catch (Exception ex)
        {
            var errorCode = "AGENT_ERROR";

            if (ex is AgentException aex)
                errorCode = aex.Code;

            _logger?.LogError(ex, "Job {JobId} failed with error code {ErrorCode}", job.JobId, errorCode);

            // Only include stack trace in development/debug mode
            var includeStackTrace = _logger?.IsEnabled(LogLevel.Debug) ?? false;

            return new JobResultDto
            {
                JobId = job.JobId,
                Success = false,
                ErrorCode = errorCode,
                ErrorMessage = ex.Message,
                ExceptionType = ex.GetType().Name,
                StackTrace = includeStackTrace ? ex.StackTrace : null
            };
        }

    }
}
