// js/ui-tree.js — owned by Design screens.
// A small, reusable drawing of a tree or ladder: boxes in columns, joined by lines.
// It knows nothing about the game's rules. Give it nodes and edges and it returns an element.
//
//   StarlineTree.draw({
//     nodes:  [{ id, label, column, state, sub, tip }],   // state: "owned" | "open" | "locked"
//     edges:  [{ from, to }],                             // ids; a line runs from `from` to `to`
//     picked: id or null,                                 // the node shown as selected
//     onPick: function (id) {},                           // called when a node is clicked
//     label:  "Research tree"                             // name for screen readers
//   })
//
// Nodes with the same `column` stack top to bottom in the order given; columns run left to
// right in ascending order. The research tree uses each node's depth as its column; an era
// ladder or a body ladder can use the same call with other columns.
(function () {
  "use strict";

  var NODE_W = 150, NODE_H = 86, GAP_X = 24, GAP_Y = 12, PAD = 8;   // pixels
  var STATE_TEXT = { owned: "owned", open: "can be bought", locked: "locked" };

  function h(tag, attrs, text) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (attrs[k] === null || attrs[k] === undefined || attrs[k] === false) return;
      if (k === "class") node.className = attrs[k];
      else if (k.indexOf("on") === 0) node.addEventListener(k.slice(2), attrs[k]);
      else if (k === "style") node.style.cssText = String(attrs[k]);   // the CSSOM: a strict style-src blocks the style attribute
      else node.setAttribute(k, attrs[k]);
    });
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function draw(opts) {
    opts = opts || {};
    var nodes = Array.isArray(opts.nodes) ? opts.nodes : [];
    var edges = Array.isArray(opts.edges) ? opts.edges : [];

    // Work out where each node goes: a column index and a row within that column.
    var columns = [];
    nodes.forEach(function (n) { if (columns.indexOf(n.column) === -1) columns.push(n.column); });
    columns.sort(function (a, b) { return a - b; });
    var rowsUsed = {}, place = {}, tallest = 0;
    nodes.forEach(function (n) {
      var col = columns.indexOf(n.column);
      var row = rowsUsed[col] || 0;
      rowsUsed[col] = row + 1;
      if (row + 1 > tallest) tallest = row + 1;
      place[n.id] = { x: PAD + col * (NODE_W + GAP_X), y: PAD + row * (NODE_H + GAP_Y), node: n };
    });
    var width = PAD * 2 + Math.max(1, columns.length) * NODE_W + Math.max(0, columns.length - 1) * GAP_X;
    var height = PAD * 2 + Math.max(1, tallest) * NODE_H + Math.max(0, tallest - 1) * GAP_Y;

    var board = h("div", { class: "tree-board", style: "width: " + width + "px; height: " + height + "px" });

    // Lines first, so the boxes sit on top of them.
    var NS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(NS, "svg");
    svg.setAttribute("class", "tree-lines");
    svg.setAttribute("width", width);
    svg.setAttribute("height", height);
    svg.setAttribute("aria-hidden", "true");
    edges.forEach(function (e) {
      var a = place[e.from], b = place[e.to];
      if (!a || !b) return;
      var x1 = a.x + NODE_W, y1 = a.y + NODE_H / 2, x2 = b.x, y2 = b.y + NODE_H / 2;
      var mid = x2 - GAP_X / 2;
      var path = document.createElementNS(NS, "path");
      path.setAttribute("d", "M" + x1 + " " + y1 + " H" + mid + " V" + y2 + " H" + x2);
      path.setAttribute("class", "tree-line" + (a.node.state === "owned" ? " done" : ""));
      svg.appendChild(path);
    });
    board.appendChild(svg);

    nodes.forEach(function (n) {
      var at = place[n.id];
      var state = STATE_TEXT[n.state] ? n.state : "locked";
      var b = h("button", {
        type: "button",
        class: "tree-node " + state + (opts.picked === n.id ? " picked" : ""),
        style: "left: " + at.x + "px; top: " + at.y + "px; width: " + NODE_W + "px; height: " + NODE_H + "px",
        "data-key": "node-" + n.id,
        "aria-pressed": opts.picked === n.id ? "true" : "false",
        "aria-label": n.label + ", " + STATE_TEXT[state] + (n.sub ? ", " + n.sub : "") + (n.tip ? ". " + n.tip : ""),
        onclick: function () { if (typeof opts.onPick === "function") opts.onPick(n.id); }
      });
      b.appendChild(h("span", { class: "tree-label" }, n.label));
      if (n.sub) b.appendChild(h("span", { class: "tree-sub" }, n.sub));
      board.appendChild(b);
    });

    // The board keeps its size; on a narrow screen its box scrolls sideways.
    var box = h("div", { class: "tree", role: "group", "aria-label": opts.label || "Tree", tabindex: "0" });
    box.appendChild(board);
    return box;
  }

  window.StarlineTree = { draw: draw };
})();
