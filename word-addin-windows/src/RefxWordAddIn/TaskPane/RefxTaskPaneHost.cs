using System.Windows.Forms;
using System.Windows.Forms.Integration;

namespace RefxWordAddIn.TaskPane
{
    // VSTO task panes use WinForms, so this shell hosts the WPF pane inside ElementHost.
    public sealed class RefxTaskPaneHost : UserControl
    {
        public RefxTaskPaneHost(RefxTaskPaneViewModel viewModel)
        {
            Dock = DockStyle.Fill;

            var elementHost = new ElementHost
            {
                Dock = DockStyle.Fill,
                Child = new RefxTaskPaneView
                {
                    DataContext = viewModel,
                },
            };

            Controls.Add(elementHost);
        }
    }
}
