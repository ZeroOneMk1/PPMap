import React, { useEffect, useRef, useState } from 'react';
import "../../common.css";
import "./RelationshipGraph.css";

// Edge colour encodes the romantic/sexual flag combination so the user
// can analyse behaviour without any node identity being revealed.
function edgeColour(romantic, sexual) {
    if (romantic && sexual) return "#340c46";
    if (romantic) return "#009fe3";
    if (sexual) return "#e50051";
    return "#888";
}

const VIEW = 1000;        // viewBox edge length
const CENTER = VIEW / 2;

// Physics tuned for the 1000-unit viewBox.
// Self is pinned at the centre, so all the work to keep nodes apart is done by
// pairwise repulsion (self-as-node + centre-repulsion) balanced against edge tension.
const REPULSION = 1600000;     // pairwise node-node repulsion
const CENTER_REPULSION = 1000000; // extra 1/r² push away from the centre point
const ATTRACTION = 0.048;     // edge tension; keeps the cluster from drifting off
const DAMPING = 0.0006;

// Movement threshold below which a mouseDown/Up is treated as a click.
const CLICK_THRESHOLD_PX = 4;

export default function RelationshipGraph({
    nodes: inputNodes,
    edges: inputEdges,
    onSelfClick,
    onEdgeClick,
    viewport,
    onViewportChange,
}) {
    const svgRef = useRef(null);
    const [nodes, setNodes] = useState([]);
    const [links, setLinks] = useState([]);
    const requestRef = useRef();
    const lastTimeRef = useRef();
    const draggedNodeIndex = useRef(null);
    const dragStartRef = useRef(null);
    const panRef = useRef(null);

    const setViewport = onViewportChange;

    useEffect(() => {
        const idToIndex = new Map();
        inputNodes.forEach((n, i) => idToIndex.set(n.id, i));

        const directIndices = inputNodes
            .map((n, i) => ({ n, i }))
            .filter(({ n }) => n.type === "direct" || n.type === "pending");
        const ringRadius = 200;

        // Preserve positions of nodes that were already in the graph.
        setNodes(prev => {
            const prevById = new Map(prev.map(n => [n.id, n]));
            return inputNodes.map((n, i) => {
                const existing = prevById.get(n.id);
                if (existing) {
                    // Same node id — keep its physical position and velocity.
                    return {
                        ...n,
                        idx: i,
                        x: existing.x,
                        y: existing.y,
                        vx: existing.vx,
                        vy: existing.vy,
                        pinned: n.type === "self",
                        isDragging: false,
                    };
                }
                // New node — pick an initial position based on its role.
                if (n.type === "self") {
                    return { ...n, idx: i, x: CENTER, y: CENTER, vx: 0, vy: 0, pinned: true, isDragging: false };
                }
                const directIdx = directIndices.findIndex(({ i: j }) => j === i);
                if (directIdx >= 0) {
                    const angle = (directIdx / Math.max(directIndices.length, 1)) * Math.PI * 2;
                    return {
                        ...n,
                        idx: i,
                        x: CENTER + Math.cos(angle) * ringRadius,
                        y: CENTER + Math.sin(angle) * ringRadius,
                        vx: 0, vy: 0, pinned: false, isDragging: false,
                    };
                }
                return {
                    ...n,
                    idx: i,
                    x: CENTER + (Math.random() - 0.5) * 400,
                    y: CENTER + (Math.random() - 0.5) * 400,
                    vx: 0, vy: 0, pinned: false, isDragging: false,
                };
            });
        });

        const newLinks = inputEdges
            .map(e => ({
                source: idToIndex.get(e.source),
                target: idToIndex.get(e.target),
                romantic: e.romantic,
                sexual: e.sexual,
                pending: !!e.pending,
                relationshipUUID: e.relationshipUUID,
                raw: e,
            }))
            .filter(l => l.source !== undefined && l.target !== undefined);

        setLinks(newLinks);
        if (lastTimeRef.current === undefined) lastTimeRef.current = performance.now();
    }, [inputNodes, inputEdges]);

    const svgPoint = (e) => {
        const svg = svgRef.current;
        if (!svg) return null;
        const CTM = svg.getScreenCTM();
        if (!CTM) return null;
        return {
            x: (e.clientX - CTM.e) / CTM.a,
            y: (e.clientY - CTM.f) / CTM.d,
        };
    };

    const handleWheel = (e) => {
        e.preventDefault();
        const pt = svgPoint(e);
        if (!pt) return;
        const factor = e.deltaY < 0 ? 0.85 : 1.18;
        setViewport(v => {
            const newW = v.w * factor;
            const ratio = newW / v.w;
            const newH = v.h * ratio;
            return {
                x: pt.x - (pt.x - v.x) * ratio,
                y: pt.y - (pt.y - v.y) * ratio,
                w: newW,
                h: newH,
            };
        });
    };

    const handleBackgroundMouseDown = (e) => {
        if (e.target !== svgRef.current) return; // node/edge clicks handled elsewhere
        panRef.current = {
            screenX: e.clientX,
            screenY: e.clientY,
            viewportX: viewport.x,
            viewportY: viewport.y,
        };
    };

    const handleNodeMouseDown = (e, index) => {
        const node = nodes[index];
        if (!node || node.pinned) return;
        const pt = svgPoint(e);
        draggedNodeIndex.current = index;
        dragStartRef.current = pt;
        setNodes(prev => prev.map((n, i) =>
            i === index ? { ...n, isDragging: true, vx: 0, vy: 0 } : n
        ));
    };

    const handleMouseMove = (e) => {
        if (panRef.current) {
            const CTM = svgRef.current?.getScreenCTM();
            if (!CTM) return;
            const dxView = (e.clientX - panRef.current.screenX) / CTM.a;
            const dyView = (e.clientY - panRef.current.screenY) / CTM.d;
            setViewport(v => ({
                x: panRef.current.viewportX - dxView,
                y: panRef.current.viewportY - dyView,
                w: v.w,
                h: v.h,
            }));
            return;
        }
        if (draggedNodeIndex.current === null) return;
        const pt = svgPoint(e);
        if (!pt) return;
        setNodes(prev => {
            if (!prev[draggedNodeIndex.current]) return prev;
            return prev.map((n, i) =>
                i === draggedNodeIndex.current ? { ...n, x: pt.x, y: pt.y, vx: 0, vy: 0 } : n
            );
        });
    };

    const handleMouseUp = () => {
        if (panRef.current) {
            panRef.current = null;
            return;
        }
        if (draggedNodeIndex.current !== null) {
            const indexToRelease = draggedNodeIndex.current;
            draggedNodeIndex.current = null;
            dragStartRef.current = null;
            setNodes(prev => prev.map((n, i) =>
                i === indexToRelease ? { ...n, isDragging: false } : n
            ));
        }
    };

    const handleSelfClick = (e) => {
        e.stopPropagation();
        if (onSelfClick) onSelfClick();
    };

    const handleEdgeClick = (e, link) => {
        e.stopPropagation();
        if (onEdgeClick) onEdgeClick(link.raw || {
            source: nodes[link.source]?.id,
            target: nodes[link.target]?.id,
            romantic: link.romantic,
            sexual: link.sexual,
            pending: link.pending,
            relationshipUUID: link.relationshipUUID,
        });
    };

    const animate = (time) => {
        const dt = Math.min((time - lastTimeRef.current) / 1000, 0.032);
        lastTimeRef.current = time;

        setNodes(prevNodes => {
            if (prevNodes.length === 0) return prevNodes;
            const nextNodes = prevNodes.map(n => ({ ...n }));

            for (let i = 0; i < nextNodes.length; i++) {
                for (let j = i + 1; j < nextNodes.length; j++) {
                    const dx = nextNodes[i].x - nextNodes[j].x;
                    const dy = nextNodes[i].y - nextNodes[j].y;
                    const distSq = dx * dx + dy * dy + 100;
                    const force = (REPULSION / distSq) * dt;
                    const fx = (dx / Math.sqrt(distSq)) * force;
                    const fy = (dy / Math.sqrt(distSq)) * force;

                    if (!nextNodes[i].pinned && !nextNodes[i].isDragging) { nextNodes[i].vx += fx; nextNodes[i].vy += fy; }
                    if (!nextNodes[j].pinned && !nextNodes[j].isDragging) { nextNodes[j].vx -= fx; nextNodes[j].vy -= fy; }
                }
            }

            links.forEach(link => {
                const s = nextNodes[link.source];
                const t = nextNodes[link.target];
                if (!s || !t) return;
                const dx = t.x - s.x;
                const dy = t.y - s.y;
                const fx = dx * ATTRACTION * dt;
                const fy = dy * ATTRACTION * dt;

                if (!s.pinned && !s.isDragging) { s.vx += fx; s.vy += fy; }
                if (!t.pinned && !t.isDragging) { t.vx -= fx; t.vy -= fy; }
            });

            nextNodes.forEach(n => {
                if (!n.pinned && !n.isDragging) {
                    // Repulsion away from the centre point. Inverse-square so nodes
                    // very close to the centre get a strong push outward, far nodes
                    // barely notice it (edge tension dominates at distance).
                    const dx = n.x - CENTER;
                    const dy = n.y - CENTER;
                    const distSq = dx * dx + dy * dy + 100;
                    const dist = Math.sqrt(distSq);
                    const force = (CENTER_REPULSION / distSq) * dt;
                    n.vx += (dx / dist) * force;
                    n.vy += (dy / dist) * force;

                    n.vx *= Math.pow(DAMPING, dt);
                    n.vy *= Math.pow(DAMPING, dt);

                    n.x += n.vx;
                    n.y += n.vy;
                }
            });

            return nextNodes;
        });
        requestRef.current = requestAnimationFrame(animate);
    };

    useEffect(() => {
        requestRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(requestRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [links]);


    return (
        <svg
            ref={svgRef}
            className="graph-svg"
            viewBox={`${viewport.x} ${viewport.y} ${viewport.w} ${viewport.h}`}
            preserveAspectRatio="xMidYMid meet"
            onMouseDown={handleBackgroundMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
        >
            <defs>
                {/* Diagonal stripes for the self node when not discoverable.
                    objectBoundingBox so the stripes scale with the circle and
                    stay attached to it when it moves. */}
                <pattern
                    id="hidden-self-stripes"
                    patternUnits="objectBoundingBox"
                    patternContentUnits="objectBoundingBox"
                    width="0.22"
                    height="0.22"
                    patternTransform="rotate(45)"
                >
                    <rect width="0.11" height="0.22" fill="#fcbf00" />
                    <rect x="0.11" width="0.11" height="0.22" fill="#ffe066" />
                </pattern>
            </defs>
            {links.map((link, i) => {
                const s = nodes[link.source];
                const t = nodes[link.target];
                if (!s || !t) return null;
                const clickable = !!link.relationshipUUID;
                return (
                    <g
                        key={i}
                        style={{ cursor: clickable ? "pointer" : "default" }}
                        onClick={clickable ? (e) => handleEdgeClick(e, link) : undefined}
                    >
                        {clickable && (
                            <line
                                x1={s.x}
                                y1={s.y}
                                x2={t.x}
                                y2={t.y}
                                stroke="transparent"
                                strokeWidth="18"
                                pointerEvents="stroke"
                            />
                        )}
                        <line
                            x1={s.x}
                            y1={s.y}
                            x2={t.x}
                            y2={t.y}
                            stroke={edgeColour(link.romantic, link.sexual)}
                            strokeWidth="3"
                            strokeDasharray={link.pending ? "8,6" : undefined}
                            pointerEvents="none"
                        />
                    </g>
                );
            })}
            {nodes.map((node, i) => {
                const isSelf = node.type === "self";
                const isPending = node.type === "pending";
                const isAnon = node.type === "anon";
                const isDirect = node.type === "direct";
                const radius = isSelf ? 28 : (isAnon ? 14 : 20);
                const className =
                    isSelf ? (node.hidden ? "graph-node-main graph-node-main-hidden" : "graph-node-main") :
                    isPending ? "graph-node-pending" :
                    isAnon ? "graph-node-anon" :
                    "graph-node";
                let circleStyle;
                if (node.hidden) {
                    circleStyle = { fill: "url(#hidden-self-stripes)" };
                } else if (isDirect) {
                    const c = edgeColour(node.romantic, node.sexual);
                    circleStyle = { fill: c, stroke: c };
                }
                return (
                    <g
                        key={i}
                        transform={`translate(${node.x || 0},${node.y || 0})`}
                        onMouseDown={(e) => { if (!isSelf) handleNodeMouseDown(e, i); }}
                        onClick={isSelf ? handleSelfClick : undefined}
                        style={{ cursor: isSelf ? "pointer" : (isAnon ? "default" : "grab") }}
                    >
                        <circle
                            r={radius}
                            className={className}
                            style={circleStyle}
                        />
                        {node.label && (
                            <text
                                dy={radius + 14}
                                textAnchor="middle"
                                className="node-label"
                                style={{ pointerEvents: "none" }}
                            >
                                {node.label}
                            </text>
                        )}
                    </g>
                );
            })}
        </svg>
    );
}
