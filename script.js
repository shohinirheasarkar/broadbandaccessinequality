const sections = document.querySelectorAll('.scroll-section');

const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const div = entry.target.querySelector('div');
            if (div) {
                div.classList.remove('opacity-0', 'translate-y-8');
                div.classList.add('opacity-100', 'translate-y-0');
            }
            observer.unobserve(entry.target);
        }
    });
}, {
    threshold: 0.25
});

sections.forEach(section => {
    observer.observe(section);
});

let selectedState = null; // Tracks which state is currently clicked

// FIPS code to state code mapping
const fipsToStateCode = {
    '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA', '08': 'CO', '09': 'CT', '10': 'DE',
    '11': 'DC', '12': 'FL', '13': 'GA', '15': 'HI', '16': 'ID', '17': 'IL', '18': 'IN', '19': 'IA',
    '20': 'KS', '21': 'KY', '22': 'LA', '23': 'ME', '24': 'MD', '25': 'MA', '26': 'MI', '27': 'MN',
    '28': 'MS', '29': 'MO', '30': 'MT', '31': 'NE', '32': 'NV', '33': 'NH', '34': 'NJ', '35': 'NM',
    '36': 'NY', '37': 'NC', '38': 'ND', '39': 'OH', '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI',
    '45': 'SC', '46': 'SD', '47': 'TN', '48': 'TX', '49': 'UT', '50': 'VT', '51': 'VA', '53': 'WA',
    '54': 'WV', '55': 'WI', '56': 'WY'
};

function syncStateSelection(stateCode) {
    selectedState = stateCode;

    // 1. Update all Map Paths across all maps
    d3.selectAll("path")
        .transition().duration(200)
        .attr("stroke", function (d) {
            if (!d.id) return "#ffffff"; // Skip if not a state path
            const code = fipsToStateCode[d.id];
            return code === selectedState ? "#fbbf24" : "#ffffff";
        })
        .attr("stroke-width", function (d) {
            if (!d.id) return 1;
            const code = fipsToStateCode[d.id];
            return code === selectedState ? 3 : 1;
        });

    // 2. Update Scatter Plot Dots
    d3.selectAll(".dot")
        .transition().duration(200)
        .attr("r", d => d.state_code === selectedState ? 12 : 6)
        .attr("fill", d => d.state_code === selectedState ? "#fbbf24" : "#3b82f6")
        .attr("opacity", d => (selectedState && d.state_code !== selectedState) ? 0.3 : 0.7);

    // 3. Update Scatter Plot Labels
    d3.selectAll(".label")
        .transition().duration(200)
        .attr("opacity", d => d.state_code === selectedState ? 1 : 0);
}

// Tooltip element
let tooltip = null;

function showTooltip(event, state, valueKey) {
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.style.position = 'absolute';
        tooltip.style.padding = '12px';
        tooltip.style.background = 'rgba(15, 23, 42, 0.95)';
        tooltip.style.color = 'white';
        tooltip.style.borderRadius = '8px';
        tooltip.style.pointerEvents = 'none';
        tooltip.style.fontSize = '14px';
        tooltip.style.zIndex = '1000';
        tooltip.style.maxWidth = '200px';
        tooltip.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.3)';
        document.body.appendChild(tooltip);
    }

    // Determine the text based on the map type
    let valueText = "";
    if (valueKey === 'density') {
        valueText = `${Math.round(state.density)} per km²`;
    } else if (valueKey === 'income') {
        valueText = `$${state.income.toLocaleString()} median income`;
    } else {
        valueText = `${state.access.toFixed(1)}% access`;
    }

    tooltip.innerHTML = `<strong>${state.state}</strong><br/>${valueText}`;
    tooltip.style.display = 'block';
    tooltip.style.left = (event.pageX + 10) + 'px';
    tooltip.style.top = (event.pageY - 10) + 'px';
}

function hideTooltip() {
    if (tooltip) {
        tooltip.style.display = 'none';
    }
}

