using System.Windows.Controls;

namespace RefxWordAddIn.TaskPane
{
    public partial class RefxTaskPaneView : UserControl
    {
        public RefxTaskPaneView()
        {
            InitializeComponent();
            Loaded += async (_, __) =>
            {
                if (DataContext is RefxTaskPaneViewModel viewModel)
                {
                    await viewModel.InitializeAsync().ConfigureAwait(true);
                }
            };
        }
    }
}
