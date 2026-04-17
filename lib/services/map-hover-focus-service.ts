'use client'

export type HoverFocusResult = {
  dimmedNodeIds: Set<string>
  dimmedEdgeIds: Set<string>
  emphasizedNodeIds: Set<string>
  emphasizedEdgeIds: Set<string>
}

export function computeHoverFocus(
  hoveredNodeId: string | null,
  nodes: { id: string }[],
  edges: { id: string; source: string; target: string }[],
): HoverFocusResult {
  const dimmedNodeIds = new Set<string>()
  const dimmedEdgeIds = new Set<string>()
  const emphasizedNodeIds = new Set<string>()
  const emphasizedEdgeIds = new Set<string>()

  if (!hoveredNodeId) {
    return { dimmedNodeIds, dimmedEdgeIds, emphasizedNodeIds, emphasizedEdgeIds }
  }

  const connectedNodeIds = new Set<string>([hoveredNodeId, nodes[0]?.id].filter(Boolean) as string[])

  for (const edge of edges) {
    if (edge.source === hoveredNodeId || edge.target === hoveredNodeId) {
      emphasizedEdgeIds.add(edge.id)
      emphasizedNodeIds.add(edge.source)
      emphasizedNodeIds.add(edge.target)
      connectedNodeIds.add(edge.source)
      connectedNodeIds.add(edge.target)
    } else {
      dimmedEdgeIds.add(edge.id)
    }
  }

  emphasizedNodeIds.add(hoveredNodeId)
  if (nodes[0]?.id) {
    emphasizedNodeIds.add(nodes[0].id)
  }

  for (const node of nodes) {
    if (!connectedNodeIds.has(node.id)) {
      dimmedNodeIds.add(node.id)
    }
  }

  return { dimmedNodeIds, dimmedEdgeIds, emphasizedNodeIds, emphasizedEdgeIds }
}
