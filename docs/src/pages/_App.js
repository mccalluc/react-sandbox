import React, { useCallback, useEffect, useState, useReducer } from 'react';
import clsx from 'clsx';
import useHashParam from './_use-hash-param';
import useBaseUrl from '@docusaurus/useBaseUrl';
import useThemeContext from '@theme/hooks/useThemeContext';
import { useDropzone } from 'react-dropzone';
import ControlledEditor from './_ControlledEditor';
import { LiveProvider, LiveContext, LiveError, LivePreview } from 'react-live';
import Highlight, { defaultProps } from "prism-react-renderer";
import copy from 'copy-text-to-clipboard';
import {
  Vitessce,
  VitessceConfig, hconcat, vconcat,
  CoordinationType, Component, DataType, FileType,
} from '../../../dist/umd/production/index.min.js';
import { getHighlightTheme } from './_highlight-theme';
import { baseJs, baseJson, exampleJs, exampleJson } from './_live-editor-examples';

import { configs } from '../../../src/demo/configs';

import styles from './styles.module.css';

const JSON_TRANSLATION_KEY = 'vitessceJsonTranslation';

// To simplify the JS editor, the user only needs to write
// the inner part of the createConfig() function,
// because this code will wrap the user's code to
// return a React component for react-live.
function transformCode(code) {
  return `function vitessceConfigEditor() {
    function createConfig() {
      ${code}
    }
    const vcJson = createConfig();
    return (
      <Highlight json={vcJson} />
    );
  }`;
}

function ThemedControlledEditor(props) {
  const { isDarkTheme } = useThemeContext();
  return <ControlledEditor
    {...props}
    theme={(isDarkTheme ? "dark" : "GitHub")}
    height="60vh"
    options={{
      fontSize: 14,
      minimap: {
        enabled: false,
      },
      contextmenu: false,
    }}
  />
}

function ThemedVitessce(props) {
  const { isDarkTheme } = useThemeContext();
  return (
    <Vitessce
      theme={isDarkTheme ? "dark" : "light"}
      {...props}
    />
  );
}

function JsonHighlight(props) {
  const { json } = props;
  const { isDarkTheme } = useThemeContext();
  const highlightTheme = getHighlightTheme(isDarkTheme);
  const [showCopied, setShowCopied] = useState(false);

  const jsonCode = JSON.stringify(json, null, 2);
  
  const handleCopyCode = () => {
      copy(jsonCode);
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
  };

  useEffect(() => {
    // Put the current translation on the window for easy retrieval.
    // There is probably a cleaner way to do this.
    window[JSON_TRANSLATION_KEY] = jsonCode;
  });
  
  // Adapted from https://github.com/FormidableLabs/prism-react-renderer/blob/master/README.md#usage
  return (
    <Highlight {...defaultProps} code={jsonCode} language="json" theme={highlightTheme}>
      {({ className, style, tokens, getLineProps, getTokenProps }) => (
        <div className={styles.copyButtonContainer}>
          <pre className={clsx(className, styles.viewConfigPreviewJSCode)} style={style}>
            {tokens.map((line, i) => (
              <div {...getLineProps({ line, key: i })}>
                {line.map((token, key) => (
                  <span {...getTokenProps({ token, key })} />
                ))}
              </div>
            ))}
          </pre>
          <button
            type="button"
            aria-label="Copy code to clipboard"
            className={styles.copyButton}
            onClick={handleCopyCode}>
            {showCopied ? 'Copied' : 'Copy'}
          </button>
        </div>
      )}
    </Highlight>
  );
}

const scope = {
  VitessceConfig: VitessceConfig,
  hconcat: hconcat,
  vconcat: vconcat,
  Component: Component,
  DataType: DataType,
  FileType: FileType,
  CoordinationType: CoordinationType,
  cm: Component,
  dt: DataType,
  ft: FileType,
  ct: CoordinationType,
  Highlight: JsonHighlight,
};

