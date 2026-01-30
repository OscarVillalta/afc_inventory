using System;
using System.Threading;
using System.Threading.Tasks;

namespace AfcQbAgent;

public sealed class JobRouter
{
    private readonly QbSdk _qbSdk;
    private readonly QbxmlBuilder _qbxmlBuilder;

    public JobRouter(QbSdk qbSdk, QbxmlBuilder qbxmlBuilder)
    {
        _qbSdk = qbSdk;
        _qbxmlBuilder = qbxmlBuilder;
    }

    public async Task<JobResultDto> ExecuteJobAsync(JobDto job, CancellationToken ct)
    {
        if (job == null)
            throw new ArgumentNullException(nameof(job));

        // Health check job

        if (string.Equals(job.Op, "ping", StringComparison.OrdinalIgnoreCase) &&
            string.Equals(job.Entity, "agent", StringComparison.OrdinalIgnoreCase))
        {
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
            // 1) Build QBXML request
            var requestXml = _qbxmlBuilder.Build(job);

            // 2) Execute against QuickBooks (raw QBXML in / raw QBXML out)
            var responseXml = await _qbSdk.ExecuteAsync(requestXml, ct);

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

            return new JobResultDto
            {
                JobId = job.JobId,
                Success = false,
                ErrorCode = errorCode,
                ErrorMessage = ex.Message,
                ExceptionType = ex.GetType().Name,
                StackTrace = ex.StackTrace
            };
        }

    }
}
