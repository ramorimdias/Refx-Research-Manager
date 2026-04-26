namespace RefxWordAddIn
{
    public partial class ThisAddIn : Microsoft.Office.Tools.AddInBase
    {
        private void InternalStartup()
        {
            Startup += ThisAddIn_Startup;
            Shutdown += ThisAddIn_Shutdown;
        }
    }
}