function createRankingLists(stateData) {
    const searchInput = document.getElementById('state-search');
    
    const renderLists = (filterText = "") => {
        // Filter data based on search input
        const filteredData = stateData.filter(d => 
            d.state.toLowerCase().includes(filterText.toLowerCase())
        );

        // Sort by access
        const sorted = [...filteredData].sort((a, b) => b.access - a.access);
        
        // Split into top half and bottom half of current results
        const midpoint = Math.ceil(sorted.length / 2);
        const topHalf = sorted.slice(0, midpoint);
        const bottomHalf = sorted.slice(midpoint).reverse();

        const listTemplate = (data, colorClass) => {
            if (data.length === 0) return `<p class="text-center text-slate-400 py-10">No states found</p>`;
            return data.map(d => `
                <div class="flex justify-between items-center bg-white p-3 rounded-lg shadow-sm border border-transparent hover:border-blue-200 transition-colors">
                    <div>
                        <span class="font-bold text-slate-700">${d.state}</span>
                        <div class="text-xs text-slate-500">$${d.income.toLocaleString()} Income</div>
                    </div>
                    <div class="text-right">
                        <span class="text-lg font-black ${colorClass}">${d.access.toFixed(1)}%</span>
                        <div class="text-[10px] uppercase tracking-wider text-slate-400">Access</div>
                    </div>
                </div>
            `).join('');
        };

        document.getElementById('top-states-list').innerHTML = listTemplate(topHalf, 'text-green-600');
        document.getElementById('bottom-states-list').innerHTML = listTemplate(bottomHalf, 'text-red-600');
    };

    // Initial render
    renderLists();

    // Listen for typing
    searchInput.addEventListener('input', (e) => renderLists(e.target.value));
}

// Darker color interpolators
// High contrast blue interpolator (starts lighter, ends dark)
const darkerBlues = t => d3.interpolateRgb("#aed8f5", "#0d88d9")(t);
const darkerGreens = t => d3.interpolateRgb("#15803d", "#052e16")(t);

// Function to create a single choropleth map
function createMap(containerId, geoData, stateData, valueKey, colorScheme, legendContainerClass) {
    const width = 500;
    const height = 400;

    const svg = d3.select(`#${containerId}`)
        .append("svg")
        .attr("width", "100%")
        .attr("height", "100%")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMidYMid meet");

    const projection = d3.geoAlbersUsa()
        .fitSize([width, height], geoData);

    const path = d3.geoPath().projection(projection);

    // Create a lookup object using state_code
    const dataLookup = {};
    stateData.forEach(d => {
        dataLookup[d.state_code] = d;
    });

    // Get values for color scale
    // Get values for color scale
    const values = stateData.map(d => d[valueKey]);

    // Use scaleSequentialLog for density, keep scaleSequential for access
    const colorScale = valueKey === 'density'
        ? d3.scaleSequentialLog(colorScheme).domain(d3.extent(values))
        : d3.scaleSequential(colorScheme).domain(d3.extent(values));

    console.log(`Creating ${containerId} map with darker colors`);

    // Draw states
    svg.selectAll("path")
        .data(geoData.features)
        .enter()
        .append("path")
        .attr("d", path)
        .attr("fill", d => {
            const fipsCode = d.id;
            const stateCode = fipsToStateCode[fipsCode];
            const state = dataLookup[stateCode];

            if (state) {
                return colorScale(state[valueKey]);
            }
            return "#e5e7eb";
        })
        .attr("stroke", "#ffffff")
        .attr("stroke-width", 1)
        .style("cursor", "pointer")
        .on("mouseover", function (event, d) {
            d3.select(this).attr("stroke", "#fbbf24").attr("stroke-width", 2.5);

            const fipsCode = d.id;
            const stateCode = fipsToStateCode[fipsCode];
            const state = dataLookup[stateCode];

            if (state) {
                showTooltip(event, state, valueKey);
            }
        })
        .on("mousemove", function (event) {
            if (tooltip && tooltip.style.display === 'block') {
                tooltip.style.left = (event.pageX + 10) + 'px';
                tooltip.style.top = (event.pageY - 10) + 'px';
            }
        })
        .on("mouseout", function () {
            d3.select(this).attr("stroke", "#ffffff").attr("stroke-width", 1);
            hideTooltip();
        })
        .on("click", function (event, d) {
            // Convert numerical ID (e.g., '06') to State Code (e.g., 'CA')
            const stateCode = fipsToStateCode[d.id];

            // Toggle selection
            const nextSelection = selectedState === stateCode ? null : stateCode;
            syncStateSelection(nextSelection);
        });

    // Create legend
    createLegend(legendContainerClass, colorScale, d3.extent(values), valueKey);
}

