using System;
using System.Net;

namespace RefxWordAddIn.Bridge;

public sealed class RefxBridgeException : Exception
{
    public RefxBridgeException(string message)
        : base(message)
    {
    }

    public RefxBridgeException(string message, Exception innerException)
        : base(message, innerException)
    {
    }

    public RefxBridgeException(HttpStatusCode? statusCode, string message, string? responseBody = null)
        : base(message)
    {
        StatusCode = statusCode;
        ResponseBody = responseBody;
    }

    public HttpStatusCode? StatusCode { get; }

    public string? ResponseBody { get; }
}
