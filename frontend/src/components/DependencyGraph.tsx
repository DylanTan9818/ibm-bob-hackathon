import { useCallback, useMemo } from 'react'
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
  Position,
} from 'reactflow'
import 'reactflow/dist/style.css'

interface DependencyData {
  file: string
  depends_on: string[]
  depended_by: string[]
  risk_level: 'high' | 'medium' | 'low'
}

interface DependencyGraphProps {
  dependencies: DependencyData[]
  changedFiles: string[]
}

const DependencyGraph = ({ dependencies, changedFiles }: DependencyGraphProps) => {
  // Create nodes from dependency data
  const initialNodes: Node[] = useMemo(() => {
    const nodeMap = new Map<string, Node>()
    const allFiles = new Set<string>()

    // Collect all unique files
    dependencies.forEach((dep) => {
      allFiles.add(dep.file)
      dep.depends_on.forEach((f) => allFiles.add(f))
      dep.depended_by.forEach((f) => allFiles.add(f))
    })

    // Create nodes with positioning
    const filesArray = Array.from(allFiles)
    const columns = Math.ceil(Math.sqrt(filesArray.length))
    
    filesArray.forEach((file, index) => {
      const isChanged = changedFiles.includes(file)
      const dep = dependencies.find((d) => d.file === file)
      const riskLevel = dep?.risk_level || 'low'

      // Determine node color based on status
      let bgColor = '#374151' // gray-700 (default)
      let borderColor = '#4b5563' // gray-600
      
      if (isChanged) {
        bgColor = '#dc2626' // red-600 (changed file)
        borderColor = '#991b1b' // red-800
      } else if (dep?.depended_by.length) {
        if (riskLevel === 'high') {
          bgColor = '#ea580c' // orange-600 (high risk)
          borderColor = '#c2410c' // orange-700
        } else if (riskLevel === 'medium') {
          bgColor = '#eab308' // yellow-500 (medium risk)
          borderColor = '#ca8a04' // yellow-600
        } else {
          bgColor = '#16a34a' // green-600 (low risk)
          borderColor = '#15803d' // green-700
        }
      }

      const row = Math.floor(index / columns)
      const col = index % columns

      nodeMap.set(file, {
        id: file,
        type: 'default',
        data: {
          label: (
            <div className="text-xs">
              <div className="font-semibold truncate max-w-[150px]" title={file}>
                {file.split('/').pop()}
              </div>
              <div className="text-[10px] text-gray-400 mt-1">
                {dep && (
                  <>
                    <div>↓ {dep.depends_on.length} deps</div>
                    <div>↑ {dep.depended_by.length} used by</div>
                  </>
                )}
              </div>
            </div>
          ),
        },
        position: { x: col * 250, y: row * 150 },
        style: {
          background: bgColor,
          border: `2px solid ${borderColor}`,
          borderRadius: '8px',
          padding: '10px',
          color: '#fff',
          width: 180,
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      })
    })

    return Array.from(nodeMap.values())
  }, [dependencies, changedFiles])

  // Create edges from dependency relationships
  const initialEdges: Edge[] = useMemo(() => {
    const edges: Edge[] = []

    dependencies.forEach((dep) => {
      // Create edges for dependencies (this file depends on others)
      dep.depends_on.forEach((targetFile) => {
        edges.push({
          id: `${dep.file}-${targetFile}`,
          source: dep.file,
          target: targetFile,
          type: 'smoothstep',
          animated: changedFiles.includes(dep.file),
          style: { stroke: '#60a5fa', strokeWidth: 2 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#60a5fa',
          },
        })
      })
    })

    return edges
  }, [dependencies, changedFiles])

  const [nodes, , onNodesChange] = useNodesState(initialNodes)
  const [edges, , onEdgesChange] = useEdgesState(initialEdges)

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    const dep = dependencies.find((d) => d.file === node.id)
    if (dep) {
      console.log('Node clicked:', {
        file: dep.file,
        depends_on: dep.depends_on,
        depended_by: dep.depended_by,
        risk_level: dep.risk_level,
      })
    }
  }, [dependencies])

  if (dependencies.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-800 rounded-lg">
        <p className="text-gray-400">No dependency data available</p>
      </div>
    )
  }

  return (
    <div className="h-[600px] bg-gray-900 rounded-lg border border-gray-700">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        fitView
        attributionPosition="bottom-left"
      >
        <Background color="#374151" gap={16} />
        <Controls className="bg-gray-800 border-gray-700" />
      </ReactFlow>
      
      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-gray-800 border border-gray-700 rounded-lg p-3 text-xs">
        <div className="font-semibold mb-2 text-white">Legend</div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-600 border-2 border-red-800 rounded"></div>
            <span className="text-gray-300">Changed in PR</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-orange-600 border-2 border-orange-700 rounded"></div>
            <span className="text-gray-300">High Risk</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-500 border-2 border-yellow-600 rounded"></div>
            <span className="text-gray-300">Medium Risk</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-600 border-2 border-green-700 rounded"></div>
            <span className="text-gray-300">Low Risk</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-700 border-2 border-gray-600 rounded"></div>
            <span className="text-gray-300">Unaffected</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DependencyGraph

// Made with Bob
