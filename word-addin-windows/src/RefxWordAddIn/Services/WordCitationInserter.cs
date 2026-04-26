using System;
using RefxWordAddIn.Bridge;
using Word = Microsoft.Office.Interop.Word;

namespace RefxWordAddIn.Services
{
    // Inserts a simple citation marker into the active Word document.
    public interface IWordCitationInserter
    {
        void InsertCitation(RefxReferenceSummary reference);
    }

    public sealed class WordCitationInserter : IWordCitationInserter
    {
        private readonly Word.Application _application;

        public WordCitationInserter(Word.Application application)
        {
            _application = application ?? throw new ArgumentNullException(nameof(application));
        }

        public void InsertCitation(RefxReferenceSummary reference)
        {
            if (reference == null)
            {
                throw new ArgumentNullException(nameof(reference));
            }

            var citationText = SimpleCitationFormatter.BuildCitationMarker(reference);
            _application.Selection.TypeText(citationText);
        }
    }
}
