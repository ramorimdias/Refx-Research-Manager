using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;

namespace RefxWordAddIn.Bridge;

public static class SimpleCitationFormatter
{
    public static string BuildCitationMarker(RefxReferenceSummary reference)
    {
        if (reference == null)
        {
            throw new ArgumentNullException(nameof(reference));
        }

        var authorToken = GetAuthorToken(reference.Authors, reference.Title);
        var yearToken = reference.Year.HasValue ? reference.Year.Value.ToString(CultureInfo.InvariantCulture) : "n.d.";
        return $"[{authorToken} {yearToken}]";
    }

    public static string BuildReferenceLabel(RefxReferenceSummary reference)
    {
        if (reference == null)
        {
            throw new ArgumentNullException(nameof(reference));
        }

        var parts = new List<string>();
        if (!string.IsNullOrWhiteSpace(reference.CitationKey))
        {
            parts.Add(reference.CitationKey!.Trim());
        }

        if (reference.Authors.Count > 0)
        {
            parts.Add(string.Join(", ", reference.Authors.Take(2)));
        }

        if (reference.Year.HasValue)
        {
            parts.Add(reference.Year.Value.ToString(CultureInfo.InvariantCulture));
        }

        if (parts.Count == 0)
        {
            return reference.Title;
        }

        return string.Join(" · ", parts);
    }

    private static string GetAuthorToken(IReadOnlyList<string> authors, string title)
    {
        if (authors.Count > 0)
        {
            var firstAuthor = authors[0] ?? string.Empty;
            var surname = ExtractSurname(firstAuthor);
            if (!string.IsNullOrWhiteSpace(surname))
            {
                return surname;
            }
        }

        var titleToken = ExtractTitleToken(title);
        return string.IsNullOrWhiteSpace(titleToken) ? "Refx" : titleToken;
    }

    private static string ExtractSurname(string author)
    {
        var trimmed = NormalizeWhitespace(author);
        if (string.IsNullOrWhiteSpace(trimmed))
        {
            return string.Empty;
        }

        if (trimmed.Contains(","))
        {
            return NormalizeWhitespace(trimmed.Split(',')[0]);
        }

        var parts = trimmed.Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
        return parts.Length > 0 ? parts[parts.Length - 1] : string.Empty;
    }

    private static string ExtractTitleToken(string title)
    {
        var normalized = NormalizeWhitespace(title);
        if (string.IsNullOrWhiteSpace(normalized))
        {
            return string.Empty;
        }

        var words = normalized.Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
        return string.Join(" ", words.Take(3));
    }

    private static string NormalizeWhitespace(string value)
    {
        return string.Join(" ", (value ?? string.Empty).Split(new[] { ' ', '\t', '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries));
    }
}
