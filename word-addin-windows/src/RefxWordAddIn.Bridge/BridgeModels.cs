using System.Collections.Generic;
using Newtonsoft.Json;

namespace RefxWordAddIn.Bridge;

public sealed class RefxBridgeStatus
{
    [JsonProperty("ok")]
    public bool Ok { get; set; }

    [JsonProperty("app")]
    public string App { get; set; } = string.Empty;

    [JsonProperty("version")]
    public string Version { get; set; } = string.Empty;
}

public sealed class RefxWorkSummary
{
    [JsonProperty("id")]
    public string Id { get; set; } = string.Empty;

    [JsonProperty("title")]
    public string Title { get; set; } = string.Empty;

    [JsonProperty("authors")]
    public List<string> Authors { get; set; } = new List<string>();

    [JsonProperty("year")]
    public int? Year { get; set; }

    [JsonProperty("referenceCount")]
    public int ReferenceCount { get; set; }
}

public sealed class RefxReferenceSummary
{
    [JsonProperty("id")]
    public string Id { get; set; } = string.Empty;

    [JsonProperty("sourceType")]
    public string SourceType { get; set; } = string.Empty;

    [JsonProperty("citationKey")]
    public string? CitationKey { get; set; }

    [JsonProperty("title")]
    public string Title { get; set; } = string.Empty;

    [JsonProperty("authors")]
    public List<string> Authors { get; set; } = new List<string>();

    [JsonProperty("year")]
    public int? Year { get; set; }

    [JsonProperty("journal")]
    public string? Journal { get; set; }

    [JsonProperty("booktitle")]
    public string? Booktitle { get; set; }

    [JsonProperty("publisher")]
    public string? Publisher { get; set; }

    [JsonProperty("volume")]
    public string? Volume { get; set; }

    [JsonProperty("issue")]
    public string? Issue { get; set; }

    [JsonProperty("pages")]
    public string? Pages { get; set; }

    [JsonProperty("doi")]
    public string? Doi { get; set; }

    [JsonProperty("url")]
    public string? Url { get; set; }

    [JsonProperty("bibtex")]
    public string? Bibtex { get; set; }
}
