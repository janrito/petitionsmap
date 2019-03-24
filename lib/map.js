const drawMap = function([hexjson, petition]) {
  const gray = "#666666";
  const strokeColor = "#fefefe";
  const red = "red";
  // Set the size and margins of the svg
  const margin = { top: 10, right: 10, bottom: 10, left: 10 },
    width = 580 - margin.left - margin.right,
    height = 580 - margin.top - margin.bottom,
    barwidth = 340,
    barheight = 200;

  const { signatures_by_constituency } = petition.data.attributes;

  const signaturesCount = signatures_by_constituency.reduce((hashmap, obj) => {
    hashmap[obj.ons_code] = obj;
    return hashmap;
  }, {});

  const constituencies = hexjson.hexes;

  const calc_perc_pop = function(localconst) {
    return localconst.signature_count / constituencies[localconst.ons_code].p;
  };

  const calc_perc_pop_from_hex = function(hex) {
    if (signaturesCount[hex.key] == undefined) {
      return 0;
    }
    return signaturesCount[hex.key].signature_count / hex.p;
  };

  const sorted_signatures_by_perc_pop = signatures_by_constituency.sort(
    (a, b) => {
      return calc_perc_pop(a) > calc_perc_pop(b)
        ? -1
        : calc_perc_pop(a) < calc_perc_pop(b)
        ? 1
        : 0;
    }
  );

  const n_sel_constituencies = 100;

  const selected_constituencies = sorted_signatures_by_perc_pop
    .slice(0, n_sel_constituencies / 2)
    .concat(sorted_signatures_by_perc_pop.slice(-n_sel_constituencies / 2));

  const maxSignatures = signatures_by_constituency.reduce(
    (m, obj) => (m > obj.signature_count ? m : obj.signature_count),
    0
  );

  const maxPop = Object.values(constituencies).reduce(
    (m, obj) => (m > obj.p ? m : obj.p),
    0
  );
  // create scales
  const color = d3
    .scaleSequential(d3.interpolateViridis)
    .domain([0.0, maxSignatures / maxPop]);
  // set the bar ranges
  var bar_x = d3
    .scaleBand()
    .range([0, barwidth])
    .domain(selected_constituencies.map(d => d.mp))
    .padding(0.1);

  var bar_y = d3
    .scaleLinear()
    .range([barheight, 0])
    .domain([0, maxSignatures]);

  // message
  const message = d3.select("#message");

  message.append("h1").text(petition.data.attributes.action);
  message
    .append("h2")
    .attr("id", "total_signature_count")
    .style("font-size", "36pt")
    .style("line-height", 0.5)
    .text(
      `${Number(petition.data.attributes.signature_count).toLocaleString()}`
    )
    .append("span")
    .style("font-size", "18pt")
    .style("color", gray)
    .style("line-height", 2)
    .style("font-weight", "400")
    .text(" signatures");

  message.append("p").text(petition.data.attributes.background);
  message
    .append("p")
    .style("text-align", "right")
    .append("a")
    .text("sign this petition")
    .attr("href", petition.links.self.replace(/\.json$/gi, ""));

  //TODO: Link back to ODI leeds, petitions uk

  // Create the svg element
  const svg = d3
    .select("#vis")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Render the hexes
  const hexes = d3.renderHexJSON(hexjson, width, height);

  // Bind the hexes to g elements of the svg and position them
  const hexmap = svg
    .selectAll("g")
    .data(hexes)
    .enter()
    .append("g")
    .attr("id", hex => `pol_${hex.key}`)
    .attr("transform", hex => `translate(${hex.x},${hex.y})`);

  // Create Event Handlers for mouse
  const handleMouseOver = function(hex, i) {
    // Add interactivity
    // Use D3 to select element, change color and size
    d3.select(this).attr("fill", red);
    d3.select(`#bar_${hex.key}`).attr("fill", red);

    // Specify where to put label of text
    const label = svg
      .append("g")
      .attr("id", `text_label_${hex.key}`)
      .attr("transform", () => `translate(${width},${32})`);
    label
      .append("text")
      .attr("text-anchor", "end")
      .attr("fill", gray)
      .text(hex.n);
    label
      .append("text")
      .attr("y", 18)
      .attr("fill", gray)
      .attr("text-anchor", "end")
      .text(signaturesCount[hex.key] ? signaturesCount[hex.key].mp : "");
    label
      .append("text")
      .attr("y", 36)
      .attr("fill", gray)
      .attr("text-anchor", "end")
      .attr("font-weight", "400")
      .text(`${Number(hex.p).toLocaleString()} population`);

    label
      .append("text")
      .attr("y", 54)
      .attr("fill", gray)
      .attr("text-anchor", "end")
      .attr("font-weight", "800")
      .text(
        signaturesCount[hex.key]
          ? `${Number(
              signaturesCount[hex.key].signature_count
            ).toLocaleString()} (${Number(
              calc_perc_pop_from_hex(hex) * 100
            ).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            })}%) signatures`
          : "No signatures yet"
      );
  };

  const handleMouseOut = function(hex, i) {
    // Use D3 to select element, change color back to normal
    d3.select(this).attr("fill", function(hex) {
      return color(calc_perc_pop_from_hex(hex));
    });
    d3.select(`#bar_${hex.key}`).attr("fill", function() {
      return color(calc_perc_pop_from_hex(hex));
    });
    // Select text by id and then remove
    d3.select(`#text_label_${hex.key}`).remove(); // Remove text location
  };

  // Draw the polygons around each hex's centre
  hexmap
    .append("polygon")
    .attr("points", hex => hex.points)
    .attr("stroke", strokeColor)
    .attr("stroke-width", "1")
    .attr("fill", hex => color(calc_perc_pop_from_hex(hex)))
    .on("mouseover", handleMouseOver)
    .on("mouseout", handleMouseOut);

  // barchart
  const barsvg = message
    .append("svg")
    .attr("width", barwidth + margin.left + margin.right)
    .attr("height", barheight + margin.top + margin.bottom);

  // separator
  barsvg
    .append("line")
    .style("stroke", gray)
    .attr("x1", barwidth / 2)
    .attr("x2", barwidth / 2)
    .attr("y1", 0)
    .attr("y2", barheight);

  // bar labels
  barsvg
    .append("text")
    .attr("y", 10)
    .attr("x", barwidth / 2 - 12)
    .attr("font-size", "9pt")
    .attr("fill", gray)
    .attr("text-anchor", "end")
    .text("top");

  barsvg
    .append("text")
    .attr("y", 10)
    .attr("x", barwidth / 2 + 12)
    .attr("font-size", "9pt")
    .attr("fill", gray)
    .attr("text-anchor", "start")
    .text("bottom");

  // append the rectangles for the bar chart
  barsvg
    .selectAll(".bar")
    .data(selected_constituencies)
    .enter()
    .append("rect")
    .attr("class", "bar")
    .attr("id", d => `bar_${d.ons_code}`)
    .attr("x", d => bar_x(d.mp))
    .attr("width", bar_x.bandwidth())
    .attr("y", d => bar_y(d.signature_count))
    .attr("height", d => barheight - bar_y(d.signature_count))
    .attr("fill", d => color(calc_perc_pop(d)))
    .on("mouseover", (d, i) =>
      d3.select(`#pol_${d.ons_code} polygon`).dispatch("mouseover")
    )
    .on("mouseout", d =>
      d3.select(`#pol_${d.ons_code} polygon`).dispatch("mouseout")
    );
};

petition = window.location.search.slice(1).trim() || "241584";
petition_data_url = `https://petition.parliament.uk/petitions/${petition}.json`;

Promise.all([
  d3.json("./lib/constituencies.hexjson.json"),
  d3.json(petition_data_url)
]).then(drawMap);
