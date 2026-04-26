using System;
using System.Collections.ObjectModel;
using System.Linq;
using System.Threading.Tasks;
using System.Windows.Media;
using RefxWordAddIn.Bridge;
using RefxWordAddIn.Services;

namespace RefxWordAddIn.TaskPane
{
    public sealed class RefxTaskPaneViewModel : NotifyPropertyChangedBase
    {
        private readonly IRefxBridgeClient _bridgeClient;
        private readonly IWordCitationInserter _citationInserter;
        private bool _isInitialized;
        private bool _isBusy;
        private bool _isConnected;
        private string _statusMessage = "Connecting to the local Refx bridge...";
        private string _errorMessage = string.Empty;
        private RefxWorkSummary? _selectedWork;
        private RefxReferenceSummary? _selectedReference;

        public RefxTaskPaneViewModel(IRefxBridgeClient bridgeClient, IWordCitationInserter citationInserter)
        {
            _bridgeClient = bridgeClient ?? throw new ArgumentNullException(nameof(bridgeClient));
            _citationInserter = citationInserter ?? throw new ArgumentNullException(nameof(citationInserter));

            Works = new ObservableCollection<RefxWorkSummary>();
            References = new ObservableCollection<RefxReferenceSummary>();

            RefreshCommand = new AsyncRelayCommand(RefreshAsync, () => !IsBusy);
            InsertCitationCommand = new AsyncRelayCommand(InsertCitationAsync, () => !IsBusy && SelectedReference != null && IsConnected);
        }

        public ObservableCollection<RefxWorkSummary> Works { get; }

        public ObservableCollection<RefxReferenceSummary> References { get; }

        public AsyncRelayCommand RefreshCommand { get; }

        public AsyncRelayCommand InsertCitationCommand { get; }

        public bool IsBusy
        {
            get => _isBusy;
            private set
            {
                if (SetProperty(ref _isBusy, value))
                {
                    RefreshCommand.RaiseCanExecuteChanged();
                    InsertCitationCommand.RaiseCanExecuteChanged();
                }
            }
        }

        public bool IsConnected
        {
            get => _isConnected;
            private set
            {
                if (SetProperty(ref _isConnected, value))
                {
                    InsertCitationCommand.RaiseCanExecuteChanged();
                    OnPropertyChanged(nameof(ConnectionBrush));
                }
            }
        }

        public string StatusMessage
        {
            get => _statusMessage;
            private set => SetProperty(ref _statusMessage, value);
        }

        public string ErrorMessage
        {
            get => _errorMessage;
            private set => SetProperty(ref _errorMessage, value);
        }

        public RefxWorkSummary? SelectedWork
        {
            get => _selectedWork;
            set
            {
                if (!SetProperty(ref _selectedWork, value))
                {
                    return;
                }

                if (!IsBusy)
                {
                    _ = LoadReferencesForSelectedWorkAsync();
                }
            }
        }

        public RefxReferenceSummary? SelectedReference
        {
            get => _selectedReference;
            set
            {
                if (SetProperty(ref _selectedReference, value))
                {
                    InsertCitationCommand.RaiseCanExecuteChanged();
                }
            }
        }

        public Brush ConnectionBrush => IsConnected ? Brushes.SeaGreen : Brushes.IndianRed;

        public async Task InitializeAsync()
        {
            if (_isInitialized)
            {
                return;
            }

            _isInitialized = true;
            await RefreshAsync().ConfigureAwait(true);
        }

        public async Task RefreshAsync()
        {
            await RunBusyOperationAsync(async () =>
            {
                StatusMessage = "Checking the local Refx bridge...";
                ErrorMessage = string.Empty;

                var status = await _bridgeClient.GetStatusAsync().ConfigureAwait(true);
                IsConnected = status.Ok;
                StatusMessage = string.Format("Connected to {0} {1}", status.App, status.Version);

                var works = await _bridgeClient.GetWorksAsync().ConfigureAwait(true);
                ReplaceWorks(works);
            }, "Refreshing works...").ConfigureAwait(true);

            if (IsConnected && SelectedWork != null)
            {
                await LoadReferencesForSelectedWorkAsync().ConfigureAwait(true);
            }
        }

        private async Task LoadReferencesForSelectedWorkAsync()
        {
            if (SelectedWork == null)
            {
                References.Clear();
                SelectedReference = null;
                return;
            }

            await RunBusyOperationAsync(async () =>
            {
                var selectedWorkTitle = SelectedWork.Title;
                StatusMessage = string.Format("Loading references for {0}...", selectedWorkTitle);
                ErrorMessage = string.Empty;

                var references = await _bridgeClient.GetReferencesAsync(SelectedWork.Id).ConfigureAwait(true);
                ReplaceReferences(references);
                StatusMessage = string.Format("Connected to the local Refx bridge. Loaded {0} references for {1}.", References.Count, selectedWorkTitle);
            }, "Loading references...").ConfigureAwait(true);
        }

        private async Task InsertCitationAsync()
        {
            if (SelectedReference == null)
            {
                return;
            }

            await RunBusyOperationAsync(() =>
            {
                _citationInserter.InsertCitation(SelectedReference);
                StatusMessage = string.Format("Inserted citation for {0}.", SelectedReference.Title);
                ErrorMessage = string.Empty;
                return Task.CompletedTask;
            }, "Inserting citation...").ConfigureAwait(true);
        }

        private async Task RunBusyOperationAsync(Func<Task> operation, string busyMessage)
        {
            if (IsBusy)
            {
                return;
            }

            IsBusy = true;
            StatusMessage = busyMessage;

            try
            {
                await operation().ConfigureAwait(true);
            }
            catch (RefxBridgeException ex)
            {
                IsConnected = false;
                ErrorMessage = ex.Message;
                StatusMessage = "Disconnected from the local Refx bridge.";
                Works.Clear();
                References.Clear();
                SelectedWork = null;
                SelectedReference = null;
            }
            catch (Exception ex)
            {
                ErrorMessage = ex.Message;
                StatusMessage = "An unexpected error occurred while talking to Refx.";
            }
            finally
            {
                IsBusy = false;
            }
        }

        private void ReplaceWorks(System.Collections.Generic.IEnumerable<RefxWorkSummary> works)
        {
            var previousSelectedWorkId = SelectedWork?.Id;
            Works.Clear();
            foreach (var work in works)
            {
                Works.Add(work);
            }

            if (Works.Count == 0)
            {
                SelectedWork = null;
                References.Clear();
                SelectedReference = null;
                return;
            }

            if (!string.IsNullOrWhiteSpace(previousSelectedWorkId))
            {
                var matchingWork = Works.FirstOrDefault(work => string.Equals(work.Id, previousSelectedWorkId, StringComparison.OrdinalIgnoreCase));
                if (matchingWork != null)
                {
                    SelectedWork = matchingWork;
                    return;
                }
            }

            SelectedWork = Works[0];
        }

        private void ReplaceReferences(System.Collections.Generic.IEnumerable<RefxReferenceSummary> references)
        {
            References.Clear();
            foreach (var reference in references)
            {
                References.Add(reference);
            }

            SelectedReference = References.Count > 0 ? References[0] : null;
        }
    }
}
