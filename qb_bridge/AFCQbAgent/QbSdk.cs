using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using QBXMLRP2Lib;

namespace AfcQbAgent;

public sealed class QbSdk
{
    private readonly string _appId;
    private readonly string _appName;
    private readonly string _companyFilePath; // "" means "use currently open file"
    private readonly int _timeoutSeconds;
    private readonly int _maxRetries;
    private readonly int _retryDelaySeconds;
    private readonly ILogger<QbSdk>? _logger;

    public QbSdk(IConfiguration config, ILogger<QbSdk>? logger = null)
    {
        _logger = logger;
        
        // Env vars supported too: QB_APP_ID, QB_APP_NAME, QB_COMPANY_FILE
        _appId = config["QuickBooks:AppId"] ?? config["QB_APP_ID"] ?? "AFC_QB_AGENT";
        _appName = config["QuickBooks:AppName"] ?? config["QB_APP_NAME"] ?? "AFC QuickBooks SDK Agent";
        _companyFilePath = config["QuickBooks:CompanyFilePath"] ?? config["QB_COMPANY_FILE"] ?? "";
        
        // Connection settings
        _timeoutSeconds = config.GetValue<int?>("Connection:TimeoutSeconds") ?? 30;
        _maxRetries = config.GetValue<int?>("Connection:MaxRetries") ?? 3;
        _retryDelaySeconds = config.GetValue<int?>("Connection:RetryDelaySeconds") ?? 2;

        // Validate configuration
        if (string.IsNullOrWhiteSpace(_appId))
            throw new InvalidOperationException("QuickBooks AppId is required. Set it in appsettings.json or QB_APP_ID environment variable.");
        
        _logger?.LogInformation("QbSdk initialized: AppId={AppId}, Timeout={Timeout}s, MaxRetries={MaxRetries}", 
            _appId, _timeoutSeconds, _maxRetries);
    }

    public async Task<string> ExecuteAsync(string qbxmlRequest, CancellationToken ct)
    {
        var attempt = 0;
        Exception? lastException = null;

        while (attempt < _maxRetries)
        {
            attempt++;
            
            try
            {
                _logger?.LogDebug("QB SDK attempt {Attempt}/{MaxRetries}", attempt, _maxRetries);
                return await ExecuteWithTimeoutAsync(qbxmlRequest, ct);
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                _logger?.LogWarning("QB SDK request cancelled by client");
                throw;
            }
            catch (TimeoutException tex)
            {
                lastException = tex;
                _logger?.LogWarning("QB SDK timeout on attempt {Attempt}/{MaxRetries}: {Message}", 
                    attempt, _maxRetries, tex.Message);
                
                if (attempt < _maxRetries)
                {
                    var delay = _retryDelaySeconds * attempt; // Exponential backoff
                    _logger?.LogInformation("Retrying in {Delay} seconds...", delay);
                    await Task.Delay(TimeSpan.FromSeconds(delay), ct);
                }
            }
            catch (System.Runtime.InteropServices.COMException comEx)
            {
                // Don't retry authorization errors
                if (comEx.ErrorCode == unchecked((int)0x80040418))
                {
                    _logger?.LogError("QB authorization required (0x80040418)");
                    throw new AgentException(
                        "QBSDK_AUTH_REQUIRED",
                        "QuickBooks authorization required. Log into QuickBooks as Admin and allow this app under Integrated Applications.",
                        comEx);
                }
                
                lastException = comEx;
                _logger?.LogWarning(comEx, "COM error on attempt {Attempt}/{MaxRetries}: 0x{ErrorCode:X8}", 
                    attempt, _maxRetries, comEx.ErrorCode);
                
                if (attempt < _maxRetries)
                {
                    var delay = _retryDelaySeconds * attempt;
                    await Task.Delay(TimeSpan.FromSeconds(delay), ct);
                }
            }
            catch (Exception ex)
            {
                lastException = ex;
                _logger?.LogWarning(ex, "Error on attempt {Attempt}/{MaxRetries}", attempt, _maxRetries);
                
                if (attempt < _maxRetries)
                {
                    var delay = _retryDelaySeconds * attempt;
                    await Task.Delay(TimeSpan.FromSeconds(delay), ct);
                }
            }
        }

        // All retries exhausted
        var finalException = lastException ?? new Exception("Unknown error after all retries");
        _logger?.LogError(finalException, "All {MaxRetries} attempts failed", _maxRetries);
        
        if (finalException is System.Runtime.InteropServices.COMException comExFinal)
        {
            var hex = $"0x{comExFinal.ErrorCode:X8}";
            throw new AgentException($"QBSDK_COM_{hex}", 
                $"QuickBooks SDK error after {_maxRetries} attempts: {comExFinal.Message}", 
                comExFinal);
        }
        
        throw new AgentException("QBSDK_ERROR", 
            $"QuickBooks SDK failed after {_maxRetries} attempts: {finalException.Message}", 
            finalException);
    }

