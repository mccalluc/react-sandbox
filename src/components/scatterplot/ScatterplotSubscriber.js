/* eslint-disable */
import React, { useState, useEffect, useCallback } from 'react';
import { connect } from 'react-redux';
import PubSub from 'pubsub-js';
import { extent } from 'd3-array';
import clamp from 'lodash/clamp';

import TitleInfo from '../TitleInfo';
import {
  CELLS_ADD, CELLS_COLOR, CELLS_HOVER, STATUS_INFO, VIEW_INFO, CELLS_SELECTION,
  CELL_SETS_VIEW, CLEAR_PLEASE_WAIT, RESET,
} from '../../events';
import { useDeckCanvasSize, pluralize, capitalize } from '../utils';
import Scatterplot from './Scatterplot';
import ScatterplotTooltipSubscriber from './ScatterplotTooltipSubscriber';


function ScatterplotSubscriber(props) {
  const {
    uid,
    loaders,
    zoom,
    target,
    mapping,
    coordination,
    onReady,
    removeGridComponent,
    theme,
    disableTooltip = false,
    observationsLabelOverride: observationsLabel = 'cell',
    observationsPluralLabelOverride: observationsPluralLabel = `${observationsLabel}s`,
  } = props;
  
  const view = { zoom, target };
  console.log("uid", uid);
  console.log("loaders", loaders);
  console.log("coordination", coordination);
  console.log("coordinationSpace", zoom, target, mapping);


  const [cells, setCells] = useState({});
  const [selectedCellIds, setSelectedCellIds] = useState(new Set());
  const [cellColors, setCellColors] = useState(null);
  const [cellRadiusScale, setCellRadiusScale] = useState(0.2);
  const [urls, setUrls] = useState([]);

  const [width, height, deckRef] = useDeckCanvasSize();

  const onReadyCallback = useCallback(onReady, []);

  useEffect(() => {
    const cellsAddToken = PubSub.subscribe(
      CELLS_ADD, (msg, { data, url }) => {
        setCells(data);
        setUrls((prevUrls) => {
          const newUrls = [...prevUrls].concat({ url, name: 'Cells' });
          return newUrls;
        });
      },
    );
    const cellsColorToken = PubSub.subscribe(
      CELLS_COLOR, (msg, data) => {
        setCellColors(data);
      },
    );
    const cellsSelectionToken = PubSub.subscribe(
      CELLS_SELECTION, (msg, data) => {
        setSelectedCellIds(data);
      },
    );
    const cellSetsViewToken = PubSub.subscribe(
      CELL_SETS_VIEW, (msg, data) => {
        setSelectedCellIds(data);
      },
    );
    const resetToken = PubSub.subscribe(RESET, () => setUrls([]));
    onReadyCallback();
    return () => {
      PubSub.unsubscribe(cellsAddToken);
      PubSub.unsubscribe(cellsColorToken);
      PubSub.unsubscribe(cellsSelectionToken);
      PubSub.unsubscribe(cellSetsViewToken);
      PubSub.unsubscribe(resetToken);
    };
  }, [onReadyCallback, mapping]);

  // After cells have loaded or changed,
  // compute the cell radius scale based on the
  // extents of the cell coordinates on the x/y axes.
  useEffect(() => {
    if (cells) {
      const cellCoordinates = Object.values(cells)
        .map(c => c.mappings[mapping]);
      const xExtent = extent(cellCoordinates, c => c[0]);
      const yExtent = extent(cellCoordinates, c => c[1]);
      const xRange = xExtent[1] - xExtent[0];
      const yRange = yExtent[1] - yExtent[0];
      const diagonalLength = Math.sqrt((xRange ** 2) + (yRange ** 2));
      // The 300 value here is a heuristic.
      const newScale = clamp(diagonalLength / 300, 0, 0.2);
      if (newScale) {
        setCellRadiusScale(newScale);
      }
    }
  }, [cells, mapping]);

  const getCellInfo = useCallback((cellId) => {
    const cellInfo = cells[cellId];
    return {
      [`${capitalize(observationsLabel)} ID`]: cellId,
      ...(cellInfo ? cellInfo.factors : {}),
    };
  }, [cells, observationsLabel]);

  const cellsCount = Object.keys(cells).length;
  return (
    <TitleInfo
      title={`Scatterplot (${mapping})`}
      info={`${cellsCount} ${pluralize(observationsLabel, observationsPluralLabel, cellsCount)}`}
      removeGridComponent={removeGridComponent}
      urls={urls}
      theme={theme}
    >
      <Scatterplot
        ref={deckRef}
        uuid={uid}
        theme={theme}
        view={view}
        cells={cells}
        mapping={mapping}
        selectedCellIds={selectedCellIds}
        cellColors={cellColors}
        cellRadiusScale={cellRadiusScale}
        updateStatus={message => PubSub.publish(STATUS_INFO, message)}
        updateCellsSelection={selectedIds => PubSub.publish(CELLS_SELECTION, selectedIds)}
        updateCellsHover={hoverInfo => PubSub.publish(CELLS_HOVER, hoverInfo)}
        updateViewInfo={viewInfo => PubSub.publish(VIEW_INFO, viewInfo)}
        clearPleaseWait={
          layerName => PubSub.publish(CLEAR_PLEASE_WAIT, layerName)
        }
      />
      {!disableTooltip && (
      <ScatterplotTooltipSubscriber
        uuid={uid}
        width={width}
        height={height}
        getCellInfo={getCellInfo}
      />
      )}
    </TitleInfo>
  );
}


const mapStateToProps = (state, ownProps) => {
  const { coordinationSpace } = state.viewConfig || {};
  const { coordination } = ownProps;
  return {
    zoom: coordinationSpace?.scatterplotZoom[coordination.scatterplotZoom],
    target: coordinationSpace?.scatterplotTarget[coordination.scatterplotTarget],
    mapping: coordinationSpace?.scatterplotMapping[coordination.scatterplotMapping],
  };
};

export default connect(mapStateToProps)(ScatterplotSubscriber);