function App() {
  const [demo, setDemo] = useHashParam('dataset', undefined, 'string');
  const [debug, setDebug] = useHashParam('debug', false, 'boolean');
  const [url, setUrl] = useHashParam('url', undefined, 'string');
  const [edit, setEdit] = useHashParam('edit', true, 'boolean');
  const [i, increment] = useReducer(v => v+1, 1);

  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [validConfig, setValidConfig] = useState(null);
  
  const [pendingConfig, setPendingConfig] = useState(baseJson);
  const [pendingUrl, setPendingUrl] = useState('');
  const [pendingFileContents, setPendingFileContents] = useState('');

  const [pendingJs, setPendingJs] = useState(baseJs);

  const [syntaxType, setSyntaxType] = useState('JSON');
  const [loadFrom, setLoadFrom] = useState('editor');


  const onDrop = useCallback(acceptedFiles => {
    if(acceptedFiles.length === 1) {
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        const { result } = reader;
        setPendingFileContents(result);
        setLoadFrom('file');
      });
      reader.readAsText(acceptedFiles[0]);
    }
  }, []);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, maxFiles: 1});

  useEffect(() => {
    let unmounted = false;
    async function processParams() {
      if (url) {
        setLoading(true);
        try {
          const response = await fetch(url);
          if(unmounted) {
            return;
          }
          if(response.ok) {
            const responseText = await response.text();
            if(unmounted) {
              return;
            }
            if(edit) {
              // User wants to edit the URL-based config.
              try {
                // Ideally, this is valid JSON and we can
                // use JSON.stringify to add nice indentation.
                const responseJson = JSON.parse(responseText);
                setPendingConfig(JSON.stringify(responseJson, null, 2));
                setValidConfig(null);
              } catch(e) {
                // However, this may be an invalid JSON object
                // so we can just let the user edit the unformatted string.
                setPendingConfig(responseText);
                setValidConfig(null);
              }
              setError(null);
            } else {
              try {
                const responseJson = JSON.parse(responseText);
                // TODO: validate here.
                setPendingConfig(responseJson);
                setValidConfig(responseJson);
                setError(null);
              } catch(e) {
                setError({
                  title: "Error parsing JSON",
                  message: e.message,
                });
                setPendingConfig(responseText);
                setValidConfig(null);
              }
            }
            setLoading(false);
          } else {
            setError({
              title: "Fetch response not OK",
              message: response.statusText,
            });
            setLoading(false);
            setPendingConfig('{}');
            setValidConfig(null);
          }
        } catch(e) {
          setError({
            title: "Fetch error",
            message: e.message,
          });
          setLoading(false);
          setPendingConfig('{}');
          setValidConfig(null);
        }
      } else if(demo && configs[demo]) {
        setPendingConfig(JSON.stringify(configs[demo], null, 2));
        if(edit) {
          setValidConfig(null); 
        } else {
          setValidConfig(configs[demo]); 
        }
        setError(null);
        setLoading(false);
      } else {
        setPendingConfig(baseJson);
        setValidConfig(null);
        setError(null);
        setLoading(false);
      }
    }
    processParams();
    return () => {
      unmounted = true;
    };
  }, [url, edit, demo]);

  function handleEditorGo() {
    setEdit(false);
    if(loadFrom === 'editor') {
      let nextConfig = pendingConfig;
      if(syntaxType === "JS") {
        nextConfig = window[JSON_TRANSLATION_KEY];
        setSyntaxType("JSON");
      }
      setUrl('data:,' + encodeURIComponent(nextConfig));
    } else if(loadFrom === 'url') {
      setUrl(pendingUrl);
    } else if(loadFrom === 'file') {
      setUrl('data:,' + encodeURIComponent(pendingFileContents));
    }
    increment();
  }

  function handleClear() {
    setEdit(true);
    increment();
  }

  function handleUrlChange(event) {
    setPendingUrl(event.target.value);
    setLoadFrom('url');
  }

  function handleSyntaxChange(event) {
    setSyntaxType(event.target.value);
  }

  function tryExample() {
    if(syntaxType === "JSON") {
      setPendingConfig(exampleJson);
    } else {
      setPendingJs(exampleJs);
    }
    setLoadFrom('editor');
  }

  function resetEditor() {
    if(syntaxType === "JSON") {
      setPendingConfig(baseJson);
    } else {
      setPendingJs(baseJs);
    }
  }

  const showReset = syntaxType === "JSON" && pendingConfig !== baseJson || syntaxType === "JS" && pendingJs !== baseJs;

  return (
      loading ? (
        <pre>Loading...</pre>
      ) : (!validConfig ? (
        <main className={styles.viewConfigEditorMain}>
          {error && <pre className={styles.vitessceAppLoadError}>{JSON.stringify(error)}</pre>}
          <p className={styles.viewConfigEditorInfo}>
            To use Vitessce, enter a&nbsp;
            <a href={useBaseUrl('/docs/view-config-json/index.html')}>view config</a>
            &nbsp;using the editor below.
            &nbsp;<button onClick={tryExample}>Try an example</button>&nbsp;
            {showReset && <button onClick={resetEditor}>Reset the editor</button>}
          </p>
          <div className={styles.viewConfigEditorType}>
            <label>
              <select className={styles.viewConfigEditorTypeSelect} value={syntaxType} onChange={handleSyntaxChange}>
                <option value="JSON">JSON</option>
                <option value="JS">JS</option>
              </select>
            </label>
          </div>
          <div className={styles.viewConfigEditorInputsSplit}>
            <div className={styles.viewConfigEditor}>
              {syntaxType === "JSON" ? (
                <>
                  <ThemedControlledEditor
                    value={pendingConfig}
                    onChange={(event, value) => {
                      setPendingConfig(value);
                      setLoadFrom('editor');
                    }}
                    language="json"
                  />
                </>
              ) : (
                <div className={styles.viewConfigEditorPreviewJSSplit}>
                  <LiveProvider code={pendingJs} scope={scope} transformCode={transformCode}>
                    <LiveContext.Consumer>
                      {({ code, disabled, onChange }) => (
                        <div className={styles.viewConfigEditorJS}>
                          <ThemedControlledEditor
                            value={code}
                            onChange={(event, value) => {
                              setPendingJs(value);
                              setLoadFrom('editor');
                            }}
                            language="javascript"
                          />
                        </div>
                      )}
                    </LiveContext.Consumer>
                    <div className={styles.viewConfigPreviewErrorSplit}>
                      <p className={styles.livePreviewHeader}>Translation to JSON</p>
                      <div className={styles.viewConfigPreviewScroll}>
                        <LiveError className={styles.viewConfigErrorJS} />
                        <LivePreview className={styles.viewConfigPreviewJS} />
                      </div>
                    </div>
                  </LiveProvider>
                </div>
              )}
            </div>
            <div className={styles.viewConfigInputs}>
              <div className={styles.viewConfigInputUrlOrFile}>
                <p className={styles.viewConfigInputUrlOrFileText}>
                  Alternatively, provide a URL or drag &amp; drop a view config file.
                </p>
                <div className={styles.viewConfigInputUrlOrFileSplit}>
                  <input
                    type="text"
                    className={styles.viewConfigUrlInput}
                    placeholder="Enter a URL"
                    value={pendingUrl}
                    onChange={handleUrlChange}
                  />
                  <div {...getRootProps()} className={styles.dropzone}>
                    <input {...getInputProps()} className={styles.dropzoneInfo} />
                    {isDragActive ?
                      <span>Drop the file here ...</span> :
                      (pendingFileContents ? (
                        <span>Successfully read the file.</span>
                      ) : (
                      <span>Drop a file</span>
                      )
                    )}
                  </div>
                </div>
              </div>
              <div className={styles.viewConfigInputButton}>
                <button className={styles.viewConfigGo} onClick={handleEditorGo}>Load from {loadFrom}</button>
              </div>
            </div>
          </div>
        </main>
      ) : (
        <main className={'vitessce-app'}>
          <ThemedVitessce
            validateOnConfigChange={debug}
            config={validConfig}
          />
          <div className={styles.vitessceClear}>
            <button
              className={styles.vitessceClearButton}
              onClick={handleClear}>
              Edit
            </button>
          </div>
        </main>
      ))
  );
}

// Reference: https://github.com/pbeshai/use-query-params#usage
function WrappedApp() {
  return(
    <App/>
  );
}

export default WrappedApp;