import { getReference, listWorkReferences, type RefxReference } from '../api/refxClient'
import { getCitationControlsInOrder, parseCitationGroupTitle, renderCitationLabel, renderSingleCitationLabel, updateCitationControlLabels, upsertBibliographyControl } from './citationControls'
import { loadCitationState, saveCitationState } from './customXmlStore'
import { renderBibliography } from './renderBibliography'
import type { CitationGroup, RefxCitationState } from './types'
import { debugLog, logOperation } from '../utils/logger'

function findGroupForControl(state: RefxCitationState, control: { id: string; title: string }) {
  return state.citationGroups.find((group) => group.contentControlId === control.id)
    ?? state.citationGroups.find((group) => group.id === control.title)
    ?? parseCitationGroupTitle(control.title)
    ?? null
}

async function ensureSource(state: RefxCitationState, sourceId: string) {
  if (state.sources[sourceId]) return state.sources[sourceId]
  const source = await getReference(sourceId)
  state.sources[sourceId] = source
  return source
}

async function buildBibliographyEntries(state: RefxCitationState, sourceOrder: string[], numbersBySourceId: Map<string, number>) {
  let orderedSourceIds = sourceOrder

  if (state.settings.bibliographyOrder === 'refxWorkOrder' && state.settings.workDocumentId) {
    try {
      const workReferences = await listWorkReferences(state.settings.workDocumentId)
      const citedIds = new Set(sourceOrder)
      orderedSourceIds = [
        ...workReferences.map((reference) => reference.id).filter((id) => citedIds.has(id)),
        ...sourceOrder.filter((id) => !workReferences.some((reference) => reference.id === id)),
      ]
    } catch {
      orderedSourceIds = sourceOrder
    }
  }

  return orderedSourceIds
    .map((sourceId) => {
      const source = state.sources[sourceId]
      const number = numbersBySourceId.get(sourceId)
      return source && number ? { number, source } : null
    })
    .filter((entry): entry is { number: number; source: RefxReference } => Boolean(entry))
}

export async function refreshCitations({
  rebuildBibliography = true,
  settingsPatch,
  pendingGroups = [],
  saveState = true,
}: {
  rebuildBibliography?: boolean
  settingsPatch?: Partial<RefxCitationState['settings']>
  pendingGroups?: Array<{ group: CitationGroup; sources: RefxReference[] }>
  saveState?: boolean
} = {}) {
  return logOperation(rebuildBibliography ? 'refresh citations and bibliography' : 'refresh citations', async () => {
    const state = await loadCitationState()
    if (settingsPatch) {
      state.settings = { ...state.settings, ...settingsPatch }
    }
    for (const pending of pendingGroups) {
      for (const source of pending.sources) {
        state.sources[source.id] = source
      }
      state.citationGroups = [
        ...state.citationGroups.filter((existing) => existing.id !== pending.group.id),
        pending.group,
      ]
    }
    const controls = await getCitationControlsInOrder()
    const liveControlIds = new Set(controls.map((control: { id: string }) => control.id))
    const labelsByControlId = new Map<string, string>()
    const numbersBySourceId = new Map<string, number>()
    const sourceOrder: string[] = []
    const liveGroups: CitationGroup[] = []

    for (const control of controls) {
      const group = findGroupForControl(state, control)
      if (!group) continue

      const groupNumbers: number[] = []
      group.contentControlId = control.id
      liveGroups.push(group)

      for (const sourceId of group.sourceIds) {
        await ensureSource(state, sourceId)
        if (!numbersBySourceId.has(sourceId)) {
          numbersBySourceId.set(sourceId, numbersBySourceId.size + 1)
          sourceOrder.push(sourceId)
        }
        groupNumbers.push(numbersBySourceId.get(sourceId)!)
      }

      if (groupNumbers.length === 1) {
        const label = renderSingleCitationLabel(
          groupNumbers[0],
          state.sources[group.sourceIds[0]],
          {
            textCitationStyle: state.settings.textCitationStyle,
            citationContainer: state.settings.citationContainer,
          },
        )
        labelsByControlId.set(control.id, label)
      } else {
        const label = renderCitationLabel(groupNumbers, state.settings.citationContainer)
        labelsByControlId.set(control.id, label)
      }
    }

    state.citationGroups = liveGroups.filter((group) => (
      !group.contentControlId || liveControlIds.has(group.contentControlId)
    ))

    debugLog('refresh citation plan', {
      controls: controls.length,
      liveGroups: liveGroups.length,
      uniqueSources: sourceOrder.length,
      rebuildBibliography,
      pendingGroups: pendingGroups.length,
    })

    await updateCitationControlLabels(labelsByControlId)

    if (rebuildBibliography) {
      const bibliographyEntries = await buildBibliographyEntries(state, sourceOrder, numbersBySourceId)
      const bibliographyText = renderBibliography(bibliographyEntries)
      await upsertBibliographyControl(bibliographyText)
    }

    if (saveState) {
      await saveCitationState(state)
    }
    return {
      citationCount: liveGroups.length,
      sourceCount: sourceOrder.length,
    }
  })
}

export async function rebuildBibliographyOnly() {
  await refreshCitations({ rebuildBibliography: true })
}

export async function repairCitationState(settingsPatch?: Partial<RefxCitationState['settings']>) {
  return logOperation('repair citation state', () => refreshCitations({
    rebuildBibliography: true,
    settingsPatch,
    pendingGroups: [],
    saveState: true,
  }))
}
