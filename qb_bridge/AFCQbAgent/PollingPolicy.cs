using System;

namespace AfcQbAgent;

public sealed class PollingPolicy
{
    private int _currentErrorBackoffSeconds;

    public TimeSpan IdleDelay(AgentConfig cfg) =>
        TimeSpan.FromSeconds(Math.Max(1, cfg.IdlePollSeconds));

    public TimeSpan NextErrorDelay(AgentConfig cfg)
    {
        var min = Math.Max(1, cfg.ErrorBackoffMinSeconds);
        var max = Math.Max(min, cfg.ErrorBackoffMaxSeconds);

        if (_currentErrorBackoffSeconds <= 0) _currentErrorBackoffSeconds = min;
        else _currentErrorBackoffSeconds = Math.Min(max, _currentErrorBackoffSeconds * 2);

        // small jitter (0-250ms)
        var jitterMs = Random.Shared.Next(0, 250);
        return TimeSpan.FromSeconds(_currentErrorBackoffSeconds) + TimeSpan.FromMilliseconds(jitterMs);
    }

    public void ResetErrors() => _currentErrorBackoffSeconds = 0;
}
