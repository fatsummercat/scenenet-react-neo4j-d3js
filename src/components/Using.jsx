import { useEffect, useRef, useState } from "react";
import neo4j from "neo4j-driver";
import * as d3 from "d3";

const Using = () => {
  const svgRef = useRef(null);
  const [noData, setNoData] = useState(false);

  useEffect(() => {
    const uri = process.env.REACT_APP_NEO4J_URI;
    const username = process.env.REACT_APP_NEO4J_USERNAME;
    const password = process.env.REACT_APP_NEO4J_PASSWORD;

    const driver = neo4j.driver(uri, neo4j.auth.basic(username, password), {
      encrypted: true,
    });
    const session = driver.session({ database: "neo4j" });

    session
      .run("MATCH p=()-[:USING]->() RETURN p LIMIT 25;")
      .then(result => {
        const graph = {
          nodes: [],
          links: [],
        };

        result.records.forEach(record => {
          const path = record.get("p");

          path.segments.forEach(segment => {
            const startNode = segment.start;
            const endNode = segment.end;

            const startNodeId = startNode.identity.toString();
            const endNodeId = endNode.identity.toString();

            const startNodeName = startNode.properties.scene_name || "";
            const endNodeName = endNode.properties.scene_name || "";

            graph.nodes.push({
              id: startNodeId,
              label: startNode.labels[0],
              name: startNodeName,
            });

            graph.nodes.push({
              id: endNodeId,
              label: endNode.labels[0],
              name: endNodeName,
            });

            graph.links.push({
              source: startNodeId,
              target: endNodeId,
              type: "USING",
            });
          });
        });

        const filterUniqueById = arr => {
          const uniqueIds = new Set();
          return arr.filter(obj => {
            if (uniqueIds.has(obj.id)) {
              return false;
            } else {
              uniqueIds.add(obj.id);
              return true;
            }
          });
        };
        const uniqueNodes = filterUniqueById(graph.nodes);
        graph.nodes = uniqueNodes;

        if (graph.nodes.length > 0 && graph.links.length > 0) {
          renderGraph(graph);
        } else {
          setNoData(true);
        }
      })
      .catch(error => {
        console.error("Query execution failed: ", error);
      });

    return () => {
      session.close();
      driver.close();
    };
  }, []);

  const renderGraph = graph => {
    const width = 1500;
    const height = 600;
    const nodeRadius = 16;

    const svg = d3
      .select(svgRef.current)
      .attr("width", width)
      .attr("height", height);

    const simulation = d3
      .forceSimulation(graph.nodes)
      .force(
        "link",
        d3.forceLink(graph.links).id(d => d.id)
      )
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(width / 2, height / 2));

    svg
      .append("defs")
      .append("marker")
      .attr("id", "arrow")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 50)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#999");

    const link = svg
      .append("g")
      .selectAll("g")
      .data(graph.links)
      .enter()
      .append("g")
      .attr("class", "link-group");

    link
      .append("line")
      .attr("class", "link")
      .attr("stroke", "#999")
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", d => Math.sqrt(d.value))
      .attr("marker-end", "url(#arrow)");

    link
      .append("line")
      .attr("class", "link")
      .attr("stroke", "#999")
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", d => Math.sqrt(d.value))
      .attr("marker-end", "url(#arrow)")
      .attr("transform", "rotate(180)");

    const colorScale = d3
      .scaleOrdinal()
      .domain(graph.nodes.map(node => node.label))
      .range(d3.schemeCategory10);

    const node = svg
      .append("g")
      .selectAll("circle")
      .data(graph.nodes)
      .enter()
      .append("circle")
      .attr("r", nodeRadius)
      .attr("fill", d => colorScale(d.label))
      .call(
        d3
          .drag()
          .on("start", dragStarted)
          .on("drag", dragged)
          .on("end", dragEnded)
      );

    const nodeName = svg
      .selectAll("text")
      .data(graph.nodes)
      .enter()
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("font-size", "12px")
      .text(d => d.name);

    node.append("title").text(d => d.id);

    const linkText = svg
      .selectAll(".link-text")
      .data(graph.links)
      .enter()
      .append("text")
      .attr("class", "link-text")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("font-size", "8px")
      .text(d => d.type);

    simulation.on("tick", () => {
      link
        .selectAll(".link")
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);

      linkText
        .attr("x", d => (d.source.x + d.target.x) / 2)
        .attr("y", d => (d.source.y + d.target.y) / 2);

      node.attr("cx", d => d.x).attr("cy", d => d.y);
      nodeName.attr("x", d => d.x).attr("y", d => d.y - nodeRadius - 5);
    });

    function dragStarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragEnded(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = event.x;
      d.fy = event.y;
    }
  };

  return <div>{noData ? "No data" : <svg ref={svgRef}></svg>}</div>;
};

export default Using;
