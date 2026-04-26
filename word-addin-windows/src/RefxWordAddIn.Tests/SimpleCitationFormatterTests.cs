using Microsoft.VisualStudio.TestTools.UnitTesting;
using RefxWordAddIn.Bridge;
using System.Collections.Generic;

namespace RefxWordAddIn.Tests;

[TestClass]
public sealed class SimpleCitationFormatterTests
{
    [TestMethod]
    public void BuildCitationMarker_UsesSurnameAndYear()
    {
        var reference = new RefxReferenceSummary
        {
            Title = "A much longer article title",
            Year = 2024,
            Authors = new List<string> { "Smith, Jane", "Lee, Min" },
        };

        var citation = SimpleCitationFormatter.BuildCitationMarker(reference);

        Assert.AreEqual("[Smith 2024]", citation);
    }

    [TestMethod]
    public void BuildCitationMarker_FallsBackToTitleWhenNoAuthorsExist()
    {
        var reference = new RefxReferenceSummary
        {
            Title = "An example article title",
            Year = 2023,
        };

        var citation = SimpleCitationFormatter.BuildCitationMarker(reference);

        Assert.AreEqual("[An example article 2023]", citation);
    }

    [TestMethod]
    public void BuildReferenceLabel_PrioritizesCitationKeyThenAuthorsAndYear()
    {
        var reference = new RefxReferenceSummary
        {
            CitationKey = "smith2024",
            Title = "Example",
            Year = 2024,
            Authors = new List<string> { "Smith, Jane" },
        };

        var label = SimpleCitationFormatter.BuildReferenceLabel(reference);

        Assert.AreEqual("smith2024 · Smith, Jane · 2024", label);
    }
}