// Function to create a simple legend
function createLegend(containerClass, colorScale, domain, dataType) {
    const legendContainer = d3.select(`.${containerClass}`);
    legendContainer.html("");

    const legendWidth = 250;
    const legendHeight = 20;

    const legendSvg = legendContainer.append("svg")
        .attr("width", legendWidth)
        .attr("height", 50);

    const defs = legendSvg.append("defs");
    const linearGradient = defs.append("linearGradient")
        .attr("id", `legend-gradient-${containerClass}`)
        .attr("x1", "0%").attr("y1", "0%")
        .attr("x2", "100%").attr("y2", "0%");

    // Add gradient stops
    const stops = [0, 0.25, 0.5, 0.75, 1];
    stops.forEach(stop => {
        linearGradient.append("stop")
            .attr("offset", `${stop * 100}%`)
            .attr("stop-color", colorScale(domain[0] + stop * (domain[1] - domain[0])));
    });

    legendSvg.append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", legendWidth)
        .attr("height", legendHeight)
        .style("fill", `url(#legend-gradient-${containerClass})`)
        .attr("rx", 4);

    // Format based on data type

    const format = dataType === 'density'
        ? d => `${Math.round(d)}/km²`
        : (dataType === 'income' ? d => `$${Math.round(d / 1000)}k` : d => `${Math.round(d)}%`);

    legendSvg.append("text")
        .attr("x", 0)
        .attr("y", legendHeight + 16)
        .attr("text-anchor", "start")
        .style("font-size", "12px")
        .text(format(domain[0]));

    legendSvg.append("text")
        .attr("x", legendWidth)
        .attr("y", legendHeight + 16)
        .attr("text-anchor", "end")
        .style("font-size", "12px")
        .text(format(domain[1]));
}

// Function to create scatter plot
function createScatterPlot(containerId, stateData) {
    console.log('Creating scatter plot with', stateData.length, 'states');

    // Clear any existing content
    d3.select(`#${containerId}`).selectAll("*").remove();

    const margin = { top: 40, right: 120, bottom: 60, left: 60 };
    const width = 900 - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;

    const svg = d3.select(`#${containerId}`)
        .append("svg")
        .attr("width", "100%")
        .attr("height", "100%")
        .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
        .attr("preserveAspectRatio", "xMidYMid meet");

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Scales
    const xScale = d3.scaleLog()
        .domain([d3.min(stateData, d => d.density) * 0.8, d3.max(stateData, d => d.density) * 1.2])
        .range([0, width]);

    const yScale = d3.scaleLinear()
        .domain([d3.min(stateData, d => d.access) - 2, d3.max(stateData, d => d.access) + 2])
        .range([height, 0]);

    console.log('Scales created:', {
        xDomain: xScale.domain(),
        yDomain: yScale.domain()
    });

    // Add grid lines
    g.append("g")
        .attr("class", "grid")
        .attr("opacity", 0.1)
        .call(d3.axisLeft(yScale)
            .tickSize(-width)
            .tickFormat(""));

    g.append("g")
        .attr("class", "grid")
        .attr("opacity", 0.1)
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(xScale)
            .tickSize(-height)
            .tickFormat(""));

    // Calculate trend line using linear regression on log scale
    const xValues = stateData.map(d => Math.log(d.density));
    const yValues = stateData.map(d => d.access);
    const n = stateData.length;
    const sumX = d3.sum(xValues);
    const sumY = d3.sum(yValues);
    const sumXY = d3.sum(xValues.map((x, i) => x * yValues[i]));
    const sumX2 = d3.sum(xValues.map(x => x * x));

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Draw trend line
    const trendLine = d3.line()
        .x(d => xScale(d))
        .y(d => yScale(slope * Math.log(d) + intercept));

    const trendData = [d3.min(stateData, d => d.density), d3.max(stateData, d => d.density)];

    g.append("path")
        .datum(trendData)
        .attr("fill", "none")
        .attr("stroke", "#94a3b8")
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "5,5")
        .attr("d", trendLine);

    // Add dots
    const dots = g.selectAll(".dot")
        .data(stateData)
        .enter()
        .append("circle")
        .attr("class", "dot")
        .attr("cx", d => xScale(d.density))
        .attr("cy", d => yScale(d.access))
        .attr("r", 6)
        .attr("fill", "#3b82f6")
        .attr("stroke", "#1e40af")
        .attr("stroke-width", 1.5)
        .attr("opacity", 0.7)
        .style("cursor", "pointer");

    // Add state labels (initially hidden)
    const labels = g.selectAll(".label")
        .data(stateData)
        .enter()
        .append("text")
        .attr("class", "label")
        .attr("x", d => xScale(d.density) + 10)
        .attr("y", d => yScale(d.access) + 4)
        .text(d => d.state_code)
        .attr("font-size", "11px")
        .attr("font-weight", "600")
        .attr("fill", "#1e293b")
        .attr("opacity", 0)
        .style("pointer-events", "none");

    // Hover interactions
    dots.on("mouseover", function (event, d) {
        d3.select(this)
            .transition()
            .duration(200)
            .attr("r", 10)
            .attr("fill", "#fbbf24")
            .attr("opacity", 1);

        labels.filter(label => label.state_code === d.state_code)
            .transition()
            .duration(200)
            .attr("opacity", 1);

        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.style.position = 'absolute';
            tooltip.style.padding = '12px';
            tooltip.style.background = 'rgba(15, 23, 42, 0.95)';
            tooltip.style.color = 'white';
            tooltip.style.borderRadius = '8px';
            tooltip.style.pointerEvents = 'none';
            tooltip.style.fontSize = '14px';
            tooltip.style.zIndex = '1000';
            tooltip.style.maxWidth = '200px';
            tooltip.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.3)';
            document.body.appendChild(tooltip);
        }

        tooltip.innerHTML = `
            <strong>${d.state}</strong><br/>
            Density: ${Math.round(d.density)}/km²<br/>
            Access: ${d.access.toFixed(1)}%
        `;
        tooltip.style.display = 'block';
        tooltip.style.left = (event.pageX + 10) + 'px';
        tooltip.style.top = (event.pageY - 10) + 'px';
    })
        .on("mousemove", function (event) {
            if (tooltip) {
                tooltip.style.left = (event.pageX + 10) + 'px';
                tooltip.style.top = (event.pageY - 10) + 'px';
            }
        })
        .on("mouseout", function (event, d) {
            d3.select(this)
                .transition()
                .duration(200)
                .attr("r", 6)
                .attr("fill", "#3b82f6")
                .attr("opacity", 0.7);

            labels.filter(label => label.state_code === d.state_code)
                .transition()
                .duration(200)
                .attr("opacity", 0);

            if (tooltip) {
                tooltip.style.display = 'none';
            }
        });

    // Axes
    // Axes
    g.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(xScale)
            .tickValues([1, 10, 100, 1000]) // Manually set values for even log spacing
            .tickFormat(d3.format(",")))    // Formats numbers nicely (e.g., 1,000)
        .selectAll("text")
        .style("font-size", "12px");

    g.append("g")
        .call(d3.axisLeft(yScale))
        .selectAll("text")
        .style("font-size", "12px");

    // Axis labels
    g.append("text")
        .attr("x", width / 2)
        .attr("y", height + 45)
        .attr("text-anchor", "middle")
        .attr("font-size", "14px")
        .attr("font-weight", "600")
        .attr("fill", "#475569")
        .text("Population Density (per km²) - Log Scale");

    g.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", -45)
        .attr("text-anchor", "middle")
        .attr("font-size", "14px")
        .attr("font-weight", "600")
        .attr("fill", "#475569")
        .text("Broadband Access (%)");

    // Title
    g.append("text")
        .attr("x", width / 2)
        .attr("y", -15)
        .attr("text-anchor", "middle")
        .attr("font-size", "18px")
        .attr("font-weight", "700")
        .attr("fill", "#1e293b")
        .text("Does Density Predict Access?");

    // Add annotation for trend
    g.append("text")
        .attr("x", width - 10)
        .attr("y", 20)
        .attr("text-anchor", "end")
        .attr("font-size", "11px")
        .attr("fill", "#64748b")
        .text("Dashed line shows trend");

    console.log('✓ Scatter plot created successfully');
}