    private Task<string> ExecuteWithTimeoutAsync(string qbxmlRequest, CancellationToken ct)
    {
        var tcs = new TaskCompletionSource<string>(TaskCreationOptions.RunContinuationsAsynchronously);
        Thread? thread = null;

        try
        {
            thread = new Thread(() =>
            {
                string ticket = "";
                RequestProcessor2? rp = null;

                try
                {
                    ct.ThrowIfCancellationRequested();

                    rp = new RequestProcessor2();

                    _logger?.LogDebug("Opening QB connection: AppName={AppName}, AppId={AppId}", _appName, _appId);
                    rp.OpenConnection2(_appId, _appName, QBXMLRPConnectionType.localQBD);

                    _logger?.LogDebug("Beginning QB session with company file: {CompanyFile}", 
                        string.IsNullOrWhiteSpace(_companyFilePath) ? "(current)" : _companyFilePath);
                    ticket = rp.BeginSession(_companyFilePath, QBFileMode.qbFileOpenDoNotCare);

                    _logger?.LogDebug("Processing QB request...");
                    var response = rp.ProcessRequest(ticket, qbxmlRequest);

                    tcs.TrySetResult(response);
                }
                catch (System.Runtime.InteropServices.COMException comEx)
                {
                    var hex = $"0x{comEx.ErrorCode:X8}";
                    var code = $"QBSDK_COM_{hex}";

                    var msg = comEx.ErrorCode == unchecked((int)0x80040418)
                        ? "QuickBooks authorization required. Log into QuickBooks as Admin and allow this app under Integrated Applications."
                        : comEx.Message;

                    tcs.TrySetException(new AgentException(code, msg, comEx));
                }
                catch (Exception ex)
                {
                    tcs.TrySetException(new AgentException("QBSDK_ERROR", ex.Message, ex));
                }
                finally
                {
                    // Always clean up QB resources
                    try 
                    { 
                        if (rp != null && !string.IsNullOrWhiteSpace(ticket)) 
                        {
                            _logger?.LogDebug("Ending QB session");
                            rp.EndSession(ticket); 
                        }
                    } 
                    catch (Exception ex) 
                    {
                        _logger?.LogWarning(ex, "Error ending QB session");
                    }
                    
                    try 
                    { 
                        if (rp != null)
                        {
                            _logger?.LogDebug("Closing QB connection");
                            rp.CloseConnection(); 
                        }
                    } 
                    catch (Exception ex)
                    {
                        _logger?.LogWarning(ex, "Error closing QB connection");
                    }
                }
            })
            {
                IsBackground = true,
                Name = $"QB-SDK-Thread-{Guid.NewGuid():N}"
            };

            thread.SetApartmentState(ApartmentState.STA); // Required for COM
            thread.Start();

            // Set up timeout
            var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeoutCts.CancelAfter(TimeSpan.FromSeconds(_timeoutSeconds));
            
            timeoutCts.Token.Register(() =>
            {
                if (!tcs.Task.IsCompleted)
                {
                    _logger?.LogWarning("QB SDK operation timed out after {Timeout} seconds", _timeoutSeconds);
                    tcs.TrySetException(new TimeoutException(
                        $"QuickBooks SDK operation timed out after {_timeoutSeconds} seconds"));
                }
            });

            return tcs.Task;
        }
        catch (Exception ex)
        {
            _logger?.LogError(ex, "Error setting up QB SDK thread");
            throw new AgentException("QBSDK_SETUP_ERROR", "Failed to initialize QuickBooks SDK thread", ex);
        }
    }
}
