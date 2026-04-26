using System;
using Microsoft.Office.Core;
using Microsoft.Office.Tools;
using RefxWordAddIn.Bridge;
using RefxWordAddIn.Services;
using RefxWordAddIn.TaskPane;
using Word = Microsoft.Office.Interop.Word;

namespace RefxWordAddIn
{
    // Windows-only VSTO host for desktop Word.
    public partial class ThisAddIn
    {
        private RefxBridgeClient? _bridgeClient;
        private WordCitationInserter? _citationInserter;
        private RefxTaskPaneViewModel? _taskPaneViewModel;
        private RefxTaskPaneHost? _taskPaneHost;
        private CustomTaskPane? _customTaskPane;

        protected override IRibbonExtensibility CreateRibbonExtensibilityObject()
        {
            return new RefxRibbon(this);
        }

        private void ThisAddIn_Startup(object sender, EventArgs e)
        {
            _bridgeClient = new RefxBridgeClient(RefxBridgeClientOptions.FromAppSettings());
            _citationInserter = new WordCitationInserter(Application);
            _taskPaneViewModel = new RefxTaskPaneViewModel(_bridgeClient, _citationInserter);
        }

        private void ThisAddIn_Shutdown(object sender, EventArgs e)
        {
            _customTaskPane?.Dispose();
            _bridgeClient?.Dispose();
        }

        internal void ShowRefxTaskPane()
        {
            if (_taskPaneViewModel == null)
            {
                throw new InvalidOperationException("Refx task pane is not ready yet.");
            }

            if (_customTaskPane == null)
            {
                _taskPaneHost = new RefxTaskPaneHost(_taskPaneViewModel);
                _customTaskPane = CustomTaskPanes.Add(_taskPaneHost, "Refx");
                _customTaskPane.DockPosition = MsoCTPDockPosition.msoCTPDockPositionRight;
                _customTaskPane.Width = 380;
                _customTaskPane.Visible = true;
                return;
            }

            _customTaskPane.Visible = true;
        }
    }
}
