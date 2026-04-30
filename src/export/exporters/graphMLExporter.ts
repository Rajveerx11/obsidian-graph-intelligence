import type { NoteNode } from '../../core/types';
import type { ConfidenceEdge } from '../../graph/edgeConfidence';

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function exportToGraphML(
  nodes: NoteNode[],
  edges: ConfidenceEdge[]
): string {
  const nodeType = (id: string): string => {
    if (id.startsWith('youtube:')) return 'youtube';
    if (id.endsWith('.pdf')) return 'pdf';
    const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
    if (imageExts.some(ext => id.toLowerCase().endsWith(ext))) return 'image';
    return 'markdown';
  };

  const nodesXml = nodes.map(node => {
    const type = nodeType(node.id);
    const tags = node.tags.join(',');
    
    return `    <node id="${escapeXml(node.id)}">
      <data key="d0">${escapeXml(node.title)}</data>
      <data key="d1">${type}</data>
      <data key="d2">${tags}</data>
      <data key="d3">${node.tags.length}</data>
    </node>`;
  }).join('\n');

  const edgesXml = edges.map((edge, idx) => {
    return `    <edge id="e${idx}" source="${escapeXml(edge.source)}" target="${escapeXml(edge.target)}">
      <data key="d4">${edge.type}</data>
      <data key="d5">${edge.confidence.toFixed(3)}</data>
      <data key="d6">${escapeXml(edge.method)}</data>
    </edge>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<graphml xmlns="http://graphml.graphdrawing.org/xmlns"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://graphml.graphdrawing.org/xmlns
  http://graphml.graphdrawing.org/xmlns/1.0/graphml.xsd">
  
  <key id="d0" for="node" attr.name="title" attr.type="string"/>
  <key id="d1" for="node" attr.name="type" attr.type="string"/>
  <key id="d2" for="node" attr.name="tags" attr.type="string"/>
  <key id="d3" for="node" attr.name="tagCount" attr.type="int"/>
  <key id="d4" for="edge" attr.name="type" attr.type="string"/>
  <key id="d5" for="edge" attr.name="confidence" attr.type="double"/>
  <key id="d6" for="edge" attr.name="method" attr.type="string"/>
  
  <graph id="G" edgedefault="directed">
${nodesXml}
${edgesXml}
  </graph>
</graphml>`;
}
