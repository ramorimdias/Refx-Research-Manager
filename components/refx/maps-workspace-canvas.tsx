'use client'

import type { MouseEventHandler } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node,
  type OnConnect,
  type OnConnectEnd,
  type OnConnectStart,
  type OnEdgesChange,
  type OnNodesChange,
  type NodeDragHandler,
  type NodeMouseHandler,
} from 'reactflow'
import { Card } from '@/components/ui/card'
import { DocumentGraphPanel } from '@/components/refx/document-graph-panel'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/localization'
import type { Document, DocumentRelation } from '@/lib/types'
import type * as repo from '@/lib/repositories/local-db'
import type { AnyGraphNodeData } from '@/components/refx/map-flow-types'
import { MAP_EDGE_TYPES as FLOW_EDGE_TYPES, MAP_NODE_TYPES as FLOW_NODE_TYPES } from '@/components/refx/map-flow-types'

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

type MapsWorkspaceCanvasProps = {
  visibleDocumentsCount: number
  edgesCount: number
  pendingConnectionDirection: 'outbound' | 'inbound' | null
  pendingConnectionCursor: { x: number; y: number } | null
  onWorkspaceMouseMove: MouseEventHandler<HTMLDivElement>
  onWorkspaceMouseLeave: MouseEventHandler<HTMLDivElement>
  nodes: Node<AnyGraphNodeData>[]
  edges: Edge[]
  onNodesChange: OnNodesChange
  onNodeDragStart: NodeDragHandler
  onNodeDragStop: NodeDragHandler
  onEdgesChange: OnEdgesChange
  onConnectStart: OnConnectStart
  onConnect: OnConnect
  onConnectEnd: OnConnectEnd
  onNodeClick: NodeMouseHandler
  onNodeContextMenu: NodeMouseHandler
  onNodeMouseEnter: NodeMouseHandler
  onNodeMouseLeave: NodeMouseHandler
  onEdgeClick: (event: React.MouseEvent, edge: Edge) => void
  onEdgeContextMenu: (event: React.MouseEvent, edge: Edge) => void
  onEdgeMouseEnter: (event: React.MouseEvent, edge: Edge) => void
  onEdgeMouseLeave: () => void
  onPaneClick: () => void
  isDarkMode: boolean
  contextMenu: GraphContextMenuState
  onCloseContextMenu: () => void
  onRemoveDocumentFromCurrentView: (documentId: string) => void
  onRequestDeleteAllLinks: (documentId: string) => void
  onDeleteRelationWithoutPrompt: (relationId: string) => void
  onInvertRelation: (relationId: string) => void
  isSelectionPanelOpen: boolean
  selectedDocument: Document | null
  selectedWorkReference: repo.DbWorkReference | null
  selectedRelation: DocumentRelation | null
  sourceDocument: Document | null
  targetDocument: Document | null
  relatedIncomingDocuments: Document[]
  relatedOutgoingDocuments: Document[]
  relatedOutgoingReferences: repo.DbWorkReference[]
  otherIncomingDocuments: Document[]
  otherOutgoingDocuments: Document[]
  onDeleteRelation: (relationId: string) => void
  isDeletingRelation: boolean
  onCloseSelection: () => void
  onAddLinkedDocumentToMap: (documentId: string) => void
  onHideLinkedDocumentFromMap: (documentId: string) => void
}

