using System;
using System.Collections.Generic;
using System.Globalization;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Threading;
using System.Threading.Tasks;
using Newtonsoft.Json;

namespace RefxWordAddIn.Bridge;

public sealed class RefxBridgeClient : IRefxBridgeClient, IDisposable
{
    private readonly HttpClient _httpClient;
    private readonly bool _ownsClient;

    public RefxBridgeClient(RefxBridgeClientOptions options)
        : this(CreateClient(options), true)
    {
    }

    public RefxBridgeClient(HttpClient httpClient)
        : this(httpClient, false)
    {
    }

    private RefxBridgeClient(HttpClient httpClient, bool ownsClient)
    {
        _httpClient = httpClient;
        _ownsClient = ownsClient;
    }

    public Uri BaseUri => _httpClient.BaseAddress ?? new Uri("http://127.0.0.1:38474");

    public void Dispose()
    {
        if (_ownsClient)
        {
            _httpClient.Dispose();
        }
    }

    public async Task<RefxBridgeStatus> GetStatusAsync(CancellationToken cancellationToken = default)
    {
        return await SendJsonAsync<RefxBridgeStatus>("/status", cancellationToken).ConfigureAwait(false);
    }

    public async Task<IReadOnlyList<RefxWorkSummary>> GetWorksAsync(string? query = null, CancellationToken cancellationToken = default)
    {
        var path = "/works" + BuildQueryString(query);
        return await SendJsonAsync<List<RefxWorkSummary>>(path, cancellationToken).ConfigureAwait(false);
    }

    public async Task<IReadOnlyList<RefxReferenceSummary>> GetReferencesAsync(string workId, string? query = null, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(workId))
        {
            throw new ArgumentException("Work id is required.", nameof(workId));
        }

        var path = "/works/" + Uri.EscapeDataString(workId) + "/references" + BuildQueryString(query);
        return await SendJsonAsync<List<RefxReferenceSummary>>(path, cancellationToken).ConfigureAwait(false);
    }

    public async Task<RefxReferenceSummary> GetReferenceAsync(string referenceId, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(referenceId))
        {
            throw new ArgumentException("Reference id is required.", nameof(referenceId));
        }

        var path = "/references/" + Uri.EscapeDataString(referenceId);
        return await SendJsonAsync<RefxReferenceSummary>(path, cancellationToken).ConfigureAwait(false);
    }

    private async Task<T> SendJsonAsync<T>(string relativePath, CancellationToken cancellationToken)
    {
        using (var request = new HttpRequestMessage(HttpMethod.Get, relativePath))
        {
            request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
            request.Headers.UserAgent.ParseAdd("RefxWordAddIn.Windows/1.0");

            using (var response = await _httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken).ConfigureAwait(false))
            {
                var responseText = await response.Content.ReadAsStringAsync().ConfigureAwait(false);
                if (!response.IsSuccessStatusCode)
                {
                    var message = string.IsNullOrWhiteSpace(responseText)
                        ? string.Format(CultureInfo.InvariantCulture, "Bridge request to {0} failed with {1}.", relativePath, (int)response.StatusCode)
                        : responseText.Trim();
                    throw new RefxBridgeException(response.StatusCode, message, responseText);
                }

                try
                {
                    var model = JsonConvert.DeserializeObject<T>(responseText);
                    if (model == null)
                    {
                        throw new RefxBridgeException(null, "Bridge response was empty.");
                    }

                    return model;
                }
                catch (JsonException ex)
                {
                    throw new RefxBridgeException("Could not parse bridge JSON response.", ex);
                }
            }
        }
    }

    private static string BuildQueryString(string? query)
    {
        if (string.IsNullOrWhiteSpace(query))
        {
            return string.Empty;
        }

        return "?query=" + Uri.EscapeDataString(query);
    }

    private static HttpClient CreateClient(RefxBridgeClientOptions options)
    {
        if (options == null)
        {
            throw new ArgumentNullException(nameof(options));
        }

        var client = new HttpClient
        {
            BaseAddress = options.BaseUri,
            Timeout = options.Timeout,
        };
        client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        client.DefaultRequestHeaders.UserAgent.ParseAdd(options.UserAgent);
        return client;
    }
}
