import React, { useEffect, useRef, useState } from 'react';

export default function RelationshipGraph({ matrixData, matrixLabels }) {
    const svgRef = useRef(null);
    const [nodes, setNodes] = useState([]);
    const [links, setLinks] = useState([]);
    const requestRef = useRef();
    const lastTimeRef = useRef(); // Track the last timestamp
    const draggedNodeIndex = useRef(null);

    // Physics Constants (Adjusted for per-second scaling)
    const REPULSION = 100000; 
    const ATTRACTION = 0.002;   
    const CENTER_FORCE = 0.1; 
    const DAMPING = 0.0003;      // Friction as a loss-per-second

    useEffect(() => {
        const newNodes = matrixLabels.map((label, i) => ({
            id: i,
            label,
            x: 250 + (Math.random() - 0.5) * 100,
            y: 250 + (Math.random() - 0.5) * 100,
            vx: 0,
            vy: 0,
            isDragging: false 
        }));

        const newLinks = [];
        for (let i = 0; i < matrixData.length; i++) {
            for (let j = i + 1; j < (matrixData[i]?.length || 0); j++) {
                if (matrixData[i][j] === 1) {
                    newLinks.push({ source: i, target: j });
                }
            }
        }
        setNodes(newNodes);
        setLinks(newLinks);
        lastTimeRef.current = performance.now(); // Initialize timer
    }, [matrixData, matrixLabels]);

    const handleMouseDown = (index) => {
        draggedNodeIndex.current = index;
        setNodes(prev => prev.map((n, i) => 
            i === index ? { ...n, isDragging: true, vx: 0, vy: 0 } : n
        ));
    };

    const handleMouseMove = (e) => {
        if (draggedNodeIndex.current === null) return;
        const svg = svgRef.current;
        const CTM = svg.getScreenCTM();
        if (!CTM) return;
        const mouseX = (e.clientX - CTM.e) / CTM.a;
        const mouseY = (e.clientY - CTM.f) / CTM.d;

        setNodes(prev => {
            if (!prev[draggedNodeIndex.current]) return prev;
            return prev.map((n, i) => 
                i === draggedNodeIndex.current ? { ...n, x: mouseX, y: mouseY, vx: 0, vy: 0 } : n
            );
        });
    };

    const handleMouseUp = () => {
        if (draggedNodeIndex.current !== null) {
            const indexToRelease = draggedNodeIndex.current;
            draggedNodeIndex.current = null;
            setNodes(prev => prev.map((n, i) => 
                i === indexToRelease ? { ...n, isDragging: false } : n
            ));
        }
    };

    const animate = (time) => {
        // Calculate Delta Time in seconds
        const dt = Math.min((time - lastTimeRef.current) / 1000, 0.032); // Cap at ~30fps to prevent "teleporting"
        lastTimeRef.current = time;

        setNodes(prevNodes => {
            if (prevNodes.length === 0) return prevNodes;
            const nextNodes = prevNodes.map(n => ({ ...n }));

            // 1. Repulsion
            for (let i = 0; i < nextNodes.length; i++) {
                for (let j = i + 1; j < nextNodes.length; j++) {
                    const dx = nextNodes[i].x - nextNodes[j].x;
                    const dy = nextNodes[i].y - nextNodes[j].y;
                    const distSq = dx * dx + dy * dy + 100;
                    const force = (REPULSION / distSq) * dt;
                    const fx = (dx / Math.sqrt(distSq)) * force;
                    const fy = (dy / Math.sqrt(distSq)) * force;

                    if (!nextNodes[i].isDragging) { nextNodes[i].vx += fx; nextNodes[i].vy += fy; }
                    if (!nextNodes[j].isDragging) { nextNodes[j].vx -= fx; nextNodes[j].vy -= fy; }
                }
            }

            // 2. Attraction
            links.forEach(link => {
                const s = nextNodes[link.source];
                const t = nextNodes[link.target];
                if (!s || !t) return;
                const dx = t.x - s.x;
                const dy = t.y - s.y;
                const fx = dx * ATTRACTION * dt;
                const fy = dy * ATTRACTION * dt;

                if (!s.isDragging) { s.vx += fx; s.vy += fy; }
                if (!t.isDragging) { t.vx -= fx; t.vy -= fy; }
            });

            // 3. Integration & Damping
            const centerX = 250, centerY = 250;
            nextNodes.forEach(n => {
                if (!n.isDragging) {
                    // Center gravity
                    n.vx += (centerX - n.x) * CENTER_FORCE * dt;
                    n.vy += (centerY - n.y) * CENTER_FORCE * dt;
                    
                    // Apply damping (v = v * damping^dt)
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
    }, [links]);

    return (
        <div className="graph-box" style={{ width: '500px', height: '500px', background: '#fff' }}>
            <svg 
                ref={svgRef} 
                width="100%" height="100%"
                onMouseMove={handleMouseMove} 
                onMouseUp={handleMouseUp} 
                onMouseLeave={handleMouseUp}
            >
                {links.map((link, i) => (
                    <line key={i} x1={nodes[link.source]?.x} y1={nodes[link.source]?.y} x2={nodes[link.target]?.x} y2={nodes[link.target]?.y} stroke="#ddd" strokeWidth="2" />
                ))}
                {nodes.map((node, i) => (
                    <g key={i} transform={`translate(${node.x || 0},${node.y || 0})`} onMouseDown={() => handleMouseDown(i)} style={{ cursor: 'grab' }}>
                        <circle r="15" fill={i === 0 ? "#facc15" : "#6366f1"} stroke={i === 0 ? "#ca8a04" : "#4f46e5"} strokeWidth="2" />
                        <text dy="25" textAnchor="middle" style={{ fontSize: '12px', userSelect: 'none', pointerEvents: 'none' }}>{node.label}</text>
                    </g>
                ))}
            </svg>
        </div>
    );
}