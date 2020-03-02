import { renderChartToLocalString } from "charticulator/dist/scripts/app/views/canvas/chart_display";
import { ChartStateManager } from "charticulator/dist/scripts/core/prototypes/state";
import { Button, Upload, Icon, Switch, InputNumber, Select } from "antd";
import csv from "csvtojson";
import React, { useEffect } from "react";
import ace from "brace";
import * as vega from "./vega";
import "./App.css";

const { JsonEditor } = require("jsoneditor-react");
const { Dragger } = Upload;

const App: React.FC = () => {
  const [json, _setJson] = React.useState<object>({});
  const [mode, setMode] = React.useState<string | boolean>(false);
  const [dataColumns, setDataColumns] = React.useState<string[]>([]);
  const [dataTable, _setDataTable] = React.useState<object[]>([]);
  const [nodeTable, setNodeTable] = React.useState<object[]>([]);
  const [svgHtml, _setSvgHtml] = React.useState("");
  const [rawSvgHtml, _setRawSvgHtml] = React.useState("");
  const [resize, setResize] = React.useState(false);
  const [chartWidth, setWidth] = React.useState(500);
  const [chartHeight, setHeight] = React.useState(500);
  const [boundingBox, setBoundingBox] = React.useState<number[][]>([]);
  let editor: any = null;
  let fragment: DocumentFragment;
  const editorRef = (i: any) => (editor = i || editor);

  const tryRenderTmplt = (m: string | boolean, j: any, d: object[]) => {
    if (m !== "tmplt" || !d.length || !j) {
      return;
    }
    setSvgHtml("");
    const dataset = {
      name: "demo",
      tables: j.tables.map((table: any) => {
        return {
          rows: d,
          ...table
        };
      })
    };
    try {
      const stateManager = new ChartStateManager(
        j.specification,
        dataset,
        null,
        j.defaultAttributes
      );
      stateManager.solveConstraints();
      renderChartToLocalString(
        dataset,
        j.specification,
        stateManager.chartState
      ).then(v => setSvgHtml(v));
    } catch {}
  };

  const tryProcessSvg = (m: string | boolean, s: string, d: object[]) => {
    _setSvgHtml("");
    if (m !== "svg" || !d.length || !s.length) return;
    const dataLength = d.length;
    fragment = document.createRange().createContextualFragment(s);
    const fragChild = Array.prototype.slice.call(
      fragment.children
    ) as HTMLElement[];
    let dataNodes: HTMLElement[][] = [];
    fragChild.forEach(node => {
      dataNodes = dataNodes.concat(findDomWithLength(node, dataLength));
    });
    let linkNodes: HTMLElement[][] = [];
    fragChild.forEach(node => {
      linkNodes = linkNodes.concat(findDomWithLength(node, dataLength - 1));
    });
    [dataNodes, linkNodes].forEach(collections => {
      collections.forEach(nodes => {
        nodes.forEach(node => {
          markGrayNodes(node, fragment);
          node.id = "Ref" + ~~(Math.random() * 1e8);
        });
      });
    });
    let unsetGroup: HTMLElement[] = [];
    fragChild.forEach(node => {
      unsetGroup = unsetGroup.concat(findUnsetNodes(node));
    });
    unsetGroup = unsetGroup.filter(
      node =>
        getLeafNodes(node).filter(
          (x: HTMLElement) =>
            x instanceof SVGGraphicsElement && !(x instanceof SVGGElement)
        ).length
    );
    unsetGroup.forEach(node => (node.id = "Ref" + ~~(Math.random() * 1e8)));
    _setSvgHtml(fragChild.map(node => node.outerHTML).join(""));
    setNodeTable([
      ...dataNodes.map(d => {
        return {
          nodes: d,
          isData: true,
          mapping: "data"
        };
      }),
      ...linkNodes.map(d => {
        return {
          nodes: d,
          isLink: true,
          mapping: "link"
        };
      }),
      ...unsetGroup.map(d => {
        return {
          nodes: [d],
          mapping: "static"
        };
      })
    ]);
  };

  const markGrayNodes = (dom: HTMLElement, root: DocumentFragment) => {
    dom.dataset.gray = "1";
    let parent = dom.parentNode;
    while (parent !== root) {
      (parent as HTMLElement).dataset.gray = "1";
      parent = parent.parentNode;
    }
  };

  const getLeafNodes = (master: HTMLElement) => {
    // https://stackoverflow.com/questions/22289391/how-to-create-an-array-of-leaf-nodes-of-an-html-dom-using-javascript

    var nodes = Array.prototype.slice.call(master.getElementsByTagName("*"), 0);
    var leafNodes = nodes.filter(function(elem: HTMLElement) {
      if (elem.hasChildNodes()) {
        // see if any of the child nodes are elements
        for (var i = 0; i < elem.childNodes.length; i++) {
          if (elem.childNodes[i].nodeType == 1) {
            // there is a child element, so return false to not include
            // this parent element
            return false;
          }
        }
      }
      return true;
    });
    return leafNodes;
  };

  const findUnsetNodes = (dom: HTMLElement): HTMLElement[] => {
    let result: HTMLElement[] = [];
    if (dom.children.length) {
      Array.prototype.slice.call(dom.children).forEach((node: HTMLElement) => {
        if (node.dataset.gray == "1") {
          result = result.concat(findUnsetNodes(node));
        } else {
          result.push(node);
        }
      });
    }
    return result;
  };

  const findDomWithLength = (
    dom: HTMLElement,
    length: number
  ): HTMLElement[][] => {
    const childNodes = Array.prototype.slice.call(
      dom.children
    ) as HTMLElement[];
    if (childNodes.length == length) {
      return [childNodes];
    }
    if (childNodes.length) {
      let result: HTMLElement[][] = [];
      childNodes.forEach(
        n => (result = result.concat(findDomWithLength(n, length)))
      );
      return result;
    }
    return [];
  };

  const setDataTable = (v: any) => {
    tryRenderTmplt(mode, json, v);
    tryProcessSvg(mode, rawSvgHtml, v);
    _setDataTable(v);
  };

  const setRawSvgHtml = (v: string) => {
    tryProcessSvg("svg", v, dataTable);
    _setRawSvgHtml(v);
    setMode("svg");
  };

  const setSvgHtml = (v: any) => {
    function outerStyle(node: any) {
      if (!(node instanceof SVGElement || node instanceof HTMLElement)) return;
      let styles: string = node.getAttribute("style") || "";
      let styleList = styles
        .split(";")
        .filter(x => x.trim())
        .map(x => x.split(":"));
      for (let style of styleList) {
        node.setAttribute(style[0].trim(), style[1].trim());
      }
      node.setAttribute("style", "");
      if (node.childNodes.length) {
        node.childNodes.forEach((child: any) => outerStyle(child));
      }
      // remove empty attributes
      for (let name of node.getAttributeNames()) {
        if (!node.getAttribute(name).trim()) {
          node.removeAttribute(name);
        }
      }
    }
    let tmpDiv = document.createElement("div");
    tmpDiv.innerHTML = v;
    outerStyle(tmpDiv);
    _setSvgHtml(tmpDiv.innerHTML);
  };

  useEffect(() => {
    setJson(json, false);
  }, [resize, chartWidth, chartHeight]);

  const setJson = (v: any, f = true) => {
    if (v.state && v.name) {
      setMode("chart");
      const tmp = JSON.parse(JSON.stringify(v));
      if (resize) {
        tmp.state.chart.mappings = {
          ...tmp.state.chart.mappings,
          width: {
            type: "value",
            value: chartWidth
          },
          height: {
            type: "value",
            value: chartHeight
          }
        };
        const stateManager = new ChartStateManager(
          tmp.state.chart,
          tmp.state.dataset,
          tmp.state.chartState
        );
        stateManager.solveConstraints();
        renderChartToLocalString(
          stateManager.dataset,
          stateManager.chart,
          stateManager.chartState
        ).then(v => setSvgHtml(v));
      } else
        renderChartToLocalString(
          v.state.dataset,
          v.state.chart,
          v.state.chartState
        ).then(v => setSvgHtml(v));
    } else if (
      v.specification &&
      v.defaultAttributes &&
      v.tables &&
      v.inference &&
      v.properties
    ) {
      setMode("tmplt");
      tryRenderTmplt("tmplt", v, dataTable);
    } else if ((v.$schema || "").includes("vega.github.io/schema")) {
      setMode("vega");
      const view: any = new vega.View(vega.parse(v), { renderer: "none" });
      view.toSVG().then((v: string) => setSvgHtml(v));
    } else setMode(false);
    f && editor.jsonEditor.set(v);
    setSvgHtml("");
    _setJson(v);
  };

  const editorSetJson = (v: any) => setJson(v, false);

  const props = {
    name: "file",
    accept: ".chart,.tmplt,.csv,.json,.svg",
    action: "/",
    showUploadList: false,
    beforeUpload(e: File) {
      let reader = new FileReader();
      reader.onload = () => {
        if (
          e.name.endsWith(".chart") ||
          e.name.endsWith(".tmplt") ||
          e.name.endsWith(".json")
        ) {
          try {
            setJson(JSON.parse(reader.result as string));
          } catch {}
        } else if (e.name.endsWith(".csv")) {
          csv({
            checkType: true
          })
            .fromString(reader.result as string)
            .on("header", e => setDataColumns(e))
            .then(e => setDataTable(e));
        } else if (e.name.endsWith(".svg")) {
          try {
            setRawSvgHtml(reader.result as string);
          } catch {}
        }
      };
      reader.readAsText(e);
      return false;
    }
  };

  function download() {
    var blob = new Blob([svgHtml], { type: "text/plain" });
    if (window.navigator.msSaveOrOpenBlob) {
      window.navigator.msSaveBlob(blob, "output.dsvg");
    } else {
      var elem = window.document.createElement("a");
      elem.href = window.URL.createObjectURL(blob);
      elem.download = "output.dsvg";
      document.body.appendChild(elem);
      elem.click();
      document.body.removeChild(elem);
    }
  }

  function drawBoundingBox(domList: HTMLElement[]) {
    const res: number[][] = [];
    domList.forEach(dom => {
      dom = document.getElementById(dom.id);
      const leaves = getLeafNodes(dom);
      if (leaves.length) {
        leaves.forEach((dom: HTMLElement) => {
          if (dom) {
            const boundingBox = dom.getBoundingClientRect();
            res.push([
              boundingBox.left - 10,
              boundingBox.top - 10,
              boundingBox.width + 20,
              boundingBox.height + 20
            ]);
          }
        });
      } else {
        if (dom) {
          const boundingBox = dom.getBoundingClientRect();
          res.push([
            boundingBox.left - 10,
            boundingBox.top - 10,
            boundingBox.width + 20,
            boundingBox.height + 20
          ]);
        }
      }
    });
    setBoundingBox(res);
  }

  return (
    <div id="app">
      <div>
        <Dragger {...props}>
          <p className="ant-upload-drag-icon">
            <Icon type="inbox" />
          </p>
          <p className="ant-upload-text">Click or drag file here to load</p>
          <p className="ant-upload-text">
            Support Charticulator(.chart), Charticulator Template(.tmplt),
            Data(.csv), Vega(.json), D3-export Chart(.svg) files
          </p>
        </Dragger>
        {mode !== "svg" ? (
          <>
            <p>You can also edit json in this editor:</p>
            <div className="json-editor">
              <JsonEditor
                ref={editorRef}
                mode="code"
                allowedModes={["code", "tree"]}
                ace={ace}
                value={json}
                onChange={editorSetJson}
              ></JsonEditor>
            </div>
            {mode !== "chart" && mode !== "vega" && (
              <>
                <p>Preview of dataset:</p>
                <div className="dataset">
                  {dataColumns.length ? (
                    <table>
                      <thead>
                        <tr>
                          {dataColumns.map(key => (
                            <th>{key}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {dataTable.map((row: any) => (
                          <tr>
                            {dataColumns.map(key => (
                              <td>{row[key]}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="hint">No dataset loaded.</p>
                  )}
                </div>
              </>
            )}
          </>
        ) : (
          <>
            <div
              className="dataset"
              style={{ flexGrow: 1, maxHeight: "initial" }}
            >
              {nodeTable.length ? (
                <table>
                  <thead>
                    <tr>
                      <th>Nodes</th>
                      <th>Mapping</th>
                      <th>Preview</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nodeTable.map((row: any) => (
                      <tr>
                        <td>{row.nodes.length} Groups</td>
                        <td>
                          {
                            <Select
                              value={row.mapping}
                              onChange={(v: string) => {
                                row.mapping = v;
                                setNodeTable(nodeTable);
                              }}
                            >
                              {row.isData && (
                                <Select.Option value="data">data</Select.Option>
                              )}
                              {row.isLink && (
                                <Select.Option value="link">link</Select.Option>
                              )}
                              <Select.Option value="axis">axis</Select.Option>
                              <Select.Option value="legend">
                                legend
                              </Select.Option>
                              <Select.Option value="static">
                                static
                              </Select.Option>
                            </Select>
                          }
                        </td>
                        <td>
                          <div
                            onMouseEnter={drawBoundingBox.bind(null, row.nodes)}
                            onMouseLeave={setBoundingBox.bind(null, [])}
                          >
                            <Icon type="eye" className="preview"></Icon>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="hint">No data mappings available.</p>
              )}
            </div>
            <div className="dataset">
              {dataColumns.length ? (
                <table>
                  <thead>
                    <tr>
                      {dataColumns.map(key => (
                        <th>{key}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dataTable.map((row: any) => (
                      <tr>
                        {dataColumns.map(key => (
                          <td>{row[key]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="hint">No dataset loaded.</p>
              )}
            </div>
          </>
        )}
      </div>
      <div>
        <Button
          disabled={!svgHtml}
          type="primary"
          icon="download"
          onClick={download}
        >
          {
            svgHtml?'Download':'Please load a valid chart first'
          }
        </Button>
        {/* {
          mode !== 'vega' && mode !== 'svg' &&
          <div>
            <Switch onChange={setResize} />
            <span>Resize Chart to</span>
            <InputNumber defaultValue={500} onChange={setWidth} size="small" />
            <span>&times;</span>
            <InputNumber defaultValue={500} onChange={setHeight} size="small" />
          </div>
        } */}
        <p>Preview of the exported chart:</p>
        <div
          className="svg-container"
          dangerouslySetInnerHTML={{ __html: svgHtml || rawSvgHtml }}
        ></div>
      </div>
      <div className="bounding-box-container">
        {boundingBox.map(boundingBox => (
          <div
            className="bounding-box"
            style={{
              left: boundingBox[0],
              top: boundingBox[1],
              width: boundingBox[2],
              height: boundingBox[3]
            }}
          ></div>
        ))}
      </div>
    </div>
  );
};

export default App;
