// ===== THE GRAPH: Dry Powder on Sidelines =====
// Self-executing on page load

(function() {
    // Run when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadTheGraph);
    } else {
        loadTheGraph();
    }
})();

async function loadTheGraph() {
    try {
        const response = await fetch('/api/the-graph');
        const data = await response.json();
        
        if (!data || !data.data || data.data.length === 0) {
            console.log('No graph data available');
            return;
        }
        
        renderGraph(data);
        
    } catch (error) {
        console.error('Error loading The Graph:', error);
    }
}

function renderGraph(data) {
    const points = data.data;
    const current = data.current;
    
    // Calculate min/max for scaling
    const ratios = points.map(p => p.ratio);
    const minRatio = Math.min(...ratios);
    const maxRatio = Math.max(...ratios);
    
    // Add padding to range
    const paddedMin = Math.floor(minRatio - 0.5);
    const paddedMax = Math.ceil(maxRatio + 0.5);
    const paddedRange = paddedMax - paddedMin;
    
    // SVG dimensions
    const width = 220;
    const height = 80;
    const padding = 4;
    
    // Calculate points for the path
    const pathPoints = points.map((point, i) => {
        const x = (i / (points.length - 1)) * (width - padding * 2) + padding;
        const y = height - padding - ((point.ratio - paddedMin) / paddedRange) * (height - padding * 2);
        return { x, y };
    });
    
    // Create line path
    const linePath = pathPoints.map((p, i) => 
        (i === 0 ? 'M' : 'L') + `${p.x.toFixed(1)},${p.y.toFixed(1)}`
    ).join(' ');
    
    // Create area path (closed shape for fill)
    const areaPath = linePath + 
        ` L${(width - padding).toFixed(1)},${(height - padding).toFixed(1)}` +
        ` L${padding.toFixed(1)},${(height - padding).toFixed(1)} Z`;
    
    // Update SVG
    const lineEl = document.getElementById('graph-line');
    const areaEl = document.getElementById('graph-area');
    const dotEl = document.getElementById('graph-dot');
    
    if (lineEl) lineEl.setAttribute('d', linePath);
    if (areaEl) areaEl.setAttribute('d', areaPath);
    
    // Position the current dot
    if (dotEl && pathPoints.length > 0) {
        const lastPoint = pathPoints[pathPoints.length - 1];
        dotEl.setAttribute('cx', lastPoint.x.toFixed(1));
        dotEl.setAttribute('cy', lastPoint.y.toFixed(1));
    }
    
    // Update Y-axis labels
    const yMaxEl = document.getElementById('graph-y-max');
    const yMinEl = document.getElementById('graph-y-min');
    if (yMaxEl) yMaxEl.textContent = `${paddedMax}%`;
    if (yMinEl) yMinEl.textContent = `${paddedMin}%`;
    
    // Update current value
    const valueEl = document.getElementById('graph-value');
    if (valueEl) valueEl.textContent = `${current.ratio.toFixed(1)}%`;
    
    // Update range text
    const rangeEl = document.getElementById('graph-range');
    if (rangeEl) {
        rangeEl.textContent = `12M L-H: ${minRatio.toFixed(1)}% – ${maxRatio.toFixed(1)}%`;
    }
    
    // Update insight
    const insightEl = document.getElementById('graph-insight');
    if (insightEl && data.insight) {
        insightEl.textContent = data.insight;
    }
}
