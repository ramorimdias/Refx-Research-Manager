'use client'

import Link from 'next/link'
import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Background,
  BackgroundVariant,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  Handle,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  Position,
  getStraightPath,
  type Connection,
  type EdgeProps,
  type Node,
  type NodeProps,
  type OnConnect,
  type OnConnectEnd,
  type OnConnectStart,
  type OnEdgesChange,
  type OnNodesChange,
  type NodeMouseHandler,
  type NodeDragHandler,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from 'reactflow'
import 'reactflow/dist/style.css'
import {
  Check,
  ArrowRight,
  GitBranch,
  Pin,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  WandSparkles,
  ChevronsUpDown,
} from 'lucide-react'
import { DocumentGraphControls } from '@/components/refx/document-graph-controls'
import { DocumentGraphPanel } from '@/components/refx/document-graph-panel'
import { EmptyState } from '@/components/refx/common'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import { useAppStore } from '@/lib/store'
import {
  buildNodeAppearance,
  deriveGraphView,
  runReheatLayout,
  type GraphColorMode,
  type GraphNeighborhoodDepth,
  type GraphRelationFilter,
  type GraphScopeMode,
  type GraphSizeMode,
} from '@/lib/services/document-graph-view-service'
import {
  buildDocumentGraphEdges,
  buildDocumentGraphNodes,
  type DocumentGraphNodeData,
} from '@/lib/services/document-relation-service'
import type { DocumentRelationLinkType, GraphView } from '@/lib/types'
import { cn } from '@/lib/utils'

type ConnectionDirection = 'outbound' | 'inbound'

type GraphPreferences = {
  colorMode: GraphColorMode
  confidenceThreshold: number
  focusMode: boolean
  hideOrphans: boolean
  neighborhoodDepth: GraphNeighborhoodDepth
  relationFilter: GraphRelationFilter
  scopeMode: GraphScopeMode
  sizeMode: GraphSizeMode
  yearMax?: number
  yearMin?: number
}

type GraphNodeExtraState = {
  pendingConnectionDirection: ConnectionDirection | null
  onStartConnection: (documentId: string, direction: ConnectionDirection) => void
}

type GraphNodeData = DocumentGraphNodeData & GraphNodeExtraState

type GraphViewDraft = {
  name: string
  description: string
}

type GraphContextMenuState =
  | {
      kind: 'node'
      documentId: string
      x: number
      y: number
    }
  | {
      kind: 'edge'
      relationId: string
      x: number
      y: number
    }
  | null

const GRAPH_PREFERENCES_STORAGE_KEY = 'refx.maps.phase4.preferences'
const WORKING_MAP_LAYOUT_STORAGE_KEY = 'refx.maps.working-layouts'
const DEFAULT_GRAPH_PREFERENCES: GraphPreferences = {
  colorMode: 'density',
  confidenceThreshold: 0,
  focusMode: false,
  hideOrphans: true,
  neighborhoodDepth: 'full',
  relationFilter: 'all',
  scopeMode: 'mapped',
  sizeMode: 'total_degree',
}

const DEFAULT_GRAPH_VIEW_DRAFT: GraphViewDraft = {
  name: '',
  description: '',
}

type WorkingMapLayouts = Record<string, Record<string, { x: number; y: number }>>

function resolveEdgeDirections(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
) {
  const deltaX = targetX - sourceX
  const deltaY = targetY - sourceY

  if (Math.abs(deltaX) >= Math.abs(deltaY)) {
    return {
      sourcePosition: deltaX >= 0 ? Position.Right : Position.Left,
      targetPosition: deltaX >= 0 ? Position.Left : Position.Right,
    }
  }

  return {
    sourcePosition: deltaY >= 0 ? Position.Bottom : Position.Top,
    targetPosition: deltaY >= 0 ? Position.Top : Position.Bottom,
  }
}

function RelationshipEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style,
  markerStart,
  markerEnd,
  label,
  selected,
  data,
}: EdgeProps) {
  const { sourcePosition, targetPosition } = resolveEdgeDirections(
    sourceX,
    sourceY,
    targetX,
    targetY,
  )
  const [edgePath, labelX, labelY] = getStraightPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  })
  const edgeData = (data ?? {}) as {
    confidence?: number
    isHovered?: boolean
    isConnectedToSelectedDocument?: boolean
    relationStatus?: string
  }
  const confidence = typeof edgeData.confidence === 'number'
    ? Math.round(edgeData.confidence * 100)
    : null
  const arrowAngle = Math.atan2(targetY - sourceY, targetX - sourceX) * (180 / Math.PI)

  return (
    <>
      <BaseEdge id={id} path={edgePath} markerStart={markerStart} markerEnd={markerEnd} style={style} />
      <EdgeLabelRenderer>
        <div
          className={cn(
            'pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border shadow-sm',
            selected
              ? 'border-amber-300 bg-white text-amber-600'
              : edgeData.isHovered || edgeData.isConnectedToSelectedDocument
                ? 'border-slate-300 bg-white text-slate-700'
                : 'border-slate-200/80 bg-white/92 text-slate-500',
          )}
          style={{
            left: labelX,
            top: labelY,
            transform: `translate(-50%, -50%) rotate(${arrowAngle}deg)`,
          }}
        >
          <ArrowRight className="h-3.5 w-3.5" />
        </div>
      </EdgeLabelRenderer>
      {(label && (selected || edgeData.isHovered)) ? (
        <EdgeLabelRenderer>
          <div
            className={cn(
              'pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-2xl border px-3 py-2 text-[11px] shadow-md',
              selected
                ? 'border-teal-200 bg-white text-slate-900'
                : 'border-slate-200 bg-white/96 text-slate-700',
            )}
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
          >
            <p className="font-semibold">{String(label)}</p>
            {confidence !== null ? (
              <p className="mt-1 text-[10px] text-slate-500">
                Confidence {confidence}%{edgeData.relationStatus ? ` • ${edgeData.relationStatus.replace(/_/g, ' ')}` : ''}
              </p>
            ) : null}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  )
}

function DocumentGraphNode({ data, selected }: NodeProps<GraphNodeData>) {
  const {
    document,
    fillColor,
    borderColor,
    inboundCitationCount = 0,
    isCurrentDocument,
    isFocused,
    isHovered,
    isSearchMatch,
    isSelected,
    onStartConnection,
    outboundCitationCount = 0,
    pendingConnectionDirection,
    relationCount,
  } = data
  const authorText = document.authors.length > 0
    ? document.authors.slice(0, 2).join(', ')
    : 'Unknown author'

  return (
    <div
      data-document-node-id={document.id}
      className={cn(
        'relative z-10 flex h-full w-full items-center justify-center overflow-visible rounded-full text-center shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur transition-all',
        pendingConnectionDirection && 'ring-4 ring-teal-100',
        isSelected && 'ring-4 ring-amber-300 shadow-[0_0_0_8px_rgba(251,191,36,0.22),0_16px_40px_rgba(15,23,42,0.12)]',
        isFocused && !isSelected && 'ring-4 ring-violet-100',
        isHovered && !isSelected && 'ring-2 ring-sky-100',
        isSearchMatch && 'shadow-[0_0_0_4px_rgba(245,158,11,0.18),0_16px_40px_rgba(15,23,42,0.08)]',
      )}
      style={{
        background: fillColor
          ? `radial-gradient(circle at 30% 20%, rgba(255,255,255,0.98), ${fillColor})`
          : undefined,
        border: `2px solid ${borderColor ?? '#cbd5e1'}`,
      }}
    >
      <div className="space-y-2 px-5">
        <p className="line-clamp-3 text-sm font-semibold leading-5 text-slate-900">
          {document.title}
        </p>
        <p className="line-clamp-2 text-xs leading-5 text-slate-600">{authorText}</p>
        <div className="flex items-center justify-center gap-2 text-[10px] uppercase tracking-[0.18em] text-slate-500">
          {document.year ? <span>{document.year}</span> : null}
        </div>
        <p className="text-[10px] text-slate-500">
          {inboundCitationCount} in • {outboundCitationCount} out • {relationCount} total
        </p>
      </div>

      <Handle
        id="center-target"
        type="target"
        position={Position.Left}
        isConnectableStart={false}
        isConnectableEnd={false}
        className="!pointer-events-none !z-0 !h-1 !w-1 !border-0 !bg-transparent !opacity-0"
        style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
      />
      <Handle
        id="drop-target"
        type="target"
        position={Position.Right}
        isConnectableStart={false}
        isConnectableEnd
        className="!absolute !z-0 !h-full !w-full !rounded-full !border-0 !bg-transparent !opacity-0"
        style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
      />
      <Handle
        id="center-source"
        type="source"
        position={Position.Right}
        isConnectableStart={false}
        isConnectableEnd={false}
        className="!pointer-events-none !z-0 !h-1 !w-1 !border-0 !bg-transparent !opacity-0"
        style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
      />

      {isSelected ? (
        <>
          <Handle
            id="inbound"
            type="source"
            position={Position.Left}
            aria-label={`Create an inbound relation for ${document.title}`}
            title="Inbound relation"
            onClick={(event) => {
              event.stopPropagation()
              onStartConnection(document.id, 'inbound')
            }}
            className={cn(
              'nodrag nopan !absolute !top-1/2 !left-[-18px] !z-30 !flex !h-10 !w-10 !-translate-y-1/2 !items-center !justify-center !rounded-full !border-2 !border-white !text-white !shadow-[0_8px_24px_rgba(15,23,42,0.18)] !transition',
              pendingConnectionDirection === 'inbound'
                ? '!bg-teal-700 ring-4 ring-teal-100'
                : '!bg-slate-600 hover:!bg-slate-700',
            )}
            style={{ transform: 'translateY(-50%)' }}
          >
            <ArrowRight className="h-4 w-4" />
          </Handle>
          <Handle
            id="outbound"
            type="source"
            position={Position.Right}
            aria-label={`Create an outbound relation for ${document.title}`}
            title="Outbound relation"
            onClick={(event) => {
              event.stopPropagation()
              onStartConnection(document.id, 'outbound')
            }}
            className={cn(
              'nodrag nopan !absolute !top-1/2 !right-[-18px] !z-30 !flex !h-10 !w-10 !-translate-y-1/2 !items-center !justify-center !rounded-full !border-2 !border-white !text-white !shadow-[0_8px_24px_rgba(15,23,42,0.18)] !transition',
              pendingConnectionDirection === 'outbound'
                ? '!bg-teal-700 ring-4 ring-teal-100'
                : '!bg-teal-600 hover:!bg-teal-700',
            )}
            style={{ transform: 'translateY(-50%)' }}
          >
            <ArrowRight className="h-4 w-4" />
          </Handle>
        </>
      ) : null}

      {pendingConnectionDirection ? (
        <div className="pointer-events-none absolute inset-0 z-10 rounded-full border-2 border-dashed border-teal-400/80" />
      ) : null}
    </div>
  )
}

const nodeTypes = {
  document: DocumentGraphNode,
}

const edgeTypes = {
  relationship: RelationshipEdge,
}

function preserveNodePositions(
  nextNodes: Node<GraphNodeData>[],
  currentNodes: Node<GraphNodeData>[],
  lockedPositions?: Map<string, { x: number; y: number }>,
) {
  const positions = new Map(currentNodes.map((node) => [node.id, node.position]))

  return nextNodes.map((node) => ({
    ...node,
    position: lockedPositions?.get(node.id) ?? positions.get(node.id) ?? node.position,
  }))
}

function readStoredGraphPreferences() {
  if (typeof window === 'undefined') return DEFAULT_GRAPH_PREFERENCES

  try {
    const raw = window.localStorage.getItem(GRAPH_PREFERENCES_STORAGE_KEY)
    if (!raw) return DEFAULT_GRAPH_PREFERENCES
    return {
      ...DEFAULT_GRAPH_PREFERENCES,
      ...(JSON.parse(raw) as Partial<GraphPreferences>),
    }
  } catch {
    return DEFAULT_GRAPH_PREFERENCES
  }
}

function readWorkingMapLayouts() {
  if (typeof window === 'undefined') return {} as WorkingMapLayouts

  try {
    const raw = window.localStorage.getItem(WORKING_MAP_LAYOUT_STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as WorkingMapLayouts
  } catch {
    return {}
  }
}

function writeWorkingMapLayouts(value: WorkingMapLayouts) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(WORKING_MAP_LAYOUT_STORAGE_KEY, JSON.stringify(value))
}

function MapsPageContent() {
  const params = useSearchParams()
  const focusDocumentId = params.get('focus')
  const reactFlow = useReactFlow<GraphNodeData>()
  const {
    activeDocumentId,
    activeLibraryId,
    createGraphView,
    createRelation,
    deleteRelation,
    deleteGraphView,
    duplicateGraphView,
    documents,
    graphViewLayouts,
    graphViews,
    libraries,
    loadGraphViewLayouts,
    loadGraphViews,
    notes,
    rebuildAutoCitationRelations,
    rebuildAutoCitationRelationsForDocument,
    relations,
    resetGraphViewNodeLayouts,
    setActiveDocument,
    updateGraphView,
    updateRelation,
    upsertGraphViewNodeLayout,
  } = useAppStore()

  const [graphPreferences, setGraphPreferences] = useState<GraphPreferences>(DEFAULT_GRAPH_PREFERENCES)
  const [nodes, setNodes, onNodesChange] = useNodesState<GraphNodeData>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [hoveredDocumentId, setHoveredDocumentId] = useState<string | null>(null)
  const [hoveredRelationId, setHoveredRelationId] = useState<string | null>(null)
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(focusDocumentId)
  const [selectedRelationId, setSelectedRelationId] = useState<string | null>(null)
  const [manualVisibleDocumentIds, setManualVisibleDocumentIds] = useState<string[]>([])
  const [hiddenDocumentIds, setHiddenDocumentIds] = useState<string[]>([])
  const [activeGraphViewId, setActiveGraphViewId] = useState<string | null>(null)
  const [pendingConnectionDocumentId, setPendingConnectionDocumentId] = useState<string | null>(null)
  const [pendingConnectionDirection, setPendingConnectionDirection] = useState<ConnectionDirection | null>(null)
  const [newManualLinkType, setNewManualLinkType] = useState<DocumentRelationLinkType>('manual')
  const [searchQuery, setSearchQuery] = useState('')
  const [isAddDocumentPopoverOpen, setIsAddDocumentPopoverOpen] = useState(false)
  const deferredSearchQuery = useDeferredValue(searchQuery)
  const [isDeletingRelation, setIsDeletingRelation] = useState(false)
  const [contextMenu, setContextMenu] = useState<GraphContextMenuState>(null)
  const [isRebuildingAutoLinks, setIsRebuildingAutoLinks] = useState(false)
  const [isRebuildingDocumentCitations, setIsRebuildingDocumentCitations] = useState(false)
  const [isReheatingLayout, setIsReheatingLayout] = useState(false)
  const [isSaveViewDialogOpen, setIsSaveViewDialogOpen] = useState(false)
  const [isEditingViewDialogOpen, setIsEditingViewDialogOpen] = useState(false)
  const [graphViewDraft, setGraphViewDraft] = useState<GraphViewDraft>(DEFAULT_GRAPH_VIEW_DRAFT)
  const [workingLayoutPositions, setWorkingLayoutPositions] = useState<Record<string, { x: number; y: number }>>({})
  const dragConnectionSourceIdRef = useRef<string | null>(null)
  const dragConnectionHandleIdRef = useRef<string | null>(null)
  const dragConnectionCompletedRef = useRef(false)

  useEffect(() => {
    setGraphPreferences(readStoredGraphPreferences())
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(GRAPH_PREFERENCES_STORAGE_KEY, JSON.stringify(graphPreferences))
  }, [graphPreferences])

  useEffect(() => {
    if (!activeLibraryId || activeGraphViewId) {
      if (activeGraphViewId) {
        setWorkingLayoutPositions({})
      }
      return
    }

    const storedLayouts = readWorkingMapLayouts()
    setWorkingLayoutPositions(storedLayouts[activeLibraryId] ?? {})
  }, [activeGraphViewId, activeLibraryId])

  useEffect(() => {
    if (!activeLibraryId) return
    void loadGraphViews(activeLibraryId)
  }, [activeLibraryId, loadGraphViews])

  useEffect(() => {
    if (!activeGraphViewId) {
      void loadGraphViewLayouts(null)
      return
    }
    void loadGraphViewLayouts(activeGraphViewId)
  }, [activeGraphViewId, loadGraphViewLayouts])

  const activeLibrary = useMemo(
    () => libraries.find((library) => library.id === activeLibraryId) ?? libraries[0] ?? null,
    [activeLibraryId, libraries],
  )

  const activeLibraryGraphViews = useMemo(
    () => graphViews.filter((view) => view.libraryId === activeLibrary?.id),
    [activeLibrary?.id, graphViews],
  )

  const activeGraphView = useMemo(
    () => activeLibraryGraphViews.find((view) => view.id === activeGraphViewId) ?? null,
    [activeGraphViewId, activeLibraryGraphViews],
  )

  useEffect(() => {
    if (!activeGraphView) {
      setHiddenDocumentIds([])
      return
    }

    setGraphPreferences({
      colorMode: activeGraphView.colorMode,
      confidenceThreshold: activeGraphView.confidenceThreshold,
      focusMode: activeGraphView.focusMode,
      hideOrphans: activeGraphView.hideOrphans,
      neighborhoodDepth: activeGraphView.neighborhoodDepth,
      relationFilter: activeGraphView.relationFilter,
      scopeMode: activeGraphView.scopeMode,
      sizeMode: activeGraphView.sizeMode,
      yearMin: activeGraphView.yearMin,
      yearMax: activeGraphView.yearMax,
    })
    setManualVisibleDocumentIds(activeGraphView.documentIds)
    setHiddenDocumentIds(
      graphViewLayouts
        .filter((layout) => layout.graphViewId === activeGraphView.id && layout.hidden)
        .map((layout) => layout.documentId),
    )
    setSelectedDocumentId(activeGraphView.selectedDocumentId ?? null)
  }, [activeGraphView, graphViewLayouts])

  const libraryDocuments = useMemo(() => {
    if (!activeLibrary) return []
    return documents.filter((document) => document.libraryId === activeLibrary.id)
  }, [activeLibrary, documents])

  const libraryDocumentIds = useMemo(
    () => new Set(libraryDocuments.map((document) => document.id)),
    [libraryDocuments],
  )

  const libraryRelations = useMemo(
    () =>
      relations.filter(
        (relation) =>
          libraryDocumentIds.has(relation.sourceDocumentId)
          && libraryDocumentIds.has(relation.targetDocumentId),
      ),
    [libraryDocumentIds, relations],
  )

  const derivedGraphView = useMemo(
    () =>
      deriveGraphView({
        documents: libraryDocuments,
        relations: libraryRelations,
        relationFilter: graphPreferences.relationFilter,
        confidenceThreshold: graphPreferences.confidenceThreshold,
        selectedDocumentId,
        neighborhoodDepth: graphPreferences.neighborhoodDepth,
        focusMode: graphPreferences.focusMode,
        scopeMode: graphPreferences.scopeMode,
        manualVisibleDocumentIds,
        hiddenDocumentIds,
        yearMin: graphPreferences.yearMin,
        yearMax: graphPreferences.yearMax,
        hideOrphans: graphPreferences.hideOrphans,
        searchQuery: deferredSearchQuery,
      }),
    [deferredSearchQuery, graphPreferences, hiddenDocumentIds, libraryDocuments, libraryRelations, manualVisibleDocumentIds, selectedDocumentId],
  )

  const visibleDocuments = derivedGraphView.documents
  const visibleRelations = derivedGraphView.relations
  const visibleMetrics = derivedGraphView.metrics
  const searchMatches = derivedGraphView.searchMatches

  const addableDocuments = useMemo(
    () => libraryDocuments.filter((document) => !visibleDocuments.some((entry) => entry.id === document.id)),
    [libraryDocuments, visibleDocuments],
  )

  const selectedDocument = useMemo(
    () => libraryDocuments.find((document) => document.id === selectedDocumentId) ?? null,
    [libraryDocuments, selectedDocumentId],
  )

  const selectedRelation = useMemo(
    () => libraryRelations.find((relation) => relation.id === selectedRelationId) ?? null,
    [libraryRelations, selectedRelationId],
  )

  const graphViewLayoutMap = useMemo(
    () =>
      new Map(
        graphViewLayouts
          .filter((layout) => !activeGraphViewId || layout.graphViewId === activeGraphViewId)
          .map((layout) => [layout.documentId, layout]),
      ),
    [activeGraphViewId, graphViewLayouts],
  )

  const effectiveLayoutMap = useMemo(() => {
    if (activeGraphViewId) return graphViewLayoutMap

    return new Map(
      Object.entries(workingLayoutPositions).map(([documentId, position]) => [
        documentId,
        {
          documentId,
          graphViewId: '__working__',
          hidden: false,
          pinned: false,
          updatedAt: new Date(),
          x: position.x,
          y: position.y,
        },
      ]),
    )
  }, [activeGraphViewId, graphViewLayoutMap, workingLayoutPositions])

  const sourceDocument = useMemo(
    () =>
      selectedRelation
        ? libraryDocuments.find((document) => document.id === selectedRelation.sourceDocumentId) ?? null
        : null,
    [libraryDocuments, selectedRelation],
  )

  const targetDocument = useMemo(
    () =>
      selectedRelation
        ? libraryDocuments.find((document) => document.id === selectedRelation.targetDocumentId) ?? null
        : null,
    [libraryDocuments, selectedRelation],
  )

  const yearOptions = useMemo(
    () =>
      Array.from(
        new Set(libraryDocuments.map((document) => document.year).filter((year): year is number => typeof year === 'number')),
      ).sort((left, right) => left - right),
    [libraryDocuments],
  )

  const searchResults = useMemo(
    () =>
      libraryDocuments.filter((document) =>
        deferredSearchQuery.trim().length > 0
        && document.title.toLowerCase().includes(deferredSearchQuery.trim().toLowerCase()),
      ),
    [deferredSearchQuery, libraryDocuments],
  )

  const selectedDocumentIncomingCount = selectedDocument
    ? libraryRelations.filter((relation) => relation.targetDocumentId === selectedDocument.id).length
    : 0
  const selectedDocumentOutgoingCount = selectedDocument
    ? libraryRelations.filter((relation) => relation.sourceDocumentId === selectedDocument.id).length
    : 0
  const selectedDocumentNotesCount = selectedDocument
    ? notes.filter((note) => note.documentId === selectedDocument.id).length
    : 0
  const selectedDocumentProposedCitationsCount = selectedDocument
    ? libraryRelations.filter(
      (relation) =>
        relation.sourceDocumentId === selectedDocument.id
        && relation.linkType === 'citation'
        && relation.relationStatus === 'proposed',
    ).length
    : 0
  const selectedDocumentPinned = selectedDocument
    ? effectiveLayoutMap.get(selectedDocument.id)?.pinned ?? false
    : false

  const clearPendingConnection = () => {
    setPendingConnectionDocumentId(null)
    setPendingConnectionDirection(null)
  }

  useEffect(() => {
    if (!focusDocumentId || !libraryDocumentIds.has(focusDocumentId)) return
    setManualVisibleDocumentIds((currentIds) => (
      currentIds.includes(focusDocumentId) ? currentIds : [...currentIds, focusDocumentId]
    ))
    setSelectedDocumentId(focusDocumentId)
  }, [focusDocumentId, libraryDocumentIds])

  useEffect(() => {
    if (selectedDocumentId && !libraryDocumentIds.has(selectedDocumentId)) {
      setSelectedDocumentId(null)
    }
  }, [libraryDocumentIds, selectedDocumentId])

  useEffect(() => {
    if (selectedRelationId && !libraryRelations.some((relation) => relation.id === selectedRelationId)) {
      setSelectedRelationId(null)
    }
  }, [libraryRelations, selectedRelationId])

  useEffect(() => {
    if (pendingConnectionDocumentId && !visibleDocuments.some((document) => document.id === pendingConnectionDocumentId)) {
      clearPendingConnection()
    }
  }, [pendingConnectionDocumentId, visibleDocuments])

  useEffect(() => {
    const appearance = Object.fromEntries(
      visibleDocuments.map((document) => {
        const metrics = visibleMetrics[document.id]
        const nodeAppearance = buildNodeAppearance({
          document,
          metrics,
          colorMode: graphPreferences.colorMode,
          sizeMode: graphPreferences.sizeMode,
          activeLibraryColor: activeLibrary?.color,
          currentDocumentId: activeDocumentId,
          isSelected: selectedDocumentId === document.id,
          isHovered: hoveredDocumentId === document.id,
          isFocused: graphPreferences.focusMode && selectedDocumentId === document.id,
          isSearchMatch: searchMatches.has(document.id),
        })

        return [document.id, {
          ...nodeAppearance,
          inboundCitationCount: metrics?.inboundCitationCount ?? 0,
          outboundCitationCount: metrics?.outboundCitationCount ?? 0,
          isCurrentDocument: activeDocumentId === document.id,
          isDimmed: false,
          isFocused: graphPreferences.focusMode && selectedDocumentId === document.id,
          isHovered: hoveredDocumentId === document.id,
          isSearchMatch: searchMatches.has(document.id),
          isSelected: selectedDocumentId === document.id,
          sizePx: nodeAppearance.sizePx,
        }]
      }),
    ) as Record<string, Partial<DocumentGraphNodeData>>

    const nextNodes = buildDocumentGraphNodes(visibleDocuments, visibleRelations, appearance).map((node) => {
      const savedLayout = effectiveLayoutMap.get(node.id)

      return {
        ...node,
        draggable: !savedLayout?.pinned,
        position: savedLayout ? { x: savedLayout.x, y: savedLayout.y } : node.position,
        data: {
          ...node.data,
          pendingConnectionDirection:
            node.id === pendingConnectionDocumentId ? pendingConnectionDirection : null,
          onStartConnection: (documentId: string, direction: ConnectionDirection) => {
            setSelectedRelationId(null)
            setSelectedDocumentId(documentId)

            const isSameSelection =
              pendingConnectionDocumentId === documentId && pendingConnectionDirection === direction

            if (isSameSelection) {
              clearPendingConnection()
              return
            }

            setPendingConnectionDocumentId(documentId)
            setPendingConnectionDirection(direction)
          },
        },
      }
    })

    const lockedPositions = new Map(
      Array.from(effectiveLayoutMap.values()).map((layout) => [layout.documentId, { x: layout.x, y: layout.y }]),
    )

    setNodes((currentNodes) => preserveNodePositions(nextNodes, currentNodes, lockedPositions))
    setEdges(buildDocumentGraphEdges(visibleRelations, selectedDocumentId, selectedRelationId, hoveredRelationId))
  }, [
    activeDocumentId,
    activeLibrary?.color,
    graphPreferences.colorMode,
    graphPreferences.focusMode,
    graphPreferences.sizeMode,
    hoveredDocumentId,
    hoveredRelationId,
    pendingConnectionDirection,
    pendingConnectionDocumentId,
    searchMatches,
    selectedDocumentId,
    selectedRelationId,
    setEdges,
    setNodes,
    effectiveLayoutMap,
    visibleDocuments,
    visibleMetrics,
    visibleRelations,
  ])

  const handleConnect: OnConnect = async (connection: Connection) => {
    if (!connection.source || !connection.target || connection.source === connection.target) return
    dragConnectionCompletedRef.current = true
    const direction = connection.sourceHandle === 'inbound' ? 'inbound' : 'outbound'
    const sourceDocumentId = direction === 'inbound' ? connection.target : connection.source
    const targetDocumentId = direction === 'inbound' ? connection.source : connection.target

    const created = await createRelation({
      sourceDocumentId,
      targetDocumentId,
      linkType: newManualLinkType,
      linkOrigin: 'user',
    })

    if (!created) return

    setManualVisibleDocumentIds((currentIds) => Array.from(new Set([...currentIds, sourceDocumentId, targetDocumentId])))
    clearPendingConnection()
    setSelectedDocumentId(null)
    setSelectedRelationId(created.id)
  }

  const handleConnectStart: OnConnectStart = (_, params) => {
    dragConnectionCompletedRef.current = false
    dragConnectionHandleIdRef.current = params.handleId ?? null
    dragConnectionSourceIdRef.current = params.handleType === 'source' ? params.nodeId : null
  }

  const handleConnectEnd: OnConnectEnd = async (event) => {
    const sourceDocumentId = dragConnectionSourceIdRef.current
    const sourceHandleId = dragConnectionHandleIdRef.current
    dragConnectionSourceIdRef.current = null
    dragConnectionHandleIdRef.current = null

    if (dragConnectionCompletedRef.current) {
      dragConnectionCompletedRef.current = false
      return
    }
    if (!sourceDocumentId) return

    const rawTarget = event.target
    if (!(rawTarget instanceof Element)) return
    const targetDocumentId = rawTarget.closest('[data-document-node-id]')?.getAttribute('data-document-node-id')
    if (!targetDocumentId || targetDocumentId === sourceDocumentId) return
    const direction = sourceHandleId === 'inbound' ? 'inbound' : 'outbound'
    const relationSourceDocumentId = direction === 'inbound' ? targetDocumentId : sourceDocumentId
    const relationTargetDocumentId = direction === 'inbound' ? sourceDocumentId : targetDocumentId

    const created = await createRelation({
      sourceDocumentId: relationSourceDocumentId,
      targetDocumentId: relationTargetDocumentId,
      linkType: newManualLinkType,
      linkOrigin: 'user',
    })

    if (!created) return

    setManualVisibleDocumentIds((currentIds) => Array.from(new Set([...currentIds, relationSourceDocumentId, relationTargetDocumentId])))
    clearPendingConnection()
    setSelectedDocumentId(null)
    setSelectedRelationId(created.id)
  }

  const handleClickToConnect = async (clickedDocumentId: string) => {
    if (!pendingConnectionDocumentId || !pendingConnectionDirection || pendingConnectionDocumentId === clickedDocumentId) return

    const sourceDocumentId =
      pendingConnectionDirection === 'outbound' ? pendingConnectionDocumentId : clickedDocumentId
    const targetDocumentId =
      pendingConnectionDirection === 'outbound' ? clickedDocumentId : pendingConnectionDocumentId

    const created = await createRelation({
      sourceDocumentId,
      targetDocumentId,
      linkType: newManualLinkType,
      linkOrigin: 'user',
    })

    if (!created) return

    setManualVisibleDocumentIds((currentIds) => Array.from(new Set([...currentIds, sourceDocumentId, targetDocumentId])))
    clearPendingConnection()
    setSelectedDocumentId(null)
    setSelectedRelationId(created.id)
  }

  const handleDeleteRelation = async (relationId: string) => {
    const confirmed = window.confirm('Delete this document relation?')
    if (!confirmed) return

    setIsDeletingRelation(true)
    try {
      const deleted = await deleteRelation(relationId)
      if (deleted) setSelectedRelationId(null)
    } finally {
      setIsDeletingRelation(false)
    }
  }

  const handleDeleteRelationWithoutPrompt = async (relationId: string) => {
    setIsDeletingRelation(true)
    try {
      const deleted = await deleteRelation(relationId)
      if (deleted) {
        setSelectedRelationId((currentId) => (currentId === relationId ? null : currentId))
      }
    } finally {
      setIsDeletingRelation(false)
    }
  }

  const handleDeleteAllLinksForDocument = async (documentId: string) => {
    const connectedRelations = libraryRelations.filter(
      (relation) =>
        relation.sourceDocumentId === documentId || relation.targetDocumentId === documentId,
    )

    if (connectedRelations.length === 0) return

    const confirmed = window.confirm(`Delete ${connectedRelations.length} link(s) connected to this node?`)
    if (!confirmed) return

    setIsDeletingRelation(true)
    try {
      await Promise.all(connectedRelations.map((relation) => deleteRelation(relation.id)))
      setSelectedRelationId((currentId) =>
        currentId && connectedRelations.some((relation) => relation.id === currentId) ? null : currentId,
      )
    } finally {
      setIsDeletingRelation(false)
    }
  }

  const handleInvertRelation = async (relationId: string) => {
    const relation = libraryRelations.find((entry) => entry.id === relationId)
    if (!relation) return

    const inverted = await createRelation({
      sourceDocumentId: relation.targetDocumentId,
      targetDocumentId: relation.sourceDocumentId,
      linkType: relation.linkType,
      linkOrigin: relation.linkOrigin,
      relationStatus: relation.relationStatus,
      confidence: relation.confidence,
      label: relation.label,
      notes: relation.notes,
      matchMethod: relation.matchMethod,
      rawReferenceText: relation.rawReferenceText,
      normalizedReferenceText: relation.normalizedReferenceText,
      normalizedTitle: relation.normalizedTitle,
      normalizedFirstAuthor: relation.normalizedFirstAuthor,
      referenceIndex: relation.referenceIndex,
      parseConfidence: relation.parseConfidence,
      parseWarnings: relation.parseWarnings,
      matchDebugInfo: relation.matchDebugInfo,
    })

    if (!inverted) return

    await handleDeleteRelationWithoutPrompt(relationId)
    setSelectedDocumentId(null)
    setSelectedRelationId(inverted.id)
  }

  const handleUpdateRelationStatus = async (relationId: string, relationStatus: 'confirmed' | 'rejected') => {
    await updateRelation(relationId, { relationStatus })
    setSelectedRelationId(relationId)
  }

  const handleUpdateManualRelation = async (
    relationId: string,
    input: { linkType?: DocumentRelationLinkType; label?: string; notes?: string },
  ) => {
    await updateRelation(relationId, input)
    setSelectedRelationId(relationId)
  }

  const handleRebuildAutoLinks = async () => {
    if (!activeLibrary) return

    setIsRebuildingAutoLinks(true)
    try {
      await rebuildAutoCitationRelations(activeLibrary.id)
      setSelectedRelationId(null)
    } finally {
      setIsRebuildingAutoLinks(false)
    }
  }

  const handleRebuildSelectedDocumentCitations = async (documentId: string) => {
    setIsRebuildingDocumentCitations(true)
    try {
      await rebuildAutoCitationRelationsForDocument(documentId)
      setSelectedRelationId(null)
    } finally {
      setIsRebuildingDocumentCitations(false)
    }
  }

  const handleNodesChange: OnNodesChange = (changes) => onNodesChange(changes)
  const handleEdgesChange: OnEdgesChange = (changes) => onEdgesChange(changes)
  const handleNodeDragStart: NodeMouseHandler = (_, node) => {
    setSelectedDocumentId(node.id)
    setSelectedRelationId(null)
    setActiveDocument(node.id)
  }
  const handleNodeDragStop: NodeDragHandler = async (_, node) => {
    if (activeGraphViewId) {
      const existingLayout = graphViewLayoutMap.get(node.id)
      await upsertGraphViewNodeLayout({
        graphViewId: activeGraphViewId,
        documentId: node.id,
        x: node.position.x,
        y: node.position.y,
        pinned: existingLayout?.pinned ?? false,
        hidden: false,
      })
      return
    }

    if (!activeLibraryId) return

    setWorkingLayoutPositions((currentLayouts) => {
      const nextLayouts = {
        ...currentLayouts,
        [node.id]: { x: node.position.x, y: node.position.y },
      }
      const storedLayouts = readWorkingMapLayouts()
      writeWorkingMapLayouts({
        ...storedLayouts,
        [activeLibraryId]: nextLayouts,
      })
      return nextLayouts
    })
  }

  const handleAddDocumentToMap = async (documentId: string) => {
    if (!documentId || documentId === '__none__') return
    const nextDocumentIds = Array.from(new Set([...manualVisibleDocumentIds, documentId]))
    setManualVisibleDocumentIds(nextDocumentIds)
    setHiddenDocumentIds((currentIds) => currentIds.filter((id) => id !== documentId))
    setSelectedRelationId(null)
    setSelectedDocumentId(documentId)
    setActiveDocument(documentId)
    if (activeGraphView) {
      await updateGraphView(activeGraphView.id, { documentIds: nextDocumentIds })
      await upsertGraphViewNodeLayout({
        graphViewId: activeGraphView.id,
        documentId,
        x: reactFlow.getNode(documentId)?.position.x ?? 0,
        y: reactFlow.getNode(documentId)?.position.y ?? 0,
        hidden: false,
      })
    }
  }

  const handleOpenSaveViewDialog = () => {
    setGraphViewDraft({
      name: activeGraphView?.name ?? '',
      description: activeGraphView?.description ?? '',
    })
    setIsSaveViewDialogOpen(true)
  }

  const handleOpenEditViewDialog = () => {
    if (!activeGraphView) return
    setGraphViewDraft({
      name: activeGraphView.name,
      description: activeGraphView.description ?? '',
    })
    setIsEditingViewDialogOpen(true)
  }

  const currentViewDocumentIds = useMemo(
    () => Array.from(new Set(visibleDocuments.map((document) => document.id))),
    [visibleDocuments],
  )

  const persistActiveViewSnapshot = async (nextGraphView?: GraphView | null) => {
    const targetView = nextGraphView ?? activeGraphView
    if (!targetView) return

    await updateGraphView(targetView.id, {
      relationFilter: graphPreferences.relationFilter,
      colorMode: graphPreferences.colorMode,
      sizeMode: graphPreferences.sizeMode,
      scopeMode: graphPreferences.scopeMode,
      neighborhoodDepth: graphPreferences.neighborhoodDepth,
      focusMode: graphPreferences.focusMode,
      hideOrphans: graphPreferences.hideOrphans,
      confidenceThreshold: graphPreferences.confidenceThreshold,
      yearMin: graphPreferences.yearMin,
      yearMax: graphPreferences.yearMax,
      selectedDocumentId: selectedDocumentId ?? undefined,
      documentIds: currentViewDocumentIds,
    })
  }

  const handleSaveCurrentView = async () => {
    if (!activeLibrary) return

    if (activeGraphView) {
      await persistActiveViewSnapshot(activeGraphView)
      setIsEditingViewDialogOpen(false)
      return
    }

    const created = await createGraphView({
      libraryId: activeLibrary.id,
      name: graphViewDraft.name.trim() || 'Untitled workspace',
      description: graphViewDraft.description.trim() || undefined,
      relationFilter: graphPreferences.relationFilter,
      colorMode: graphPreferences.colorMode,
      sizeMode: graphPreferences.sizeMode,
      scopeMode: graphPreferences.scopeMode,
      neighborhoodDepth: graphPreferences.neighborhoodDepth,
      focusMode: graphPreferences.focusMode,
      hideOrphans: graphPreferences.hideOrphans,
      confidenceThreshold: graphPreferences.confidenceThreshold,
      yearMin: graphPreferences.yearMin,
      yearMax: graphPreferences.yearMax,
      selectedDocumentId: selectedDocumentId ?? undefined,
      documentIds: currentViewDocumentIds,
    })

    if (!created) return
    setActiveGraphViewId(created.id)
    setIsSaveViewDialogOpen(false)
    setGraphViewDraft(DEFAULT_GRAPH_VIEW_DRAFT)
  }

  const handleUpdateGraphViewMeta = async () => {
    if (!activeGraphView) return
    const updated = await updateGraphView(activeGraphView.id, {
      name: graphViewDraft.name.trim() || activeGraphView.name,
      description: graphViewDraft.description.trim() || undefined,
      relationFilter: graphPreferences.relationFilter,
      colorMode: graphPreferences.colorMode,
      sizeMode: graphPreferences.sizeMode,
      scopeMode: graphPreferences.scopeMode,
      neighborhoodDepth: graphPreferences.neighborhoodDepth,
      focusMode: graphPreferences.focusMode,
      hideOrphans: graphPreferences.hideOrphans,
      confidenceThreshold: graphPreferences.confidenceThreshold,
      yearMin: graphPreferences.yearMin,
      yearMax: graphPreferences.yearMax,
      selectedDocumentId: selectedDocumentId ?? undefined,
      documentIds: currentViewDocumentIds,
    })
    if (!updated) return
    setIsEditingViewDialogOpen(false)
  }

  const handleDuplicateGraphView = async () => {
    if (!activeGraphView) return
    const duplicated = await duplicateGraphView(activeGraphView.id)
    if (!duplicated) return
    setActiveGraphViewId(duplicated.id)
  }

  const handleDeleteActiveGraphView = async () => {
    if (!activeGraphView) return
    const confirmed = window.confirm(`Delete workspace "${activeGraphView.name}"?`)
    if (!confirmed) return
    const deleted = await deleteGraphView(activeGraphView.id)
    if (!deleted) return
    setActiveGraphViewId(null)
  }

  const centerOnDocument = (documentId: string) => {
    const node = reactFlow.getNode(documentId)
    if (!node) return
    const width = typeof node.width === 'number' ? node.width : 220
    const height = typeof node.height === 'number' ? node.height : 220
    reactFlow.setCenter(node.position.x + width / 2, node.position.y + height / 2, {
      duration: 400,
      zoom: Math.max(reactFlow.getZoom(), 1),
    })
  }

  const handlePinDocument = async (documentId: string, pinned: boolean) => {
    if (!activeGraphViewId) return
    const node = reactFlow.getNode(documentId)
    if (!node) return
    await upsertGraphViewNodeLayout({
      graphViewId: activeGraphViewId,
      documentId,
      x: node.position.x,
      y: node.position.y,
      pinned,
      hidden: false,
    })
  }

  const handleResetDocumentPosition = async (documentId: string) => {
    if (!activeGraphViewId) return
    await resetGraphViewNodeLayouts(activeGraphViewId, documentId)
    handleReheatLayout()
  }

  const handleResetCurrentViewPositions = async () => {
    if (!activeGraphViewId) return
    await resetGraphViewNodeLayouts(activeGraphViewId)
    handleReheatLayout()
  }

  const handleRemoveDocumentFromCurrentView = async (documentId: string) => {
    setHiddenDocumentIds((currentIds) => Array.from(new Set([...currentIds, documentId])))
    if (!activeGraphView) return
    await upsertGraphViewNodeLayout({
      graphViewId: activeGraphView.id,
      documentId,
      x: reactFlow.getNode(documentId)?.position.x ?? 0,
      y: reactFlow.getNode(documentId)?.position.y ?? 0,
      hidden: true,
      pinned: graphViewLayoutMap.get(documentId)?.pinned ?? false,
    })
    if (selectedDocumentId === documentId) {
      setSelectedDocumentId(null)
    }
  }

  const handleJumpToDocument = (documentId: string) => {
    setManualVisibleDocumentIds((currentIds) => Array.from(new Set([...currentIds, documentId])))
    setSelectedRelationId(null)
    setSelectedDocumentId(documentId)
    setActiveDocument(documentId)
    startTransition(() => {
      window.setTimeout(() => centerOnDocument(documentId), 60)
    })
  }

  const handleShowNeighborsOnly = (documentId: string) => {
    setSelectedRelationId(null)
    setSelectedDocumentId(documentId)
    setGraphPreferences((current) => ({
      ...current,
      focusMode: true,
      neighborhoodDepth: '1',
    }))
    startTransition(() => {
      window.setTimeout(() => centerOnDocument(documentId), 60)
    })
  }

  const handleResetFocus = () => {
    setGraphPreferences((current) => ({
      ...current,
      focusMode: false,
      neighborhoodDepth: 'full',
    }))
  }

  const handleZoomToFit = () => {
    reactFlow.fitView({ duration: 400, padding: 0.2 })
  }

  const handleCenterSelected = () => {
    if (!selectedDocumentId) return
    centerOnDocument(selectedDocumentId)
  }

  const handleReheatLayout = () => {
    if (visibleDocuments.length === 0) return

    setIsReheatingLayout(true)
    const currentPositions = new Map(nodes.map((node) => [node.id, node.position]))
    const nextPositions = runReheatLayout({
      nodeIds: visibleDocuments.map((document) => document.id),
      relations: visibleRelations.map((relation) => ({
        sourceDocumentId: relation.sourceDocumentId,
        targetDocumentId: relation.targetDocumentId,
      })),
      currentPositions,
    })

    setNodes((currentNodes) =>
      currentNodes.map((node) => ({
        ...node,
        position: nextPositions.get(node.id) ?? node.position,
      })),
    )

    if (!activeGraphViewId && activeLibraryId) {
      const nextWorkingLayouts = Object.fromEntries(
        Array.from(nextPositions.entries()).map(([documentId, position]) => [documentId, position]),
      )
      setWorkingLayoutPositions(nextWorkingLayouts)
      const storedLayouts = readWorkingMapLayouts()
      writeWorkingMapLayouts({
        ...storedLayouts,
        [activeLibraryId]: nextWorkingLayouts,
      })
    }

    window.setTimeout(() => setIsReheatingLayout(false), 250)
  }

  if (libraryDocuments.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <EmptyState
          icon={GitBranch}
          title="Knowledge maps are empty"
          description="Import documents into the current library to start building a relationship graph."
          action={(
            <Button asChild>
              <Link href="/libraries">Open Libraries</Link>
            </Button>
          )}
        />
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(13,148,136,0.06),_transparent_24%),linear-gradient(180deg,_rgba(248,250,252,1)_0%,_rgba(244,246,248,1)_100%)]">
      <div className="shrink-0 border-b border-border/80 bg-background/92 px-6 py-4 backdrop-blur">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Maps</h1>
              <p className="text-sm text-muted-foreground">
                {activeLibrary ? `${activeLibrary.name} • ` : ''}
                Explore document relationships.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Select
                value={activeGraphViewId ?? '__working__'}
                onValueChange={(value) => setActiveGraphViewId(value === '__working__' ? null : value)}
              >
                <SelectTrigger className="w-[190px] bg-background">
                  <SelectValue placeholder="Working map" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__working__">Working map</SelectItem>
                  {activeLibraryGraphViews.map((view) => (
                    <SelectItem key={view.id} value={view.id}>
                      {view.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={newManualLinkType}
                onValueChange={(value) => setNewManualLinkType(value as DocumentRelationLinkType)}
              >
                <SelectTrigger className="w-[180px] bg-background">
                  <SelectValue placeholder="New manual link type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="related">Related</SelectItem>
                  <SelectItem value="supports">Supports</SelectItem>
                  <SelectItem value="contradicts">Contradicts</SelectItem>
                  <SelectItem value="same_topic">Same topic</SelectItem>
                </SelectContent>
              </Select>
              <Popover open={isAddDocumentPopoverOpen} onOpenChange={setIsAddDocumentPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={isAddDocumentPopoverOpen}
                    className="w-[220px] justify-between bg-background"
                  >
                    Add document
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[320px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search documents..." />
                    <CommandList>
                      <CommandEmpty>No matching document found.</CommandEmpty>
                      <CommandGroup>
                        {addableDocuments.map((document) => (
                          <CommandItem
                            key={document.id}
                            value={`${document.title} ${document.authors.join(' ')} ${document.year ?? ''}`}
                            onSelect={() => {
                              void handleAddDocumentToMap(document.id)
                              setIsAddDocumentPopoverOpen(false)
                            }}
                          >
                            <Check className="mr-2 h-4 w-4 opacity-0" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate">{document.title}</p>
                              <p className="truncate text-xs text-slate-500">
                                {document.authors.slice(0, 2).join(', ') || 'Unknown author'}
                                {document.year ? ` - ${document.year}` : ''}
                              </p>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {activeGraphView ? (
                <Button variant="outline" onClick={() => void persistActiveViewSnapshot()}>
                  <Save className="mr-2 h-4 w-4" />
                  Save
                </Button>
              ) : null}
              <Button variant="outline" onClick={handleOpenSaveViewDialog}>
                <Save className="mr-2 h-4 w-4" />
                {activeGraphView ? 'Save As' : 'Save View'}
              </Button>
              {activeGraphView ? (
                <>
                  <Button variant="outline" onClick={handleOpenEditViewDialog}>
                    Rename
                  </Button>
                  <Button variant="outline" onClick={() => void handleDuplicateGraphView()}>
                    <Plus className="mr-2 h-4 w-4" />
                    Duplicate
                  </Button>
                  <Button variant="outline" onClick={() => void handleResetCurrentViewPositions()}>
                    <Pin className="mr-2 h-4 w-4" />
                    Reset Positions
                  </Button>
                  <Button variant="outline" onClick={() => void handleDeleteActiveGraphView()}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </>
              ) : null}
              <Button
                variant="outline"
                onClick={handleReheatLayout}
                disabled={isReheatingLayout || visibleDocuments.length === 0}
              >
                <WandSparkles className={cn('mr-2 h-4 w-4', isReheatingLayout && 'animate-pulse')} />
                Reheat
              </Button>
              <Button
                variant="outline"
                onClick={() => void handleRebuildAutoLinks()}
                disabled={isRebuildingAutoLinks || !activeLibrary}
              >
                <RefreshCw className={cn('mr-2 h-4 w-4', isRebuildingAutoLinks && 'animate-spin')} />
                Rebuild Citations
              </Button>
            </div>
          </div>

          <DocumentGraphControls
            relationFilter={graphPreferences.relationFilter}
            onRelationFilterChange={(value) => setGraphPreferences((current) => ({ ...current, relationFilter: value }))}
            colorMode={graphPreferences.colorMode}
            onColorModeChange={(value) => setGraphPreferences((current) => ({ ...current, colorMode: value }))}
            sizeMode={graphPreferences.sizeMode}
            onSizeModeChange={(value) => setGraphPreferences((current) => ({ ...current, sizeMode: value }))}
            scopeMode={graphPreferences.scopeMode}
            onScopeModeChange={(value) => setGraphPreferences((current) => ({ ...current, scopeMode: value }))}
            neighborhoodDepth={graphPreferences.neighborhoodDepth}
            onNeighborhoodDepthChange={(value) => setGraphPreferences((current) => ({ ...current, neighborhoodDepth: value }))}
            focusMode={graphPreferences.focusMode}
            onFocusModeChange={(value) => setGraphPreferences((current) => ({ ...current, focusMode: value }))}
            hideOrphans={graphPreferences.hideOrphans}
            onHideOrphansChange={(value) => setGraphPreferences((current) => ({ ...current, hideOrphans: value }))}
            confidenceThreshold={graphPreferences.confidenceThreshold}
            onConfidenceThresholdChange={(value) => setGraphPreferences((current) => ({ ...current, confidenceThreshold: value }))}
            yearMin={graphPreferences.yearMin}
            yearMax={graphPreferences.yearMax}
            yearOptions={yearOptions}
            onYearMinChange={(value) => setGraphPreferences((current) => ({ ...current, yearMin: value }))}
            onYearMaxChange={(value) => setGraphPreferences((current) => ({ ...current, yearMax: value }))}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            searchResults={searchResults}
            onJumpToDocument={handleJumpToDocument}
            onZoomToFit={handleZoomToFit}
            onCenterSelected={handleCenterSelected}
            onResetFocus={handleResetFocus}
          />
        </div>
      </div>

      <ResizablePanelGroup direction="horizontal" className="min-h-0 flex-1">
        <ResizablePanel defaultSize={72} minSize={45}>
          <div className="relative h-full min-h-0 overflow-hidden">
          {visibleDocuments.length === 0 ? (
            <div className="pointer-events-none absolute left-6 top-6 z-10 max-w-sm">
              <Card className="border-dashed bg-card/92 p-4 shadow-sm">
                <p className="text-sm text-muted-foreground">
                  No documents match the current controls.
                </p>
              </Card>
            </div>
          ) : visibleRelations.length === 0 ? (
            <div className="pointer-events-none absolute left-6 top-6 z-10 max-w-sm">
              <Card className="border-dashed bg-card/92 p-4 shadow-sm">
                <p className="text-sm text-muted-foreground">
                  No links match the current controls.
                </p>
              </Card>
            </div>
          ) : null}

          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={handleNodesChange}
            onNodeDragStart={handleNodeDragStart}
            onNodeDragStop={(event, node, nodesForDrag) => void handleNodeDragStop(event, node, nodesForDrag)}
            onEdgesChange={handleEdgesChange}
            onConnectStart={handleConnectStart}
            onConnect={(connection) => void handleConnect(connection)}
            onConnectEnd={(event) => void handleConnectEnd(event)}
            onNodeClick={async (_, node) => {
              if (pendingConnectionDocumentId && pendingConnectionDocumentId !== node.id) {
                await handleClickToConnect(node.id)
                return
              }
              setSelectedDocumentId(node.id)
              setSelectedRelationId(null)
              setActiveDocument(node.id)
            }}
            onNodeContextMenu={(event, node) => {
              event.preventDefault()
              setSelectedDocumentId(node.id)
              setSelectedRelationId(null)
              setContextMenu({
                kind: 'node',
                documentId: node.id,
                x: event.clientX,
                y: event.clientY,
              })
              setActiveDocument(node.id)
            }}
            onNodeMouseEnter={(_, node) => setHoveredDocumentId(node.id)}
            onNodeMouseLeave={() => setHoveredDocumentId(null)}
            onEdgeClick={(_, edge) => {
              setSelectedDocumentId(null)
              clearPendingConnection()
              setSelectedRelationId(edge.id)
            }}
            onEdgeContextMenu={(event, edge) => {
              event.preventDefault()
              setSelectedDocumentId(null)
              clearPendingConnection()
              setSelectedRelationId(edge.id)
              setContextMenu({
                kind: 'edge',
                relationId: edge.id,
                x: event.clientX,
                y: event.clientY,
              })
            }}
            onEdgeMouseEnter={(_, edge) => setHoveredRelationId(edge.id)}
            onEdgeMouseLeave={() => setHoveredRelationId(null)}
            onPaneClick={() => {
              setSelectedDocumentId(null)
              setSelectedRelationId(null)
              setContextMenu(null)
              clearPendingConnection()
            }}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            connectionRadius={72}
            className="h-full"
            proOptions={{ hideAttribution: true }}
          >
            <MiniMap
              pannable
              zoomable
              nodeStrokeColor={(node) => node.data?.borderColor ?? '#cbd5e1'}
              nodeColor={(node) => node.data?.fillColor ?? '#ffffff'}
              maskColor="rgba(241,245,249,0.72)"
            />
            <Controls />
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#cbd5e1" />
          </ReactFlow>
          {contextMenu ? (
            <div
              className="fixed z-[1000] min-w-[180px] rounded-md border bg-white p-1 shadow-lg"
              style={{ left: contextMenu.x, top: contextMenu.y }}
            >
              {contextMenu.kind === 'node' ? (
                <>
                  <button
                    type="button"
                    className="w-full rounded-sm px-3 py-2 text-left text-sm hover:bg-slate-100"
                    onClick={() => {
                      void handleRemoveDocumentFromCurrentView(contextMenu.documentId)
                      setContextMenu(null)
                    }}
                  >
                    Delete node
                  </button>
                  <button
                    type="button"
                    className="w-full rounded-sm px-3 py-2 text-left text-sm hover:bg-slate-100"
                    onClick={() => {
                      void handleDeleteAllLinksForDocument(contextMenu.documentId)
                      setContextMenu(null)
                    }}
                  >
                    Delete all links
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="w-full rounded-sm px-3 py-2 text-left text-sm hover:bg-slate-100"
                    onClick={() => {
                      void handleDeleteRelationWithoutPrompt(contextMenu.relationId)
                      setContextMenu(null)
                    }}
                  >
                    Remove link
                  </button>
                  <button
                    type="button"
                    className="w-full rounded-sm px-3 py-2 text-left text-sm hover:bg-slate-100"
                    onClick={() => {
                      void handleInvertRelation(contextMenu.relationId)
                      setContextMenu(null)
                    }}
                  >
                    Invert link
                  </button>
                </>
              )}
            </div>
          ) : null}
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle className="bg-border/80 hover:bg-border" />

        <ResizablePanel defaultSize={28} minSize={20} maxSize={45}>
          <aside className="h-full min-h-0 overflow-hidden border-l border-border/80 bg-background/94 backdrop-blur">
            <DocumentGraphPanel
              selectedDocument={selectedDocument}
              selectedRelation={selectedRelation}
              sourceDocument={sourceDocument}
              targetDocument={targetDocument}
              selectedLibraryName={activeLibrary?.name ?? null}
              relatedNotesCount={selectedDocumentNotesCount}
              relatedIncomingCount={selectedDocumentIncomingCount}
              relatedOutgoingCount={selectedDocumentOutgoingCount}
              relatedProposedCitationsCount={selectedDocumentProposedCitationsCount}
              onDeleteRelation={handleDeleteRelation}
              onUpdateRelationStatus={handleUpdateRelationStatus}
              onUpdateManualRelation={handleUpdateManualRelation}
              onRebuildDocumentCitations={handleRebuildSelectedDocumentCitations}
              onCenterDocument={centerOnDocument}
              onShowNeighborsOnly={handleShowNeighborsOnly}
              onPinDocument={handlePinDocument}
              onResetDocumentPosition={handleResetDocumentPosition}
              onRemoveDocumentFromView={handleRemoveDocumentFromCurrentView}
              isPinned={selectedDocumentPinned}
              isDeletingRelation={isDeletingRelation}
              isRebuildingDocumentCitations={isRebuildingDocumentCitations}
            />
          </aside>
        </ResizablePanel>
      </ResizablePanelGroup>

      <Dialog open={isSaveViewDialogOpen} onOpenChange={setIsSaveViewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Graph View</DialogTitle>
            <DialogDescription>
              Persist the current map as a reusable research workspace with its current filters, subset, and layout.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="graph-view-name">Name</Label>
              <Input
                id="graph-view-name"
                value={graphViewDraft.name}
                onChange={(event) => setGraphViewDraft((current) => ({ ...current, name: event.target.value }))}
                placeholder="Thermal battery citations"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="graph-view-description">Workspace note</Label>
              <Textarea
                id="graph-view-description"
                value={graphViewDraft.description}
                onChange={(event) => setGraphViewDraft((current) => ({ ...current, description: event.target.value }))}
                placeholder="Why this map exists, what this subset means, or what to review next."
                className="min-h-24"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSaveViewDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleSaveCurrentView()}>
              Save View
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditingViewDialogOpen} onOpenChange={setIsEditingViewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Graph View</DialogTitle>
            <DialogDescription>
              Rename this workspace or update its description without changing the underlying document relations.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-graph-view-name">Name</Label>
              <Input
                id="edit-graph-view-name"
                value={graphViewDraft.name}
                onChange={(event) => setGraphViewDraft((current) => ({ ...current, name: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-graph-view-description">Workspace note</Label>
              <Textarea
                id="edit-graph-view-description"
                value={graphViewDraft.description}
                onChange={(event) => setGraphViewDraft((current) => ({ ...current, description: event.target.value }))}
                className="min-h-24"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditingViewDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleUpdateGraphViewMeta()}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function MapsPage() {
  return (
    <ReactFlowProvider>
      <MapsPageContent />
    </ReactFlowProvider>
  )
}
