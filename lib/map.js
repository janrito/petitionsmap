const petition_id = window.location.search.slice(1).trim() || "241584";
const petition_data_url = `https://petition.parliament.uk/petitions/${petition_id}.json`;
const petitions_listing_url = "https://petition.parliament.uk/petitions.json";
// state
const state = { hexjson: null, petition: null, petition_list: null };

// colour
const gray = "#666666";
const strokeColor = "#fefefe";
const red = "red";

const wideScreenWidth = 960;
const smallScreenMaxWidth = 600;

const n_sel_constituencies = 100;
const n_petitions_list = 5;

const randpick = function(arr, n) {
  const picks = [];
  const pick_indices = [];
  const source_len = arr.length;
  while (picks.length < n && picks.length < source_len) {
    const tentative_pick = Math.floor(Math.random() * source_len + 1);
    if (pick_indices.indexOf(tentative_pick) === -1) {
      pick_indices.push(tentative_pick);
      picks.push(arr[tentative_pick]);
    }
  }
  return picks;
};

const renderPetitionList = function() {
  const { petition_list } = state;

  const data = petition_list.data;

  const list = d3.select("#other_petitions");
  list.selectAll("*").remove();
  list.append("h2").text("Or look at these other petitions");

  list
    .selectAll(".petition_link")
    .data(randpick(data, n_petitions_list))
    .enter()
    .append("p")
    .attr("class", d => `petition_link other_petition_${d.id}`)
    .append("a")
    .attr("href", d => `?${d.id}`)
    .text(d => d.attributes.action);
};

const renderMessage = function() {
  const { petition } = state;
  // message
  const message = d3.select("#message");
  message.selectAll("*").remove();

  // petition title
  message.append("h1").text(petition.data.attributes.action);
  message
    .append("h2")
    .attr("id", "total_signature_count")
    .style("font-size", "24pt")
    .style("line-height", 0.5)
    .text(
      `${Number(petition.data.attributes.signature_count).toLocaleString()}`
    )
    .append("span")
    .style("font-size", "16pt")
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
};

