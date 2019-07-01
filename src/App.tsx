import { renderChartToLocalString } from 'charticulator/dist/scripts/app/views/canvas/chart_display'
import { Button, Upload, Icon } from 'antd'
import csv from 'csvtojson'
import React from 'react'
import ace from 'brace'
import './App.css'

const { JsonEditor } = require('jsoneditor-react')
const { Dragger } = Upload;

const App: React.FC = () => {
  const [json, _setJson] = React.useState<object>({})
  const [mode, setMode] = React.useState<string | boolean>(false)
  const [dataColumns, setDataColumns] = React.useState<string[]>([])
  const [dataTable, setDataTable] = React.useState<object[]>([])
  const [svgHtml, setSvgHtml] = React.useState('')
  let editor: any = null
  const editorRef = (i: any) => editor = i || editor

  const setJson = (v: any, f = true) => {
    if (v.state && v.name) {
      setMode('chart')
      renderChartToLocalString(v.state.dataset, v.state.chart, v.state.chartState).then(v => setSvgHtml(v))
    } else if (v.specification && v.defaultAttributes && v.tables && v.inference && v.properties) {
      setMode('tmplt')
    } else
      setMode(false)
    f && editor.jsonEditor.set(v)
    setSvgHtml('')
    _setJson(v)
  }

  const editorSetJson = (v: any) => setJson(v, false)

  const props = {
    name: 'file',
    accept: '.chart,.tmplt,.csv',
    action: '/',
    showUploadList: false,
    beforeUpload (e: File) {
      let reader = new FileReader()
      reader.onload = () => {
        if (e.name.endsWith('.chart') || e.name.endsWith('.tmplt')) {
          try {
            setJson(JSON.parse(reader.result as string))
          } catch{ }
        } else if (e.name.endsWith('.csv')) {
          csv().fromString(reader.result as string).on('header', e => setDataColumns(e)).then(e => setDataTable(e))
        }
      }
      reader.readAsText(e)
      return false
    }
  };

  function download () {
    var element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(svgHtml));
    element.setAttribute('download', 'output.svg');

    element.style.display = 'none';
    document.body.appendChild(element);

    element.click();

    document.body.removeChild(element);
  }

  return (
    <div id="app">
      <div>
        <Dragger {...props}>
          <p className="ant-upload-drag-icon">
            <Icon type="inbox" />
          </p>
          <p className="ant-upload-text">Click or drag file here to read</p>
        </Dragger>
        <div className="json-editor">
          <JsonEditor ref={editorRef} mode='code' allowedModes={['code', 'tree']} ace={ace} value={json} onChange={editorSetJson}></JsonEditor>
        </div>
        {
          mode !== 'chart' &&
          <div className="dataset">
            {
              dataColumns.length ?
                <table>
                  <thead>
                    <tr>
                      {dataColumns.map(key => <th>{key}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {dataTable.map((row: any) => <tr>{dataColumns.map(key => <td>{row[key]}</td>)}</tr>)}
                  </tbody>
                </table>
                :
                <p className="hint">No dataset loaded.</p>
            }
          </div>
        }
      </div>
      <div>
        <Button disabled={!svgHtml} type="primary" icon="download" onClick={download}>Download</Button>
        <div className="svg-container" dangerouslySetInnerHTML={{ __html: svgHtml }}></div>
      </div>
    </div>
  );
}

export default App;
