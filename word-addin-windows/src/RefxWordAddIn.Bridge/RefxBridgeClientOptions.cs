using System;
using System.Configuration;

namespace RefxWordAddIn.Bridge;

public sealed class RefxBridgeClientOptions
{
    public RefxBridgeClientOptions(Uri baseUri)
    {
        BaseUri = NormalizeBaseUri(baseUri);
    }

    public Uri BaseUri { get; }

    public TimeSpan Timeout { get; set; } = TimeSpan.FromSeconds(3);

    public string UserAgent { get; set; } = "RefxWordAddIn.Windows/1.0";

    public static RefxBridgeClientOptions FromAppSettings()
    {
        var configuredBaseUrl = ConfigurationManager.AppSettings["BridgeBaseUrl"];
        var baseUri = Uri.TryCreate(
            string.IsNullOrWhiteSpace(configuredBaseUrl) ? "http://127.0.0.1:38474" : configuredBaseUrl,
            UriKind.Absolute,
            out var parsed)
            ? parsed
            : new Uri("http://127.0.0.1:38474", UriKind.Absolute);

        var options = new RefxBridgeClientOptions(baseUri);

        var configuredTimeout = ConfigurationManager.AppSettings["BridgeTimeoutSeconds"];
        if (int.TryParse(configuredTimeout, out var timeoutSeconds) && timeoutSeconds > 0)
        {
            options.Timeout = TimeSpan.FromSeconds(timeoutSeconds);
        }

        return options;
    }

    private static Uri NormalizeBaseUri(Uri value)
    {
        var normalized = value.ToString().TrimEnd('/');
        return new Uri(normalized, UriKind.Absolute);
    }
}