// Function to load all data and initialize maps
async function initializeMaps() {
    try {
        console.log('Loading map data...');

        // Load both datasets
        const [usTopoJSON, statesData] = await Promise.all([
            d3.json("https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json"),
            d3.json("states_data.json")
        ]);

        console.log('✓ Data loaded successfully');

        // Convert TopoJSON to GeoJSON
        const geoData = topojson.feature(usTopoJSON, usTopoJSON.objects.states);

        // Color scheme for Income
        const purpleScheme = d3.interpolatePurples;

        // Create the new income vs access maps
        createMap("map-income", geoData, statesData, "income", purpleScheme, "legend-income");
        createMap("map-access-2", geoData, statesData, "access", darkerGreens, "legend-access-2");

        // Create the two maps with darker colors
        createMap("map-density", geoData, statesData, "density", darkerBlues, "legend-density");
        createMap("map-access", geoData, statesData, "access", darkerGreens, "legend-access");

        // Create scatter plot
        createScatterPlot("scatter-plot", statesData);

        createRankingLists(statesData);

        console.log('✓ All visualizations created successfully!');

    } catch (error) {
        console.error("❌ Error loading map data:", error);
        document.getElementById("map-density").innerHTML =
            `<p class="text-center p-8 text-red-600">Could not load map data: ${error.message}</p>`;
        document.getElementById("map-access").innerHTML =
            `<p class="text-center p-8 text-red-600">Could not load map data: ${error.message}</p>`;
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function () {
    console.log('DOM loaded, setting up map observer');

    // Set up observer for map section
    const mapObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                console.log('Map section visible, initializing maps');
                initializeMaps();
                mapObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.3 });

    const mapSection = document.querySelector('#map-density')?.closest('section');
    if (mapSection) {
        console.log('Map section found, observing');
        mapObserver.observe(mapSection);
    } else {
        console.log('Map section not found, initializing immediately');
        initializeMaps();
    }
});