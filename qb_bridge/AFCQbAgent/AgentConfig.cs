namespace AfcQbAgent;

public sealed class AgentConfig
{
    /// <summary>Base URL of the Python backend (must use HTTPS in production).</summary>
    public string BackendBaseUrl { get; set; } = "";

    /// <summary>Bearer token sent in the Authorization header to the backend.</summary>
    public string AgentApiKey { get; set; } = "";

    /// <summary>Seconds to wait between polling cycles when idle.</summary>
    public int IdlePollSeconds { get; set; } = 30;

    public int ErrorBackoffMinSeconds { get; set; } = 5;
    public int ErrorBackoffMaxSeconds { get; set; } = 60;
}
