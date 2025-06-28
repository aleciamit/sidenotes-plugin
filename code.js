figma.showUI(__html__, { width: 400, height: 500 });

function getSoftFill(color) {
  const colorMap = {
    yellow: { r: 1, g: 0.98, b: 0.86 },
    red: { r: 1, g: 0.9, b: 0.9 },
    green: { r: 0.91, g: 0.97, b: 0.91 },
    blue: { r: 0.9, g: 0.94, b: 0.97 },
    purple: { r: 0.94, g: 0.91, b: 0.96 },
  };
  return { type: "SOLID", color: colorMap[color] || colorMap.yellow };
}

function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function formatTime(date) {
  const options = {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  };
  return date.toLocaleString("en-US", options);
}

async function createNote(text, role, noteType, position) {
  const noteId = Date.now().toString();
  const timestamp = new Date();

  // Define colors per noteType
  const typeColorMap = {
    question: { label: "Question", color: { r: 1, g: 0.97, b: 0.75 } }, // Yellow
    feedback: { label: "Feedback", color: { r: 0.88, g: 0.94, b: 1 } }, // Blue
    issue: { label: "Issue", color: { r: 1, g: 0.85, b: 0.85 } }, // Red
    resolved: { label: "Resolved", color: { r: 0.87, g: 1, b: 0.88 } }, // Green
    direction: { label: "Direction", color: { r: 0.94, g: 0.88, b: 1 } }, // Purple
  };

  const typeData = typeColorMap[noteType] || typeColorMap.feedback;

  const noteFrame = figma.createFrame();
  noteFrame.name = `SideNote: ${text.slice(0, 20)}${text.length > 20 ? "..." : ""}`;
  noteFrame.layoutMode = "VERTICAL";
  noteFrame.counterAxisSizingMode = "AUTO";
  noteFrame.primaryAxisSizingMode = "AUTO";
  noteFrame.itemSpacing = 8;
  noteFrame.paddingTop = 12;
  noteFrame.paddingBottom = 12;
  noteFrame.paddingLeft = 12;
  noteFrame.paddingRight = 12;
  noteFrame.cornerRadius = 8;
  noteFrame.resize(280, 120);
  noteFrame.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
  noteFrame.strokes = [{ type: "SOLID", color: { r: 0.88, g: 0.88, b: 0.88 } }];
  noteFrame.strokeWeight = 1;
  noteFrame.effects = [
    {
      type: "DROP_SHADOW",
      color: { r: 0, g: 0, b: 0, a: 0.05 },
      offset: { x: 0, y: 2 },
      radius: 4,
      visible: true,
      blendMode: "NORMAL",
    },
  ];

  noteFrame.x = position.x - 140;
  noteFrame.y = position.y - 60;

  await figma.loadFontAsync({ family: "Inter", style: "Regular" });

  // Main note content
  const textNode = figma.createText();
  textNode.characters = text;
  textNode.fontSize = 13;
  textNode.lineHeight = { value: 20, unit: "PIXELS" };
  textNode.fills = [{ type: "SOLID", color: { r: 0.15, g: 0.15, b: 0.15 } }];
  textNode.textAutoResize = "HEIGHT";

  // Meta text (role + timestamp)
  const metaNode = figma.createText();
  const dateString = timestamp.toLocaleString("default", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  metaNode.fontSize = 10;
  metaNode.lineHeight = { value: 16, unit: "PIXELS" };
  metaNode.fills = [{ type: "SOLID", color: { r: 0.5, g: 0.5, b: 0.5 } }];
  metaNode.textAutoResize = "WIDTH_AND_HEIGHT";

  // Circle dot
  const dot = figma.createEllipse();
  dot.resize(6, 6);
  dot.fills = [{ type: "SOLID", color: typeData.color }];
  dot.constraints = { horizontal: "MIN", vertical: "CENTER" };

  // Meta frame (horizontal layout)
  const metaFrame = figma.createFrame();
  metaFrame.layoutMode = "HORIZONTAL";
  metaFrame.counterAxisSizingMode = "AUTO";
  metaFrame.primaryAxisSizingMode = "AUTO";
  metaFrame.itemSpacing = 6;
  metaFrame.fills = [];
  metaFrame.strokes = [];

  metaNode.characters = `${capitalize(role)} • ${dateString}`;
  metaFrame.appendChild(metaNode);
  metaFrame.appendChild(dot);

  // Final layout
  noteFrame.setPluginData("noteId", noteId);
  noteFrame.appendChild(textNode);
  noteFrame.appendChild(metaFrame);
  figma.currentPage.appendChild(noteFrame);
}

figma.ui.onmessage = async (msg) => {
  if (msg.type === "START_PLACEMENT") {
    const selection = figma.currentPage.selection;
    const hasSelection =
      selection.length > 0 && "absoluteTransform" in selection[0];

    const notePosition = hasSelection
      ? {
          x: selection[0].absoluteTransform[0][2] + selection[0].width / 2,
          y: selection[0].absoluteTransform[1][2] + selection[0].height / 2,
        }
      : figma.viewport.center;

    await createNote(msg.text, msg.role, msg.noteType, notePosition);
  } else if (msg.type === "EXPORT_NOTES") {
    const notes = figma.currentPage.findAll((n) => n.getPluginData("noteId"));

    const results = notes.map((node) => {
      const textNode = node.findOne((n) => n.type === "TEXT");
      const metaNode = node.findAll((n) => n.type === "TEXT")[1];
      return {
        text: textNode && textNode.characters ? textNode.characters : "",
        meta: metaNode && metaNode.characters ? metaNode.characters : "",
        id: node.getPluginData("noteId") || "",
      };
    });

    const markdown = results
      .map((note) => `> ${note.text}\n\n— ${note.meta}`)
      .join("\n\n---\n\n");

    figma.ui.postMessage({ type: "EXPORT_RESULTS", text: markdown });
    
  } else if (msg.type === "toggle-notes") {
    const notes = figma.currentPage.findAll(
      (node) => node.getPluginData("noteId") !== ""
    );
    const anyVisible = notes.some((note) => note.visible === true);

    for (const note of notes) {
      note.visible = !anyVisible;
    }

    figma.notify(anyVisible ? "Notes hidden" : "Notes shown");
  }
};
