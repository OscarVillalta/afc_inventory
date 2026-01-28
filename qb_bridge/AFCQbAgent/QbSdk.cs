using Microsoft.Extensions.Configuration;
using QBXMLRP2Lib;

namespace AfcQbAgent;

public sealed class QbSdk
{
    private readonly string _appId;
    private readonly string _appName;
    private readonly string _companyFilePath; // "" means "use currently open file"

    public QbSdk(IConfiguration config)
    {
        // Env vars supported too: QB_APP_ID, QB_APP_NAME, QB_COMPANY_FILE
        _appId = config["QuickBooks:AppId"] ?? config["QB_APP_ID"] ?? "AFC_QB_AGENT";
        _appName = config["QuickBooks:AppName"] ?? config["QB_APP_NAME"] ?? "AFC QuickBooks SDK Agent";
        _companyFilePath = config["QuickBooks:CompanyFilePath"] ?? config["QB_COMPANY_FILE"] ?? "";
    }

    public Task<string> ExecuteAsync(string qbxmlRequest, CancellationToken ct)
    {
        var tcs = new TaskCompletionSource<string>(TaskCreationOptions.RunContinuationsAsynchronously);

        var thread = new Thread(() =>
        {
            string ticket = "";
            RequestProcessor2? rp = null;

            try
            {
                ct.ThrowIfCancellationRequested();

                rp = new RequestProcessor2();

                Console.WriteLine($"[QbSdk] AppName={_appName} AppId={_appId}");
                Console.WriteLine("[QbSdk] Calling OpenConnection2...");
                rp.OpenConnection2(_appId, _appName, QBXMLRPConnectionType.localQBD);

                Console.WriteLine("[QbSdk] Calling BeginSession (open company file)...");
                ticket = rp.BeginSession(_companyFilePath, QBFileMode.qbFileOpenDoNotCare);

                Console.WriteLine("[QbSdk] Calling ProcessRequest...");
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
                try { if (rp != null && !string.IsNullOrWhiteSpace(ticket)) rp.EndSession(ticket); } catch { }
                try { rp?.CloseConnection(); } catch { }
            }
        });

        thread.SetApartmentState(ApartmentState.STA); // keep STA
        thread.IsBackground = true;
        thread.Start();

        ct.Register(() => tcs.TrySetCanceled(ct));
        return tcs.Task;
    }
}
