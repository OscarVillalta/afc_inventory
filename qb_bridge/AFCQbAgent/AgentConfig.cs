namespace AfcQbAgent;

public sealed class AgentConfig
{
    public string BackendBaseUrl { get; set; } = "";
    public string ApiKeyHeaderName { get; set; } = "X-API-Key";
    public string ApiKey { get; set; } = "";

    public int IdlePollSeconds { get; set; } = 2;
    public int ErrorBackoffMinSeconds { get; set; } = 2;
    public int ErrorBackoffMaxSeconds { get; set; } = 30;
}