export function MapsWorkspaceCanvas({
  visibleDocumentsCount,
  edgesCount,
  pendingConnectionDirection,
  pendingConnectionCursor,
  onWorkspaceMouseMove,
  onWorkspaceMouseLeave,
  nodes,
  edges,
  onNodesChange,
  onNodeDragStart,
  onNodeDragStop,
  onEdgesChange,
  onConnectStart,
  onConnect,
  onConnectEnd,
  onNodeClick,
  onNodeContextMenu,
  onNodeMouseEnter,
  onNodeMouseLeave,
  onEdgeClick,
  onEdgeContextMenu,
  onEdgeMouseEnter,
  onEdgeMouseLeave,
  onPaneClick,
  isDarkMode,
  contextMenu,
  onCloseContextMenu,
  onRemoveDocumentFromCurrentView,
  onRequestDeleteAllLinks,
  onDeleteRelationWithoutPrompt,
  onInvertRelation,
  isSelectionPanelOpen,
  selectedDocument,
  selectedWorkReference,
  selectedRelation,
  sourceDocument,
  targetDocument,
  relatedIncomingDocuments,
  relatedOutgoingDocuments,
  relatedOutgoingReferences,
  otherIncomingDocuments,
  otherOutgoingDocuments,
  onDeleteRelation,
  isDeletingRelation,
  onCloseSelection,
  onAddLinkedDocumentToMap,
  onHideLinkedDocumentFromMap,
}: MapsWorkspaceCanvasProps) {
  const t = useT()

  return (
    <div
      className="relative min-h-0 flex-1 overflow-hidden"
      onMouseMove={onWorkspaceMouseMove}
      onMouseLeave={onWorkspaceMouseLeave}
    >
      <div className="relative h-full min-h-0 overflow-hidden bg-muted/55 dark:bg-[#141821]">
        {visibleDocumentsCount === 0 ? (
          <div className="pointer-events-none absolute left-6 top-6 z-10 max-w-sm">
            <Card className="border-dashed bg-card/92 p-4 shadow-sm backdrop-blur">
              <p className="text-sm text-muted-foreground">
                {t('mapsPage.noDocumentsControls')}
              </p>
            </Card>
          </div>
        ) : edgesCount === 0 ? (
          <div className="pointer-events-none absolute left-6 top-6 z-10 max-w-sm">
            <Card className="border-dashed bg-card/92 p-4 shadow-sm backdrop-blur">
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

        <div data-tour-id="maps-canvas" className="h-full min-h-0 w-full">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onNodeDragStart={onNodeDragStart}
            onNodeDragStop={onNodeDragStop}
            onEdgesChange={onEdgesChange}
            onConnectStart={onConnectStart}
            onConnect={onConnect}
            onConnectEnd={onConnectEnd}
            onNodeClick={onNodeClick}
            onNodeContextMenu={onNodeContextMenu}
            onNodeMouseEnter={onNodeMouseEnter}
            onNodeMouseLeave={onNodeMouseLeave}
            onEdgeClick={onEdgeClick}
            onEdgeContextMenu={onEdgeContextMenu}
            onEdgeMouseEnter={onEdgeMouseEnter}
            onEdgeMouseLeave={onEdgeMouseLeave}
            onPaneClick={onPaneClick}
            nodeTypes={FLOW_NODE_TYPES}
            edgeTypes={FLOW_EDGE_TYPES}
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
        </div>

        {contextMenu ? (
          <div
            className="fixed z-[1000] min-w-[180px] rounded-md border bg-popover p-1 text-popover-foreground shadow-lg"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            {contextMenu.kind === 'node' ? (
              <>
                <button
                  type="button"
                  className="w-full rounded-sm px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                  onClick={() => {
                    onRemoveDocumentFromCurrentView(contextMenu.documentId)
                    onCloseContextMenu()
                  }}
                >
                  {t('mapsPage.deleteNode')}
                </button>
                <button
                  type="button"
                  className="w-full rounded-sm px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                  onClick={() => {
                    onRequestDeleteAllLinks(contextMenu.documentId)
                    onCloseContextMenu()
                  }}
                >
                  {t('mapsPage.deleteAllLinks')}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="w-full rounded-sm px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                  onClick={() => {
                    onDeleteRelationWithoutPrompt(contextMenu.relationId)
                    onCloseContextMenu()
                  }}
                >
                  {t('mapsPage.removeLinkMenu')}
                </button>
                <button
                  type="button"
                  className="w-full rounded-sm px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                  onClick={() => {
                    onInvertRelation(contextMenu.relationId)
                    onCloseContextMenu()
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
        <div className="pointer-events-none absolute inset-y-4 right-4 z-30 flex w-full max-w-[540px] justify-end">
          <aside className="pointer-events-auto h-full w-full overflow-hidden rounded-[28px] border border-border/80 bg-background/96 shadow-[0_24px_60px_rgba(15,23,42,0.18)] backdrop-blur">
            <DocumentGraphPanel
              selectedDocument={selectedDocument}
              selectedWorkReference={selectedWorkReference}
              selectedRelation={selectedRelation}
              sourceDocument={sourceDocument}
              targetDocument={targetDocument}
              relatedIncomingDocuments={relatedIncomingDocuments}
              relatedOutgoingDocuments={relatedOutgoingDocuments}
              relatedOutgoingReferences={relatedOutgoingReferences}
              otherIncomingDocuments={otherIncomingDocuments}
              otherOutgoingDocuments={otherOutgoingDocuments}
              onDeleteRelation={onDeleteRelation}
              onInvertRelation={onInvertRelation}
              onAddLinkedDocumentToMap={onAddLinkedDocumentToMap}
              onHideLinkedDocumentFromMap={onHideLinkedDocumentFromMap}
              isDeletingRelation={isDeletingRelation}
              onCloseSelection={onCloseSelection}
            />
          </aside>
        </div>
      ) : null}
    </div>
  )
}