const render = function() {
  // get state
  const { hexjson, petition } = state;
  // Set the size and margins
  const margin = { top: 10, right: 10, bottom: 10, left: 10 },
    width =
      (window.innerWidth > wideScreenWidth
        ? 600
        : window.innerWidth < smallScreenMaxWidth
        ? window.innerWidth
        : smallScreenMaxWidth) -
      margin.left -
      margin.right,
    height = width * 1.2 - margin.top - margin.bottom,
    label_margin = { top: 32, bottom: 32 },
    colormap_height = height / 2 - label_margin.top - label_margin.bottom,
    barwidth =
      (window.innerWidth > wideScreenWidth
        ? 340
        : window.innerWidth < smallScreenMaxWidth
        ? window.innerWidth
        : smallScreenMaxWidth) -
      margin.left -
      margin.right,
    barheight = barwidth / 2 - margin.top - margin.bottom;

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

  const selected_constituencies_max = sorted_signatures_by_perc_pop.slice(
    0,
    n_sel_constituencies / 2
  );
  const selected_constituencies_min = sorted_signatures_by_perc_pop.slice(
    -n_sel_constituencies / 2
  );

  const maxSignatures = signatures_by_constituency.reduce(
    (m, obj) => (m > obj.signature_count ? m : obj.signature_count),
    0
  );

  const maxPop = Object.values(constituencies).reduce(
    (m, obj) => (m > obj.p ? m : obj.p),
    0
  );

  const topPerc = Math.ceil((maxSignatures / maxPop) * 100) / 100;

  // create scales
  const color = d3
    .scaleSequential(d3.interpolateViridis)
    .domain([0.0, topPerc]);
  // set the bar ranges
  const bar_x_max = d3
    .scaleBand()
    .range([margin.left, barwidth / 2 - margin.left / 2 + margin.left])
    .domain(selected_constituencies_max.map(d => d.mp))
    .padding(0.1);

  const bar_x_min = d3
    .scaleBand()
    .range([
      barwidth / 2 + margin.left / 2 + margin.left,
      barwidth + margin.left
    ])
    .domain(selected_constituencies_min.map(d => d.mp))
    .padding(0.1);

  const bar_y = d3
    .scaleLinear()
    .range([barheight, margin.bottom])
    .domain([0, maxSignatures]);

  const colormap_y = d3
    .scaleLinear()
    .range([colormap_height, 0])
    .domain([0, topPerc]);

  renderMessage();
  renderPetitionList();
  // Create the svg element

  d3.select("#vis")
    .selectAll("*")
    .remove();

  const svg = d3
    .select("#vis")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom);

  const themap = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Render the hexes
  const hexes = d3.renderHexJSON(hexjson, width, height);

  // Bind the hexes to g elements of the map and position them
  const hexmap = themap
    .selectAll("pol")
    .data(hexes)
    .enter()
    .append("g")
    .attr("class", "pol")
    .attr("id", hex => `pol_${hex.key}`)
    .attr("transform", hex => `translate(${hex.x},${hex.y})`);

  // Create Event Handlers for mouse
  const handleMouseOver = function(hex, i) {
    // Add interactivity
    // Use D3 to select element, change color and size
    d3.select(`#pol_${hex.key} polygon`).attr("fill", red);
    d3.select(`#bar_${hex.key}`).attr("fill", red);

    // Specify where to put label of text
    const label = themap
      .append("g")
      .attr("id", `text_label_${hex.key}`)
      .attr("transform", () => `translate(${width},${label_margin.top})`);
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
      .text(`${Number(hex.p).toLocaleString()} electorate`);

    label
      .append("text")
      .attr("y", 54)
      .attr("fill", gray)
      .attr("text-anchor", "end")
      .attr("font-weight", "800")
      .text(
        signaturesCount[hex.key]
          ? `${Number(calc_perc_pop_from_hex(hex) * 100).toLocaleString(
              undefined,
              {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              }
            )}% (${Number(
              signaturesCount[hex.key].signature_count
            ).toLocaleString()} signatures)`
          : "No signatures yet"
      );
  };

  const colormap = svg
    .append("g")
    .attr("id", "colormap")
    .attr(
      "transform",
      () => `translate(${width - 32},${height / 2 - colormap_height / 2})`
    );

  const n_colormap = 256,
    colormap_data = d3
      .range(0, n_colormap)
      .map(d => (d / n_colormap) * topPerc);

  colormap
    .selectAll(".colormap_rect")
    .data(colormap_data)
    .enter()
    .append("rect")
    .attr("class", "colormap_rect")
    .attr("y", d => colormap_y(d))
    .attr("x", 12)
    .attr("height", d => colormap_height / n_colormap + 1)
    .attr("fill", d => color(d))
    .attr("width", 24);

  colormap
    .selectAll(".colormap_label")
    .data([
      colormap_data[0],
      colormap_data[Math.round(n_colormap / 2)],
      topPerc
    ])
    .enter()
    .append("text")
    .attr("class", "colormap_label")
    .attr("y", d => colormap_y(d))
    .attr("x", 0)
    .attr("fill", gray)
    .attr("text-anchor", "end")
    .attr("dominant-baseline", "central")
    .attr("font-size", "8pt")
    .attr("font-weight", "400")
    .text(
      d =>
        `${Number(d * 100).toLocaleString(undefined, {
          minimumFractionDigits: 0,
          maximumFractionDigits: 1
        })} %`
    );

  colormap.selectAll;

  const handleMouseOut = function(hex, i) {
    // Use D3 to select element, change color back to normal
    d3.select(`#pol_${hex.key} polygon`).attr("fill", function(hex) {
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
  d3.select("#bar")
    .selectAll("*")
    .remove();

  const barsvg = d3
    .select("#bar")
    .append("svg")
    .attr("width", barwidth + margin.left + margin.right)
    .attr("height", barheight + margin.top + margin.bottom);

  // separator
  barsvg
    .append("line")
    .style("stroke", gray)
    .style("stroke-width", 1)
    .attr("x1", barwidth / 2 + margin.left)
    .attr("x2", barwidth / 2 + margin.left)
    .attr("y1", 0)
    .attr("y2", barheight + margin.top);

  // bar labels
  barsvg
    .append("text")
    .attr("y", margin.top)
    .attr("x", barwidth / 2 - margin.left + margin.left)
    .attr("font-size", "9pt")
    .attr("fill", gray)
    .attr("text-anchor", "end")
    .text("← most signatures");

  barsvg
    .append("text")
    .attr("y", margin.top)
    .attr("x", barwidth / 2 + margin.left + margin.left)
    .attr("font-size", "9pt")
    .attr("fill", gray)
    .attr("text-anchor", "start")
    .text("least signatures →");

  // append the rectangles for the bar chart
  barsvg
    .selectAll(".bar_max")
    .data(selected_constituencies_max)
    .enter()
    .append("rect")
    .attr("class", "bar")
    .attr("id", d => `bar_${d.ons_code}`)
    .attr("x", d => bar_x_max(d.mp))
    .attr("width", bar_x_max.bandwidth())
    .attr("y", d => bar_y(d.signature_count))
    .attr("height", d => barheight - bar_y(d.signature_count))
    .attr("fill", d => color(calc_perc_pop(d)))
    .on("mouseover", (d, i) => handleMouseOver(constituencies[d.ons_code]))
    .on("mouseout", d => handleMouseOut(constituencies[d.ons_code]));

  barsvg
    .selectAll(".bar_min")
    .data(selected_constituencies_min)
    .enter()
    .append("rect")
    .attr("class", "bar")
    .attr("id", d => `bar_${d.ons_code}`)
    .attr("x", d => bar_x_min(d.mp))
    .attr("width", bar_x_min.bandwidth())
    .attr("y", d => bar_y(d.signature_count))
    .attr("height", d => barheight - bar_y(d.signature_count))
    .attr("fill", d => color(calc_perc_pop(d)))
    .on("mouseover", (d, i) => handleMouseOver(constituencies[d.ons_code]))
    .on("mouseout", d => handleMouseOut(constituencies[d.ons_code]));
};

const saveState = function([hexjson_resp, petition_resp, petition_list_resp]) {
  state.hexjson = hexjson_resp;
  state.petition = petition_resp;
  state.petition_list = petition_list_resp;
  render();
};

Promise.all([
  d3.json("./lib/constituencies.hexjson.json"),
  d3.json(petition_data_url),
  d3.json(petitions_listing_url)
]).then(saveState);

window.addEventListener("resize", render);
