using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace RefxWordAddIn.Bridge;

public interface IRefxBridgeClient
{
    Task<RefxBridgeStatus> GetStatusAsync(CancellationToken cancellationToken = default);

    Task<IReadOnlyList<RefxWorkSummary>> GetWorksAsync(string? query = null, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<RefxReferenceSummary>> GetReferencesAsync(string workId, string? query = null, CancellationToken cancellationToken = default);

    Task<RefxReferenceSummary> GetReferenceAsync(string referenceId, CancellationToken cancellationToken = default);
}
