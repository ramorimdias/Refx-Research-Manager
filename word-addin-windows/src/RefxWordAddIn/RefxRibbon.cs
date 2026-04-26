using System.IO;
using System.Reflection;
using Microsoft.Office.Core;

namespace RefxWordAddIn
{
    public sealed class RefxRibbon : IRibbonExtensibility
    {
        private readonly ThisAddIn _addin;

        public RefxRibbon(ThisAddIn addin)
        {
            _addin = addin;
        }

        public string GetCustomUI(string ribbonId)
        {
            using (var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream("RefxWordAddIn.Ribbon.RefxRibbon.xml"))
            {
                if (stream == null)
                {
                    return string.Empty;
                }

                using (var reader = new StreamReader(stream))
                {
                    return reader.ReadToEnd();
                }
            }
        }

        public void OnOpenRefxPane(IRibbonControl control)
        {
            _addin.ShowRefxTaskPane();
        }
    }
}
