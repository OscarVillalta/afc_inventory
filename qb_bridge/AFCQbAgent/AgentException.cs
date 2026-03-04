using System;

namespace AfcQbAgent;

public sealed class AgentException : Exception
{
    public string Code { get; }

    public AgentException(string code, string message, Exception? inner = null)
        : base(message, inner)
    {
        Code = code;
    }
}
