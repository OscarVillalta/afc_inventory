// NOTE: This Worker class is for STANDALONE TESTING ONLY.
// It is not used when running the web API.
// To test the QB agent standalone, you can temporarily add this as a hosted service in Program.cs

using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Hosting;

namespace AfcQbAgent;

public sealed class Worker : BackgroundService
{
    private readonly JobRouter _jobRouter;

    public Worker(JobRouter jobRouter)
    {
        _jobRouter = jobRouter;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        Console.WriteLine("[Worker] AFC QB Agent Worker started (TESTING MODE).");
        Console.WriteLine("[Worker] WARNING: This is for standalone testing only!");

        while (!stoppingToken.IsCancellationRequested)
        {
            // ---- Test job (standalone mode) ----
            var job = new JobDto
            {
                JobId = Guid.NewGuid().ToString("N"),
                Op = "query",
                Entity = "sales_order",
                // Optional params for queries
                Params =
                {
                    // "active_status": "All" | "ActiveOnly" | "InactiveOnly"
                    ["refnumber"] = "8800"
                }
            };

            Console.WriteLine($"[Worker] Executing job {job.JobId} ({job.Op}/{job.Entity})...");

            var result = await _jobRouter.ExecuteJobAsync(job, stoppingToken);

            Console.WriteLine("--------------------------------------------------");
            Console.WriteLine($"Success: {result.Success}");
            if (!string.IsNullOrWhiteSpace(result.ErrorMessage))
                Console.WriteLine($"Error: {result.ErrorMessage}");

            if (!string.IsNullOrWhiteSpace(result.QbxmlRequest))
            {
                Console.WriteLine("\nQBXML Request:");
                Console.WriteLine(result.QbxmlRequest);
            }

            if (!string.IsNullOrWhiteSpace(result.QbxmlResponse))
            {
                Console.WriteLine("\nQBXML Response:");
                Console.WriteLine(result.QbxmlResponse);
            }
            Console.WriteLine("--------------------------------------------------");

            // Wait before running again (standalone loop)
            await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);
        }
    }
}
