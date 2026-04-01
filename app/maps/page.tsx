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
  useStore,
} from 'reactflow'
import 'reactflow/dist/style.css'
import {
  Check,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  GitBranch,
  Pin,
  Plus,
  Save,
  Trash2,
  Waypoints,
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
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
import type { GraphView } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/localization'

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

type MyWorkDraft = {
  title: string
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

const DEFAULT_MY_WORK_DRAFT: MyWorkDraft = {
  title: '',
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
  const zoom = useStore((state) => state.transform[2])
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
    connectionDirection?: 'incoming' | 'outgoing' | null
    relationStatus?: string
  }
  const connectedDirection = edgeData.connectionDirection
  const connectedClasses = connectedDirection === 'outgoing'
    ? 'border-sky-300 bg-sky-50 text-sky-700'
    : connectedDirection === 'incoming'
      ? 'border-rose-300 bg-rose-50 text-rose-700'
      : 'border-slate-300 bg-white text-slate-700'
  const confidence = typeof edgeData.confidence === 'number'
    ? Math.round(edgeData.confidence * 100)
    : null
  const arrowAngle = Math.atan2(sourceY - targetY, sourceX - targetX) * (180 / Math.PI)

  return (
    <>
      <BaseEdge id={id} path={edgePath} markerStart={markerStart} markerEnd={markerEnd} style={style} />
      <EdgeLabelRenderer>
        <div
          className={cn(
            'pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border shadow-sm',
            selected
              ? 'border-amber-300 bg-white text-amber-600'
              : edgeData.isConnectedToSelectedDocument
                ? connectedClasses
                : 'border-slate-200/80 bg-white/92 text-slate-500',
          )}
          style={{
            left: labelX,
            top: labelY,
            transform: `translate(-50%, -50%) rotate(${arrowAngle}deg) scale(${1 / Math.max(zoom, 0.001)})`,
            transformOrigin: 'center',
          }}
        >
          <ArrowRight className="h-3.5 w-3.5" />
        </div>
      </EdgeLabelRenderer>
      {(label && selected) ? (
        <EdgeLabelRenderer>
          <div
            className={cn(
              'pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-2xl border px-3 py-2 text-[11px] shadow-md',
              selected
                ? 'border-teal-200 bg-white text-slate-900'
                : connectedDirection === 'outgoing'
                  ? 'border-sky-200 bg-sky-50/95 text-sky-900'
                  : connectedDirection === 'incoming'
                    ? 'border-rose-200 bg-rose-50/95 text-rose-900'
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
  const t = useT()
  const {
    document,
    fillColor,
    borderColor,
    connectionDirection,
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
    : t('searchPage.unknownAuthor')
  const canCreateInboundLinks = document.documentType !== 'my_work'

  return (
    <div
      data-document-node-id={document.id}
      className={cn(
        'relative z-10 flex h-full w-full items-center justify-center overflow-visible rounded-full text-center shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur transition-all',
        pendingConnectionDirection && 'ring-4 ring-teal-100',
        isSelected && 'ring-4 ring-amber-300 shadow-[0_0_0_8px_rgba(251,191,36,0.22),0_16px_40px_rgba(15,23,42,0.12)]',
        connectionDirection === 'outgoing' && !isSelected && 'ring-[5px] ring-sky-300 shadow-[0_0_0_10px_rgba(59,130,246,0.22),0_18px_44px_rgba(15,23,42,0.12)]',
        connectionDirection === 'incoming' && !isSelected && 'ring-[5px] ring-rose-300 shadow-[0_0_0_10px_rgba(244,63,94,0.2),0_18px_44px_rgba(15,23,42,0.12)]',
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
        <div className="group/link-actions absolute -top-9 left-1/2 z-30 -translate-x-1/2">
          <div className="flex flex-col items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-amber-400 bg-amber-300 text-black shadow-sm transition group-hover/link-actions:border-amber-500 group-hover/link-actions:bg-amber-400">
                  <Plus className="h-4 w-4" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={8}>{t('mapsPage.addOrConnect')}</TooltipContent>
            </Tooltip>
            <div
              className={cn(
                'flex items-center gap-3 transition',
                pendingConnectionDirection
                  ? 'pointer-events-auto opacity-100'
                  : 'pointer-events-none opacity-0 group-hover/link-actions:pointer-events-auto group-hover/link-actions:opacity-100',
              )}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      onStartConnection(document.id, 'outbound')
                    }}
                    className={cn(
                      'min-w-[136px] whitespace-nowrap rounded-full border px-4 py-2 text-xs font-semibold shadow-sm transition',
                      pendingConnectionDirection === 'outbound'
                        ? 'border-sky-600 bg-sky-600 text-white'
                        : 'border-sky-500 bg-sky-500 text-white hover:border-sky-600 hover:bg-sky-600',
                    )}
                  >
                    {t('mapsPage.addReference')}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={8}>
                  {t('mapsPage.addReferenceHelp')}
                </TooltipContent>
              </Tooltip>
              {canCreateInboundLinks ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        onStartConnection(document.id, 'inbound')
                      }}
                      className={cn(
                        'min-w-[136px] whitespace-nowrap rounded-full border px-4 py-2 text-xs font-semibold shadow-sm transition',
                        pendingConnectionDirection === 'inbound'
                          ? 'border-rose-600 bg-rose-600 text-white'
                          : 'border-rose-500 bg-rose-500 text-white hover:border-rose-600 hover:bg-rose-600',
                      )}
                    >
                      {t('mapsPage.addCitation')}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={8}>
                    {t('mapsPage.addCitationHelp')}
                  </TooltipContent>
                </Tooltip>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {pendingConnectionDirection ? (
        <div
          className={cn(
            'pointer-events-none absolute inset-0 z-10 rounded-full border-2 border-dashed',
            pendingConnectionDirection === 'outbound'
              ? 'border-sky-500/90'
              : 'border-rose-500/90',
          )}
        />
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
  const t = useT()
  const params = useSearchParams()
  const focusDocumentId = params.get('focus')
  const reactFlow = useReactFlow<GraphNodeData>()
  const {
    activeDocumentId,
    activeLibraryId,
    createDocumentRecord,
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
  const [searchQuery, setSearchQuery] = useState('')
  const [isAddDocumentPopoverOpen, setIsAddDocumentPopoverOpen] = useState(false)
  const [pendingConnectionCursor, setPendingConnectionCursor] = useState<{ x: number; y: number } | null>(null)
  const deferredSearchQuery = useDeferredValue(searchQuery)
  const [isDeletingRelation, setIsDeletingRelation] = useState(false)
  const [contextMenu, setContextMenu] = useState<GraphContextMenuState>(null)
  const [isReheatingLayout, setIsReheatingLayout] = useState(false)
  const [isTopBarCollapsed, setIsTopBarCollapsed] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [isSaveViewDialogOpen, setIsSaveViewDialogOpen] = useState(false)
  const [isEditingViewDialogOpen, setIsEditingViewDialogOpen] = useState(false)
  const [graphViewDraft, setGraphViewDraft] = useState<GraphViewDraft>(DEFAULT_GRAPH_VIEW_DRAFT)
  const [isCreateMyWorkDialogOpen, setIsCreateMyWorkDialogOpen] = useState(false)
  const [myWorkDraft, setMyWorkDraft] = useState<MyWorkDraft>(DEFAULT_MY_WORK_DRAFT)
  const [workingLayoutPositions, setWorkingLayoutPositions] = useState<Record<string, { x: number; y: number }>>({})
  const dragConnectionSourceIdRef = useRef<string | null>(null)
  const dragConnectionHandleIdRef = useRef<string | null>(null)
  const dragConnectionCompletedRef = useRef(false)

  useEffect(() => {
    setGraphPreferences(readStoredGraphPreferences())
  }, [])

  useEffect(() => {
    if (typeof document === 'undefined') return

    const root = document.documentElement
    const updateTheme = () => setIsDarkMode(root.classList.contains('dark'))
    updateTheme()

    const observer = new MutationObserver(updateTheme)
    observer.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
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
      confidenceThreshold: 0,
      focusMode: activeGraphView.neighborhoodDepth !== 'full',
      hideOrphans: activeGraphView.hideOrphans,
      neighborhoodDepth: activeGraphView.neighborhoodDepth,
      relationFilter: 'all',
      scopeMode: 'mapped',
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
        relationFilter: 'all',
        confidenceThreshold: 0,
        selectedDocumentId,
        neighborhoodDepth: graphPreferences.neighborhoodDepth,
        focusMode: graphPreferences.neighborhoodDepth !== 'full',
        scopeMode: 'mapped',
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
  const isSelectionPanelOpen = Boolean(selectedDocument || selectedRelation)

  const clearSelection = () => {
    setSelectedDocumentId(null)
    setSelectedRelationId(null)
    setContextMenu(null)
    setActiveDocument(null)
  }

  const searchResults = useMemo(
    () =>
      libraryDocuments.filter((document) =>
        deferredSearchQuery.trim().length > 0
        && document.title.toLowerCase().includes(deferredSearchQuery.trim().toLowerCase()),
      ),
    [deferredSearchQuery, libraryDocuments],
  )

  const selectedDocumentIncomingDocuments = useMemo(
    () =>
      selectedDocument
        ? libraryRelations
          .filter((relation) => relation.targetDocumentId === selectedDocument.id)
          .map((relation) => libraryDocuments.find((document) => document.id === relation.sourceDocumentId) ?? null)
          .filter((document, index, documents): document is NonNullable<typeof document> => (
            Boolean(document) && documents.findIndex((candidate) => candidate?.id === document?.id) === index
          ))
        : [],
    [libraryDocuments, libraryRelations, selectedDocument],
  )
  const selectedDocumentOutgoingDocuments = useMemo(
    () =>
      selectedDocument
        ? libraryRelations
          .filter((relation) => relation.sourceDocumentId === selectedDocument.id)
          .map((relation) => libraryDocuments.find((document) => document.id === relation.targetDocumentId) ?? null)
          .filter((document, index, documents): document is NonNullable<typeof document> => (
            Boolean(document) && documents.findIndex((candidate) => candidate?.id === document?.id) === index
          ))
        : [],
    [libraryDocuments, libraryRelations, selectedDocument],
  )
  const selectedDocumentIncomingIds = useMemo(
    () => new Set(selectedDocumentIncomingDocuments.map((document) => document.id)),
    [selectedDocumentIncomingDocuments],
  )
  const selectedDocumentOutgoingIds = useMemo(
    () => new Set(selectedDocumentOutgoingDocuments.map((document) => document.id)),
    [selectedDocumentOutgoingDocuments],
  )
  const clearPendingConnection = () => {
    setPendingConnectionDocumentId(null)
    setPendingConnectionDirection(null)
    setPendingConnectionCursor(null)
    setIsAddDocumentPopoverOpen(false)
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
    if (!pendingConnectionDirection) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      clearPendingConnection()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [pendingConnectionDirection])

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
          connectionDirection: selectedDocumentOutgoingIds.has(document.id)
            ? 'outgoing'
            : selectedDocumentIncomingIds.has(document.id)
              ? 'incoming'
              : null,
          isCurrentDocument: activeDocumentId === document.id,
          isConnectedToSelectedDocument:
            selectedDocumentId != null
            && (selectedDocumentIncomingIds.has(document.id) || selectedDocumentOutgoingIds.has(document.id)),
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
            setSearchQuery('')
            setIsAddDocumentPopoverOpen(true)
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
    selectedDocumentIncomingIds,
    selectedDocumentOutgoingIds,
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
    const targetDocument = libraryDocuments.find((document) => document.id === targetDocumentId)
    if (targetDocument?.documentType === 'my_work') {
      clearPendingConnection()
      return
    }

    const created = await createRelation({
      sourceDocumentId,
      targetDocumentId,
      linkType: 'citation',
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
    const targetDocument = libraryDocuments.find((document) => document.id === relationTargetDocumentId)
    if (targetDocument?.documentType === 'my_work') {
      clearPendingConnection()
      return
    }

    const created = await createRelation({
      sourceDocumentId: relationSourceDocumentId,
      targetDocumentId: relationTargetDocumentId,
      linkType: 'citation',
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
    const targetDocument = libraryDocuments.find((document) => document.id === targetDocumentId)
    if (targetDocument?.documentType === 'my_work') {
      clearPendingConnection()
      return
    }

    const created = await createRelation({
      sourceDocumentId,
      targetDocumentId,
      linkType: 'citation',
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

    if (pendingConnectionDocumentId && pendingConnectionDirection && pendingConnectionDocumentId !== documentId) {
      const sourceDocumentId =
        pendingConnectionDirection === 'outbound' ? pendingConnectionDocumentId : documentId
      const targetDocumentId =
        pendingConnectionDirection === 'outbound' ? documentId : pendingConnectionDocumentId
      const targetDocument = libraryDocuments.find((document) => document.id === targetDocumentId)
      if (targetDocument?.documentType === 'my_work') {
        clearPendingConnection()
        return
      }

      const created = await createRelation({
        sourceDocumentId,
        targetDocumentId,
        linkType: 'citation',
        linkOrigin: 'user',
      })

      if (created) {
        setSelectedDocumentId(null)
        setSelectedRelationId(created.id)
      }
      clearPendingConnection()
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

  const handleCreateMyWork = async () => {
    if (!activeLibrary || !myWorkDraft.title.trim()) return

    const created = await createDocumentRecord({
      libraryId: activeLibrary.id,
      title: myWorkDraft.title.trim(),
      documentType: 'my_work',
      authors: [],
    })

    if (!created) return

    await handleAddDocumentToMap(created.id)
    setMyWorkDraft(DEFAULT_MY_WORK_DRAFT)
    setIsCreateMyWorkDialogOpen(false)
  }

  const currentViewDocumentIds = useMemo(
    () => Array.from(new Set(visibleDocuments.map((document) => document.id))),
    [visibleDocuments],
  )

  const persistActiveViewSnapshot = async (nextGraphView?: GraphView | null) => {
    const targetView = nextGraphView ?? activeGraphView
    if (!targetView) return

    await updateGraphView(targetView.id, {
      relationFilter: 'all',
      colorMode: graphPreferences.colorMode,
      sizeMode: graphPreferences.sizeMode,
      scopeMode: 'mapped',
      neighborhoodDepth: graphPreferences.neighborhoodDepth,
      focusMode: graphPreferences.neighborhoodDepth !== 'full',
      hideOrphans: graphPreferences.hideOrphans,
      confidenceThreshold: 0,
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
      relationFilter: 'all',
      colorMode: graphPreferences.colorMode,
      sizeMode: graphPreferences.sizeMode,
      scopeMode: 'mapped',
      neighborhoodDepth: graphPreferences.neighborhoodDepth,
      focusMode: graphPreferences.neighborhoodDepth !== 'full',
      hideOrphans: graphPreferences.hideOrphans,
      confidenceThreshold: 0,
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
      relationFilter: 'all',
      colorMode: graphPreferences.colorMode,
      sizeMode: graphPreferences.sizeMode,
      scopeMode: 'mapped',
      neighborhoodDepth: graphPreferences.neighborhoodDepth,
      focusMode: graphPreferences.neighborhoodDepth !== 'full',
      hideOrphans: graphPreferences.hideOrphans,
      confidenceThreshold: 0,
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
      <div className="shrink-0 border-b border-border/80 bg-background/92 px-6 py-3 backdrop-blur">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight">{t('mapsPage.title')}</h1>
              <p className="text-sm text-muted-foreground">
                {activeLibrary ? `${activeLibrary.name} - ` : ''}
                {t('mapsPage.subtitle')}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsTopBarCollapsed((current) => !current)}
              >
                {isTopBarCollapsed ? (
                  <>
                    <ChevronDown className="mr-2 h-4 w-4" />
                    {t('mapsPage.showControls')}
                  </>
                ) : (
                  <>
                    <ChevronUp className="mr-2 h-4 w-4" />
                    {t('mapsPage.hideControls')}
                  </>
                )}
              </Button>
              {activeGraphView ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="outline" onClick={() => void persistActiveViewSnapshot()}>
                      <Save className="mr-2 h-4 w-4" />
                      {t('mapsPage.saveCurrentView')}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={8}>
                    {t('mapsPage.saveCurrentViewHelp')}
                  </TooltipContent>
                </Tooltip>
              ) : null}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" onClick={handleOpenSaveViewDialog}>
                    <Save className="mr-2 h-4 w-4" />
                    {activeGraphView ? t('mapsPage.saveAsNewView') : t('mapsPage.saveView')}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={8}>
                  {t('mapsPage.saveNewViewHelp')}
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleReheatLayout}
                    disabled={isReheatingLayout || visibleDocuments.length === 0}
                  >
                    <Waypoints className={cn('mr-2 h-4 w-4', isReheatingLayout && 'animate-pulse')} />
                    {t('mapsPage.rebuildLayout')}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={8}>
                  {t('mapsPage.rebuildLayoutHelp')}
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          {!isTopBarCollapsed ? (
          <div className="grid gap-2 xl:grid-cols-[minmax(0,0.72fr)_minmax(360px,520px)_minmax(0,0.95fr)]">
            <Card className="border-border/70 bg-card/92 p-3 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {t('mapsPage.workspace')}
                  </p>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="min-w-[220px] flex-1">
                        <Select
                          value={activeGraphViewId ?? '__working__'}
                          onValueChange={(value) => setActiveGraphViewId(value === '__working__' ? null : value)}
                        >
                          <SelectTrigger className="bg-background/90">
                            <SelectValue placeholder={t('mapsPage.workingMap')} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__working__">{t('mapsPage.workingMap')}</SelectItem>
                            {activeLibraryGraphViews.map((view) => (
                              <SelectItem key={view.id} value={view.id}>
                                {view.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={8}>
                      {activeGraphView?.description?.trim() || t('mapsPage.workingMapDescription')}
                    </TooltipContent>
                  </Tooltip>
                </div>
                {activeGraphView ? (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={handleOpenEditViewDialog}>
                      {t('mapsPage.renameView')}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void handleDuplicateGraphView()}>
                      <Plus className="mr-2 h-4 w-4" />
                      {t('mapsPage.duplicateView')}
                    </Button>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="sm" variant="outline" onClick={() => void handleResetCurrentViewPositions()}>
                          <Pin className="mr-2 h-4 w-4" />
                          {t('mapsPage.resetLayout')}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top" sideOffset={8}>
                        {t('mapsPage.resetLayoutHelp')}
                      </TooltipContent>
                    </Tooltip>
                    <Button size="sm" variant="outline" onClick={() => void handleDeleteActiveGraphView()}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      {t('mapsPage.delete')}
                    </Button>
                  </div>
                ) : null}
              </div>
            </Card>

            <Card className="border-border/70 bg-card/92 p-3 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {t('mapsPage.canvasEditor')}
                  </p>
                </div>
                <div className="flex min-w-0 flex-wrap gap-2 sm:flex-nowrap">
                  <Popover open={isAddDocumentPopoverOpen} onOpenChange={setIsAddDocumentPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={isAddDocumentPopoverOpen}
                        className="min-w-0 flex-1 justify-between bg-white/90"
                      >
                        {pendingConnectionDirection
                          ? pendingConnectionDirection === 'outbound'
                            ? t('mapsPage.findReferencedDocument')
                            : t('mapsPage.findCitingDocument')
                          : t('mapsPage.addDocumentToMap')}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[320px] p-0" align="start">
                      <Command>
                        <CommandInput
                          placeholder={pendingConnectionDirection ? t('mapsPage.searchAndLinkPlaceholder') : t('mapsPage.searchDocumentsPlaceholder')}
                        />
                        <CommandList>
                          <CommandEmpty>{t('mapsPage.noMatchingDocument')}</CommandEmpty>
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
                                    {document.authors.slice(0, 2).join(', ') || t('searchPage.unknownAuthor')}
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
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="shrink-0 whitespace-nowrap px-3"
                    onClick={() => {
                      setMyWorkDraft(DEFAULT_MY_WORK_DRAFT)
                      setIsCreateMyWorkDialogOpen(true)
                    }}
                  >
                    {t('mapsPage.addMyWork')}
                  </Button>
                </div>
              </div>
            </Card>

            <DocumentGraphControls
              colorMode={graphPreferences.colorMode}
              onColorModeChange={(value) => setGraphPreferences((current) => ({ ...current, colorMode: value }))}
              sizeMode={graphPreferences.sizeMode}
              onSizeModeChange={(value) => setGraphPreferences((current) => ({ ...current, sizeMode: value }))}
              neighborhoodDepth={graphPreferences.neighborhoodDepth}
              onNeighborhoodDepthChange={(value) => setGraphPreferences((current) => ({
                ...current,
                neighborhoodDepth: value,
                focusMode: value !== 'full',
              }))}
              hideOrphans={graphPreferences.hideOrphans}
              onHideOrphansChange={(value) => setGraphPreferences((current) => ({ ...current, hideOrphans: value }))}
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
              searchResults={searchResults}
              onJumpToDocument={handleJumpToDocument}
            />
          </div>
          ) : null}
        </div>
      </div>

      <div
        className="relative min-h-0 flex-1 overflow-hidden"
        onMouseMove={(event) => {
          if (!pendingConnectionDirection) return
          const bounds = event.currentTarget.getBoundingClientRect()
          setPendingConnectionCursor({
            x: event.clientX - bounds.left,
            y: event.clientY - bounds.top,
          })
        }}
        onMouseLeave={() => {
          if (!pendingConnectionDirection) return
          setPendingConnectionCursor(null)
        }}
      >
        <div className="relative h-full min-h-0 overflow-hidden bg-muted/55 dark:bg-[#141821]">
          {visibleDocuments.length === 0 ? (
            <div className="pointer-events-none absolute left-6 top-6 z-10 max-w-sm">
              <Card className="border-dashed bg-card/92 p-4 shadow-sm">
                <p className="text-sm text-muted-foreground">
                  {t('mapsPage.noDocumentsControls')}
                </p>
              </Card>
            </div>
          ) : visibleRelations.length === 0 ? (
            <div className="pointer-events-none absolute left-6 top-6 z-10 max-w-sm">
              <Card className="border-dashed bg-card/92 p-4 shadow-sm">
                <p className="text-sm text-muted-foreground">
                  {t('mapsPage.noLinksControls')}
                </p>
              </Card>
            </div>
          ) : null}

          {pendingConnectionDirection && pendingConnectionCursor ? (
            <div
              className={cn(
                'pointer-events-none absolute z-20 w-[250px] -translate-x-1/2 -translate-y-full rounded-full border px-3 py-2 text-center text-xs font-medium shadow-sm',
                pendingConnectionDirection === 'outbound'
                  ? 'border-sky-300 bg-sky-50/95 text-sky-800'
                  : 'border-rose-300 bg-rose-50/95 text-rose-800',
              )}
              style={{
                left: Math.max(pendingConnectionCursor.x, 140),
                top: Math.max(pendingConnectionCursor.y - 16, 24),
              }}
            >
              {pendingConnectionDirection === 'outbound'
                ? t('mapsPage.selectReferenceTarget')
                : t('mapsPage.selectCitationTarget')}
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
              setActiveDocument(null)
            }}
            onEdgeContextMenu={(event, edge) => {
              event.preventDefault()
              setSelectedDocumentId(null)
              clearPendingConnection()
              setSelectedRelationId(edge.id)
              setActiveDocument(null)
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
              clearSelection()
              clearPendingConnection()
            }}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            connectionRadius={72}
            className="h-full bg-transparent"
            proOptions={{ hideAttribution: true }}
          >
            <MiniMap
              pannable
              zoomable
              nodeStrokeColor={(node) => node.data?.borderColor ?? '#cbd5e1'}
              nodeColor={(node) => node.data?.fillColor ?? '#ffffff'}
              maskColor={isDarkMode ? 'rgba(20,24,33,0.78)' : 'rgba(241,245,249,0.72)'}
            />
            <Controls />
            <Background
              variant={BackgroundVariant.Dots}
              gap={20}
              size={1}
              color={isDarkMode ? '#334155' : '#cbd5e1'}
            />
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
                    {t('mapsPage.deleteNode')}
                  </button>
                  <button
                    type="button"
                    className="w-full rounded-sm px-3 py-2 text-left text-sm hover:bg-slate-100"
                    onClick={() => {
                      void handleDeleteAllLinksForDocument(contextMenu.documentId)
                      setContextMenu(null)
                    }}
                  >
                    {t('mapsPage.deleteAllLinks')}
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
                    {t('mapsPage.removeLinkMenu')}
                  </button>
                  <button
                    type="button"
                    className="w-full rounded-sm px-3 py-2 text-left text-sm hover:bg-slate-100"
                    onClick={() => {
                      void handleInvertRelation(contextMenu.relationId)
                      setContextMenu(null)
                    }}
                  >
                    {t('mapsPage.invertLinkMenu')}
                  </button>
                </>
              )}
            </div>
          ) : null}
        </div>

        {isSelectionPanelOpen ? (
          <div className="pointer-events-none absolute inset-y-4 right-4 z-30 flex w-full max-w-[430px] justify-end">
            <aside className="pointer-events-auto h-full w-full overflow-hidden rounded-[28px] border border-border/80 bg-background/96 shadow-[0_24px_60px_rgba(15,23,42,0.18)] backdrop-blur">
              <DocumentGraphPanel
                selectedDocument={selectedDocument}
                selectedRelation={selectedRelation}
                sourceDocument={sourceDocument}
                targetDocument={targetDocument}
                relatedIncomingDocuments={selectedDocumentIncomingDocuments}
                relatedOutgoingDocuments={selectedDocumentOutgoingDocuments}
                onDeleteRelation={handleDeleteRelation}
                onInvertRelation={handleInvertRelation}
                isDeletingRelation={isDeletingRelation}
                onCloseSelection={clearSelection}
              />
            </aside>
          </div>
        ) : null}
      </div>

      <Dialog open={isSaveViewDialogOpen} onOpenChange={setIsSaveViewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('mapsPage.saveGraphView')}</DialogTitle>
            <DialogDescription>
              {t('mapsPage.saveGraphViewDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="graph-view-name">{t('mapsPage.name')}</Label>
              <Input
                id="graph-view-name"
                value={graphViewDraft.name}
                onChange={(event) => setGraphViewDraft((current) => ({ ...current, name: event.target.value }))}
                placeholder={t('mapsPage.saveGraphView')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="graph-view-description">{t('mapsPage.workspaceNote')}</Label>
              <Textarea
                id="graph-view-description"
                value={graphViewDraft.description}
                onChange={(event) => setGraphViewDraft((current) => ({ ...current, description: event.target.value }))}
                placeholder={t('mapsPage.workspaceNotePlaceholder')}
                className="min-h-24"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSaveViewDialogOpen(false)}>
              {t('mapsPage.cancel')}
            </Button>
            <Button onClick={() => void handleSaveCurrentView()}>
              {t('mapsPage.saveView')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditingViewDialogOpen} onOpenChange={setIsEditingViewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('mapsPage.editGraphView')}</DialogTitle>
            <DialogDescription>
              {t('mapsPage.editGraphViewDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-graph-view-name">{t('mapsPage.name')}</Label>
              <Input
                id="edit-graph-view-name"
                value={graphViewDraft.name}
                onChange={(event) => setGraphViewDraft((current) => ({ ...current, name: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-graph-view-description">{t('mapsPage.workspaceNote')}</Label>
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
              {t('mapsPage.cancel')}
            </Button>
            <Button onClick={() => void handleUpdateGraphViewMeta()}>
              {t('mapsPage.saveChanges')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isCreateMyWorkDialogOpen}
        onOpenChange={(open) => {
          setIsCreateMyWorkDialogOpen(open)
          if (!open) {
            setMyWorkDraft(DEFAULT_MY_WORK_DRAFT)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('mapsPage.addMyWork')}</DialogTitle>
            <DialogDescription>
              {t('mapsPage.addMyWorkDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="my-work-title">{t('mapsPage.workName')}</Label>
            <Input
              id="my-work-title"
              value={myWorkDraft.title}
              onChange={(event) => setMyWorkDraft({ title: event.target.value })}
              placeholder={t('mapsPage.workNamePlaceholder')}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateMyWorkDialogOpen(false)}>
              {t('mapsPage.cancel')}
            </Button>
            <Button onClick={() => void handleCreateMyWork()} disabled={!myWorkDraft.title.trim()}>
              {t('mapsPage.addToMap')}
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
